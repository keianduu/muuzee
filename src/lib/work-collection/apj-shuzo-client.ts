import * as cheerio from "cheerio";
import { fetchText } from "@/lib/external/fetch-text";
import { exactNameMatch, explicitPresentation, parseExplicitYear } from "./mapping";
import type { WorkSourceCandidate } from "./types";

type ArtistTarget = { name: string; name_en?: string | null; aliases?: string[] };

export function parseApjShuzoResults(html: string, artist: ArtistTarget, max = 5): WorkSourceCandidate[] {
  const $ = cheerio.load(html);
  const candidates: WorkSourceCandidate[] = [];
  $(".item").each((index, element) => {
    if (candidates.length >= max) return false;
    const item = $(element);
    const artistName = item.find(".artist .ja").first().text().trim() || item.find(".artist .en").first().text().trim();
    if (!artistName || !exactNameMatch(artist, artistName)) return;
    const link = item.find('a[href*="/collections/"]').first();
    const href = link.attr("href") || "";
    const externalId = href.split("/").filter(Boolean).pop() || item.attr("data-id") || "";
    const title = item.find(".work-title-ja").first().text().trim() || item.find(".work-title-en").first().text().trim();
    if (!externalId || !title) return;
    const titleEn = item.find(".work-title-en").first().text().trim() || null;
    const yearRaw = item.find(".isYear").first().text().trim() || null;
    const venueName = item.find('a[href*="/museums/"]').first().text().trim() || null;
    const year = parseExplicitYear(yearRaw);
    const displayText = item.find(".isDisplay, .display-status").text().trim();
    const presentation = explicitPresentation(displayText);
    candidates.push({
      externalId, sourceKey: "apj_shuzo", sourceUrl: new URL(href, "https://artplatform.go.jp").toString(), title,
      titleEn, titleOriginal: null, artistName, venueName, yearText: year.text, createdYearFrom: year.from, createdYearTo: year.to,
      holdingType: venueName ? "collection" : null, presentationType: presentation.type, presentationStatus: presentation.status,
      representativeScore: Math.max(0, 1 - index * 0.05), representativeReason: "Source result order only; human selection required",
      raw: { externalId, title, titleEn, artistName, venueName, year: yearRaw, displayText },
    });
  });
  return candidates;
}

export async function searchApjShuzo(artist: ArtistTarget, max = 5) {
  const url = new URL("https://artplatform.go.jp/ja/collections");
  url.searchParams.set("keyword", artist.name);
  return parseApjShuzoResults(await fetchText(url, 30_000), artist, Math.min(5, Math.max(1, max)));
}
