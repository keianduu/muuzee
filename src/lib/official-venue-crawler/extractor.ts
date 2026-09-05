import * as cheerio from "cheerio";
import type { FieldCandidate, OfficialCrawlField } from "./types";

const FIELD_PATTERNS: Record<OfficialCrawlField, RegExp[]> = {
  address: [/所在地\s*[：:]?\s*([^\n]{6,140})/i, /住所\s*[：:]?\s*([^\n]{6,140})/i, /address\s*[：:]?\s*([^\n]{6,180})/i],
  postal_code: [/〒\s*(\d{3}[-ー]\d{4})/, /(?:郵便番号|postal code)\s*[：:]?\s*(\d{3}[-ー]\d{4})/i],
  opening_hours_text: [/(?:開館時間|開場時間|営業時間|opening hours|hours)\s*[：:]?\s*([^\n]{3,240})/i],
  closed_days_text: [/(?:休館日|休業日|closed days?|closing days?)\s*[：:]?\s*([^\n]{2,240})/i],
  access_text: [/(?:アクセス|交通案内|交通アクセス|access|directions?)\s*[：:]?\s*([^\n]{3,500})/i],
};

const DISCOVERY_KEYWORDS = ["アクセス", "交通", "利用案内", "ご利用", "開館", "休館", "施設案内", "概要", "美術館について", "来館", "access", "visit", "visitor", "hours", "about", "guide", "information"];

function clean(value: unknown, max = 800) {
  return String(value || "").replace(/\u00a0/g, " ").replace(/[ \t]+/g, " ").replace(/\n{3,}/g, "\n\n").trim().slice(0, max);
}

function jsonLdObjects(value: unknown): Array<Record<string, unknown>> {
  if (Array.isArray(value)) return value.flatMap(jsonLdObjects);
  if (!value || typeof value !== "object") return [];
  const record = value as Record<string, unknown>;
  return [record, ...jsonLdObjects(record["@graph"]), ...jsonLdObjects(record.mainEntity)];
}

function add(target: Partial<Record<OfficialCrawlField, FieldCandidate[]>>, field: OfficialCrawlField, value: unknown, sourceUrl: string, confidence: number) {
  const normalized = clean(value, field === "access_text" ? 800 : 300);
  if (!normalized) return;
  if (field === "address") {
    if (/^(?:address|所在地|住所|郵便番号|メールアドレス)$/i.test(normalized)) return;
    const looksJapanese = /(都|道|府|県|市|区|町|村|郡|丁目|番地)/.test(normalized);
    const looksInternational = /\d/.test(normalized) && /(,|\b(?:street|st\.?|road|rd\.?|avenue|ave\.?|boulevard|blvd\.?|garden|tokyo|japan|city|district)\b)/i.test(normalized);
    if (!looksJapanese && !looksInternational) return;
  }
  if (field === "postal_code" && !/^\d{3}[-ー]\d{4}$/.test(normalized)) return;
  if (field === "opening_hours_text" && !/(\d{1,2}[:時.]|am|pm|正午)/i.test(normalized)) return;
  if (field === "closed_days_text" && !/(毎週|(?:月|火|水|木|金|土|日)曜|年末年始|祝日|休館|休業|closed|holiday)/i.test(normalized)) return;
  if (field === "access_text" && (normalized.length < 8 || !/(駅|徒歩|バス|駐車|分(?:。|、|\s|$)|metro|station|walk|bus|train|railway|subway|line)/i.test(normalized))) return;
  const values = target[field] || [];
  if (!values.some((item) => item.value === normalized)) values.push({ value: normalized, sourceUrl, confidence });
  target[field] = values;
}

export function extractOfficialPage(html: string, sourceUrl: string) {
  const $ = cheerio.load(html);
  const candidates: Partial<Record<OfficialCrawlField, FieldCandidate[]>> = {};
  let phone = "";

  $('script[type="application/ld+json"]').each((_, element) => {
    try {
      const payload = JSON.parse($(element).text());
      for (const item of jsonLdObjects(payload)) {
        const address = typeof item.address === "object" && item.address ? item.address as Record<string, unknown> : null;
        if (address) {
          const full = [address.postalCode, address.addressRegion, address.addressLocality, address.streetAddress].filter(Boolean).join(" ");
          add(candidates, "address", full, sourceUrl, 100);
          add(candidates, "postal_code", address.postalCode, sourceUrl, 100);
        } else if (typeof item.address === "string") add(candidates, "address", item.address, sourceUrl, 100);
        const hours = Array.isArray(item.openingHours) ? item.openingHours.join(" / ") : item.openingHours;
        add(candidates, "opening_hours_text", hours, sourceUrl, 100);
        if (!phone && item.telephone) phone = clean(item.telephone, 100);
      }
    } catch { /* Malformed JSON-LD is ignored; semantic extraction continues. */ }
  });

  $("script,style,nav,header,footer,aside,form,dialog,noscript,svg").remove();
  const main = $("main, article, [role=main], #main, .main, #content, .content").first();
  const root = main.length ? main : $("body");
  const semanticLines = root.find("h1,h2,h3,h4,p,li,dt,dd,address,tr").map((_, element) => clean($(element).text(), 1200)).get().filter(Boolean);
  const text = (semanticLines.length ? semanticLines : root.text().split(/\n+/).map((line) => clean(line, 1200))).filter(Boolean).join("\n");
  for (const [field, patterns] of Object.entries(FIELD_PATTERNS) as Array<[OfficialCrawlField, RegExp[]]>) {
    for (const pattern of patterns) {
      const match = text.match(pattern);
      if (match?.[1]) { add(candidates, field, match[1], sourceUrl, 60); break; }
    }
  }
  for (const candidate of candidates.address || []) {
    const postalCode = candidate.value.match(/(?:〒\s*)?(\d{3}[-ー]\d{4})/)?.[1];
    if (postalCode) add(candidates, "postal_code", postalCode, candidate.sourceUrl, candidate.confidence);
  }

  if (!phone) phone = clean(text.match(/(?:電話|TEL|Phone)\s*[：:]?\s*([+\d][\d\s()-]{7,25})/i)?.[1], 100);
  const metaDescription = clean($("meta[name=description]").attr("content") || $("meta[property='og:description']").attr("content"), 1200);
  const isAbout = DISCOVERY_KEYWORDS.some((keyword) => `${sourceUrl} ${$("title").text()} ${$("h1").first().text()}`.toLowerCase().includes(keyword.toLowerCase()));
  const descriptionSourceText = clean(metaDescription || (isAbout ? text : ""), 1200);

  const links = $("a[href]").map((_, element) => {
    const href = $(element).attr("href") || "";
    const label = clean($(element).text(), 120);
    try { return { url: new URL(href, sourceUrl).toString(), label }; } catch { return null; }
  }).get().filter(Boolean) as Array<{ url: string; label: string }>;

  return { candidates, phone, descriptionSourceText, officialSourceText: clean(text, 4000), links };
}

export function discoveryScore(link: { url: string; label: string }) {
  const haystack = `${link.url} ${link.label}`.toLowerCase();
  const keywordScore = DISCOVERY_KEYWORDS.reduce((score, keyword) => score + (haystack.includes(keyword.toLowerCase()) ? 10 : 0), 0);
  const depth = new URL(link.url).pathname.split("/").filter(Boolean).length;
  return keywordScore - Math.min(depth, 6);
}

export function resolveCandidates(candidates: Partial<Record<OfficialCrawlField, FieldCandidate[]>>) {
  const values: Partial<Record<OfficialCrawlField, string>> = {};
  const sourceUrls: Partial<Record<OfficialCrawlField, string>> = {};
  const ambiguous: Record<string, string[]> = {};
  for (const [field, items] of Object.entries(candidates) as Array<[OfficialCrawlField, FieldCandidate[]]>) {
    const topConfidence = Math.max(...items.map((item) => item.confidence));
    const top = items.filter((item) => item.confidence === topConfidence);
    const unique = [...new Set(top.map((item) => item.value))];
    if (unique.length > 1) { ambiguous[field] = unique; continue; }
    values[field] = top[0].value;
    sourceUrls[field] = top[0].sourceUrl;
  }
  return { values, sourceUrls, ambiguous };
}
