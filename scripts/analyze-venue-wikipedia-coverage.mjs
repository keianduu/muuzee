#!/usr/bin/env node

import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { createClient } from "@supabase/supabase-js";

const USER_AGENT = "MuuzeeWikipediaCoverageTest/1.0 (research; https://github.com/keianduu/muuzee)";
const DEFAULT_OUTPUT = "tmp/venue-wikipedia-coverage.csv";
const DEFAULT_REPORT = "docs/research/venue-wikipedia-coverage.md";
const FIELDS = ["address", "postalCode", "coordinates", "officialUrl", "openingYear"];
const LABELS = { address: "Address", postalCode: "Postal Code", coordinates: "Coordinates", officialUrl: "Official URL", openingYear: "Opening Year" };

function argument(name, fallback) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : fallback;
}

const limit = Number.parseInt(argument("--limit", "20"), 10);
const outputPath = resolve(argument("--output", DEFAULT_OUTPUT));
const reportPath = resolve(argument("--report", DEFAULT_REPORT));
const writeReport = process.argv.includes("--write-report");

function sleep(ms) { return new Promise((done) => setTimeout(done, ms)); }

async function fetchJson(url) {
  let lastError;
  for (let attempt = 1; attempt <= 4; attempt += 1) {
    try {
      const response = await fetch(url, { headers: { Accept: "application/json", "User-Agent": USER_AGENT }, signal: AbortSignal.timeout(60_000) });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return await response.json();
    } catch (error) {
      lastError = error;
      await sleep(350 * attempt);
    }
  }
  throw lastError;
}

function dataValue(statement) { return statement?.mainsnak?.datavalue?.value ?? null; }
function firstClaim(entity, property) { return dataValue(entity?.claims?.[property]?.[0]); }
function stringClaim(entity, property) {
  const value = firstClaim(entity, property);
  if (typeof value === "string") return value;
  if (value && typeof value === "object" && typeof value.text === "string") return value.text;
  return null;
}
function yearClaim(entity, property) {
  const value = firstClaim(entity, property);
  const match = typeof value?.time === "string" ? value.time.match(/^([+-]\d{4,})-/) : null;
  return match ? Number.parseInt(match[1], 10) : null;
}
function coordinatesClaim(entity) {
  const value = firstClaim(entity, "P625");
  return value && typeof value.latitude === "number" && typeof value.longitude === "number"
    ? { latitude: value.latitude, longitude: value.longitude }
    : null;
}

async function getWikidataEntities(qids) {
  const url = new URL("https://www.wikidata.org/w/api.php");
  Object.entries({ action: "wbgetentities", ids: qids.join("|"), props: "claims|sitelinks", sitefilter: "jawiki|enwiki", format: "json", origin: "*" }).forEach(([key, value]) => url.searchParams.set(key, value));
  return (await fetchJson(url)).entities || {};
}

function splitTopLevel(value, separator) {
  const parts = [];
  let start = 0; let braces = 0; let brackets = 0;
  for (let index = 0; index < value.length; index += 1) {
    const pair = value.slice(index, index + 2);
    if (pair === "{{") { braces += 1; index += 1; continue; }
    if (pair === "}}") { braces = Math.max(0, braces - 1); index += 1; continue; }
    if (pair === "[[") { brackets += 1; index += 1; continue; }
    if (pair === "]]" ) { brackets = Math.max(0, brackets - 1); index += 1; continue; }
    if (value[index] === separator && braces === 0 && brackets === 0) { parts.push(value.slice(start, index)); start = index + 1; }
  }
  parts.push(value.slice(start));
  return parts;
}

function topLevelTemplates(wikitext) {
  const templates = [];
  let start = -1; let depth = 0;
  for (let index = 0; index < wikitext.length - 1; index += 1) {
    const pair = wikitext.slice(index, index + 2);
    if (pair === "{{") { if (depth === 0) start = index; depth += 1; index += 1; }
    else if (pair === "}}" && depth > 0) {
      depth -= 1; index += 1;
      if (depth === 0 && start >= 0) { templates.push(wikitext.slice(start + 2, index - 1)); start = -1; }
    }
  }
  return templates;
}

function normalizeKey(value) { return value.normalize("NFKC").toLowerCase().replace(/[\s_-]/g, ""); }

function templateParameters(template) {
  const parts = splitTopLevel(template, "|");
  const params = new Map();
  for (const part of parts.slice(1)) {
    const equals = splitTopLevel(part, "=");
    if (equals.length < 2) continue;
    params.set(normalizeKey(equals.shift().trim()), equals.join("=").trim());
  }
  return { name: normalizeKey(parts[0] || ""), params };
}

function pickParameter(params, keys) {
  for (const key of keys.map(normalizeKey)) if (params.has(key) && params.get(key).trim()) return params.get(key).trim();
  return null;
}

function stripMarkup(value) {
  if (!value) return null;
  let text = value.replace(/<!--[\s\S]*?-->/g, "").replace(/<ref\b[^>]*\/>/gi, "").replace(/<ref\b[^>]*>[\s\S]*?<\/ref>/gi, "").replace(/<br\s*\/?>/gi, " ");
  text = text.replace(/\{\{(?:lang|仮リンク|ill)\|[^|{}]+\|([^{}|]+)(?:\|[^{}]*)?\}\}/gi, "$1");
  text = text.replace(/\{\{(?:url|officialwebsite|公式サイト)\|([^{}|]+)(?:\|[^{}]*)?\}\}/gi, "$1");
  text = text.replace(/\[\[([^\]|]+)\|([^\]]+)\]\]/g, "$2").replace(/\[\[([^\]]+)\]\]/g, "$1");
  text = text.replace(/\[(https?:\/\/\S+)\s+([^\]]+)\]/g, "$2").replace(/\[(https?:\/\/[^\]]+)\]/g, "$1");
  text = text.replace(/\{\{[^{}]*\}\}/g, " ").replace(/<[^>]+>/g, " ").replace(/'{2,}/g, "").replace(/&nbsp;|&#160;/gi, " ").replace(/&amp;/gi, "&");
  return text.replace(/\s+/g, " ").trim() || null;
}

function extractUrl(value) {
  if (!value) return null;
  const template = value.match(/\{\{(?:URL|Official website|公式サイト)\|\s*(https?:\/\/[^|}\s]+)/i);
  const direct = value.match(/https?:\/\/[^\s\]|}<]+/i);
  return (template?.[1] || direct?.[0] || null)?.replace(/[.,;、。]+$/, "") || null;
}

function extractPostal(value) {
  const match = value?.normalize("NFKC").match(/(?:〒\s*)?(\d{3})[-ー－](\d{4})/);
  return match ? `${match[1]}-${match[2]}` : null;
}

function extractYear(value) {
  const match = stripMarkup(value)?.match(/(?:^|[^0-9])((?:18|19|20)\d{2})(?:年|[^0-9]|$)/);
  return match ? Number.parseInt(match[1], 10) : null;
}

function parseCoordTemplate(value) {
  const match = value?.match(/\{\{(?:coord|座標)\|([^{}]+)\}\}/i);
  if (!match) return null;
  const tokens = match[1].split("|").map((token) => token.trim());
  const hemisphere = tokens.findIndex((token) => /^(N|S)$/i.test(token));
  const eastWest = tokens.findIndex((token) => /^(E|W)$/i.test(token));
  if (hemisphere > 0 && eastWest > hemisphere) {
    const decimal = (parts, direction) => {
      const numbers = parts.map(Number).filter(Number.isFinite);
      const result = (numbers[0] || 0) + (numbers[1] || 0) / 60 + (numbers[2] || 0) / 3600;
      return /S|W/i.test(direction) ? -result : result;
    };
    return { latitude: decimal(tokens.slice(0, hemisphere), tokens[hemisphere]), longitude: decimal(tokens.slice(hemisphere + 1, eastWest), tokens[eastWest]) };
  }
  const numeric = tokens.map(Number).filter(Number.isFinite);
  return numeric.length >= 2 ? { latitude: numeric[0], longitude: numeric[1] } : null;
}

function bestInfobox(wikitext) {
  const fieldKeys = ["所在地", "住所", "location", "address", "郵便番号", "postalcode", "座標", "coordinates", "開館", "設立", "established", "公式サイト", "website"];
  return topLevelTemplates(wikitext).map(templateParameters).map((template) => ({ ...template, score: fieldKeys.filter((key) => template.params.has(normalizeKey(key))).length + (/infobox|基礎情報|博物館|美術館/.test(template.name) ? 2 : 0) })).sort((a, b) => b.score - a.score)[0] || null;
}

function parseWikipedia(wikitext, pageCoordinates) {
  const infobox = bestInfobox(wikitext);
  if (!infobox || infobox.score < 2) return { fields: {}, notes: ["recognizable infobox/template not found"] };
  const { params } = infobox;
  const addressRaw = pickParameter(params, ["所在地", "住所", "location", "address"]);
  const postalRaw = pickParameter(params, ["郵便番号", "postal_code", "postal code", "postalcode"]);
  const coordinateRaw = pickParameter(params, ["座標", "coordinates", "coord"]);
  const officialRaw = pickParameter(params, ["公式サイト", "website", "url", "homepage"]);
  const openingRaw = pickParameter(params, ["開館", "開館年", "設立", "設立年", "established", "opening_date", "opened"]);
  const openingHoursRaw = pickParameter(params, ["開館時間", "営業時間", "opening_hours", "hours"]);
  const closedDaysRaw = pickParameter(params, ["休館日", "休業日", "closed", "closed_days"]);
  const address = stripMarkup(addressRaw);
  return { fields: {
    address,
    postalCode: extractPostal(postalRaw) || extractPostal(addressRaw),
    coordinates: parseCoordTemplate(coordinateRaw) || pageCoordinates,
    officialUrl: extractUrl(officialRaw),
    openingYear: extractYear(openingRaw),
    openingHours: stripMarkup(openingHoursRaw),
    closedDays: stripMarkup(closedDaysRaw),
  }, notes: [] };
}

async function getWikipediaPage(title, language) {
  const url = new URL(`https://${language}.wikipedia.org/w/api.php`);
  Object.entries({ action: "query", prop: "revisions|coordinates|info", titles: title, redirects: "1", rvprop: "content", rvslots: "main", inprop: "url", formatversion: "2", format: "json", origin: "*" }).forEach(([key, value]) => url.searchParams.set(key, value));
  const payload = await fetchJson(url);
  const page = payload.query?.pages?.[0];
  if (!page || page.missing) return null;
  const wikitext = page.revisions?.[0]?.slots?.main?.content;
  if (typeof wikitext !== "string") return null;
  const coord = page.coordinates?.[0];
  return { title: page.title || title, url: page.fullurl || `https://${language}.wikipedia.org/wiki/${encodeURIComponent(title.replaceAll(" ", "_"))}`, wikitext, coordinates: typeof coord?.lat === "number" && typeof coord?.lon === "number" ? { latitude: coord.lat, longitude: coord.lon } : null };
}

function normalizeText(value) { return value ? value.normalize("NFKC").toLowerCase().replace(/[\s〒,，、。・･―ー−－-]/g, "") : null; }
function normalizeUrl(value) {
  if (!value) return null;
  try { const url = new URL(value); return `${url.hostname.toLowerCase().replace(/^www\./, "")}${url.pathname.replace(/\/$/, "")}`; }
  catch { return normalizeText(value); }
}
function equalCoordinates(left, right) { return left && right && Math.abs(left.latitude - right.latitude) <= 0.001 && Math.abs(left.longitude - right.longitude) <= 0.001; }
function has(field, value) { return field === "coordinates" ? value?.latitude != null && value?.longitude != null : value != null && String(value).trim() !== ""; }
function same(field, left, right) {
  if (!has(field, left) || !has(field, right)) return true;
  if (field === "coordinates") return equalCoordinates(left, right);
  if (field === "officialUrl") return normalizeUrl(left) === normalizeUrl(right);
  return normalizeText(String(left)) === normalizeText(String(right));
}
function printable(value) { return value && typeof value === "object" ? `${value.latitude}, ${value.longitude}` : value ?? ""; }
function csv(value) { const text = Array.isArray(value) ? value.join(" | ") : value == null ? "" : String(value); return /[",\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text; }
function percentage(value, total) { return total ? `${((value / total) * 100).toFixed(1)}%` : "0.0%"; }

async function selectSample(db, requested) {
  const quotas = requested <= 5 ? { A: 2, B: 2, C: 1 } : { A: 7, B: 7, C: 6 };
  const rows = [];
  for (const tier of ["A", "B", "C"]) {
    const { data, error } = await db.from("venues")
      .select("id,name,effective_priority_tier,address,postal_code,latitude,longitude,official_url,inception_year,best_wikidata_candidate_qid,wikidata_match_status")
      .eq("effective_priority_tier", tier).eq("wikidata_match_status", "matched").not("best_wikidata_candidate_qid", "is", null)
      .is("merged_into_venue_id", null).or("address.is.null,postal_code.is.null").order("name").limit(quotas[tier]);
    if (error) throw error;
    rows.push(...data);
  }
  return rows.slice(0, requested);
}

function coverage(rows, source) {
  return Object.fromEntries(FIELDS.map((field) => [field, rows.filter((row) => has(field, source === "before" ? row.wikidata[field] : row.wikidata[field] || row.wikipedia[field])).length]));
}

function report(rows, before, after, errors) {
  const articleRows = rows.filter((row) => row.wikipediaTitle);
  const conflicts = rows.flatMap((row) => row.conflicts.map((field) => ({ venue: row.venueName, field, wikidata: printable(row.wikidata[field]), wikipedia: printable(row.wikipedia[field]) })));
  const noFields = rows.filter((row) => !row.newFields.length);
  const detail = rows.map((row) => `| ${row.venueName} | ${row.priorityTier} | ${row.wikidataQid} | ${row.wikipediaTitle || "—"} | ${row.newFields.join(", ") || "—"} | ${row.conflicts.join(", ") || "—"} |`).join("\n");
  const coverageTable = FIELDS.map((field) => `| ${LABELS[field]} | ${before[field]} / ${rows.length} (${percentage(before[field], rows.length)}) | ${after[field]} / ${rows.length} (${percentage(after[field], rows.length)}) | +${after[field] - before[field]} |`).join("\n");
  const conflictList = conflicts.length ? conflicts.map((item) => `- ${item.venue} / ${LABELS[item.field]}: Wikidata=\`${item.wikidata}\` / Wikipedia=\`${item.wikipedia}\``).join("\n") : "- なし";
  const failures = rows.filter((row) => !row.wikipediaTitle || row.notes.length).map((row) => `- ${row.venueName}: ${row.notes.join("; ") || "Wikipedia article not found"}`).join("\n") || "- なし";
  const gains = Object.fromEntries(FIELDS.map((field) => [field, after[field] - before[field]]));
  const addressGainRate = gains.address / Math.max(1, rows.length - before.address);
  const postalGainRate = gains.postalCode / Math.max(1, rows.length - before.postalCode);
  return `# Venue Wikipedia / MediaWiki API Coverage Test

## Summary

- Test date: ${new Date().toISOString()}
- Sample: ${rows.length} venues (Tier A: ${rows.filter((row) => row.priorityTier === "A").length}, B: ${rows.filter((row) => row.priorityTier === "B").length}, C: ${rows.filter((row) => row.priorityTier === "C").length})
- Selection: Wikidata matched, QID present, and address or postal code missing
- Wikipedia page identification: ${articleRows.length} / ${rows.length} (${percentage(articleRows.length, rows.length)})
- Conflicts: ${conflicts.length}
- Safety: LOCAL DB was read with SELECT only. No DB, Storage, migration, crawler, STG, or Production write was performed.

## Method

1. Resolve each existing QID with Wikidata \`wbgetentities\` and read \`jawiki\`, falling back to \`enwiki\` only when Japanese is absent.
2. Retrieve the identified article through the documented MediaWiki Action API \`action=query&prop=revisions|coordinates|info\` with \`rvslots=main&rvprop=content\`.
3. Prefer explicit Infobox/template fields. Unclear free prose is not inferred, and missing values remain null.
4. Compare facts read directly from Wikidata claims with Wikipedia facts. Conflicting non-empty values are reported, not resolved.

## Coverage Before / After

| Field | Wikidata only | Wikidata + Wikipedia | Gain |
| --- | ---: | ---: | ---: |
${coverageTable}

## Per Venue

| Venue | Tier | QID | Wikipedia | New fields from Wikipedia | Conflicts |
| --- | --- | --- | --- | --- | --- |
${detail}

## Conflicts

${conflictList}

## Wikipediaでも補完できなかったVenue

${noFields.map((row) => `- ${row.venueName}: ${row.notes.join("; ") || "new target fields not found"}`).join("\n") || "- なし"}

## 取得失敗理由

${failures}
${errors.length ? `\nAPI errors:\n${errors.map((error) => `- ${error}`).join("\n")}` : ""}

## Sourceとしての評価

Wikipedia is suitable as a **read-only fallback candidate source** when the venue already has a Wikidata QID and a corresponding sitelink. It should not replace Official Website as the higher-priority source. Structured Infobox coverage is useful, but template naming and field formatting vary, and article facts can be older than official information. Conflicts must remain unresolved until a higher-priority source or human judgment is available.

Recommended acquisition order: Wikidata → Wikipedia / MediaWiki API → Official Website → AI / Manual. Conflict priority: Manual > Official Website > Wikipedia > Wikidata.

## A〜Cへ適用した場合の改善見込み

Within this deliberately missing-field-heavy sample, Wikipedia recovered ${(addressGainRate * 100).toFixed(1)}% of Wikidata address gaps and ${(postalGainRate * 100).toFixed(1)}% of postal-code gaps. Applying the fallback to all A〜C venues with a confirmed QID should improve those fields, but this 20-row stratified sample is too small for an exact total. Use these observed recovery rates as a directional estimate only, and retain field provenance as \`source_type=wikipedia\` with the article URL if implementation is later approved.

## Official API references

- [MediaWiki Action API](https://www.mediawiki.org/wiki/API:Main_page)
- [Revisions API](https://www.mediawiki.org/wiki/API:Revisions)
- [Parsing wikitext](https://www.mediawiki.org/wiki/API:Parsing_wikitext)
`;
}

async function main() {
  if (!Number.isInteger(limit) || limit < 1 || limit > 20) throw new Error("--limit must be between 1 and 20");
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) throw new Error("Supabase LOCAL environment variables are required");
  const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
  const venues = await selectSample(db, limit);
  const entities = await getWikidataEntities(venues.map((venue) => venue.best_wikidata_candidate_qid));
  const rows = []; const errors = [];
  for (const venue of venues) {
    const entity = entities[venue.best_wikidata_candidate_qid];
    const site = entity?.sitelinks?.jawiki ? { language: "ja", title: entity.sitelinks.jawiki.title } : entity?.sitelinks?.enwiki ? { language: "en", title: entity.sitelinks.enwiki.title } : null;
    const wikidata = {
      address: stringClaim(entity, "P6375"), postalCode: stringClaim(entity, "P281"), coordinates: coordinatesClaim(entity),
      officialUrl: stringClaim(entity, "P856"), openingYear: yearClaim(entity, "P1619") ?? yearClaim(entity, "P571"),
    };
    let page = null; let parsed = { fields: {}, notes: [] };
    try {
      if (site) { page = await getWikipediaPage(site.title, site.language); if (page) parsed = parseWikipedia(page.wikitext, page.coordinates); }
    } catch (error) { errors.push(`${venue.name}: ${error instanceof Error ? error.message : "Wikipedia API failed"}`); }
    const wikipedia = { address: null, postalCode: null, coordinates: null, officialUrl: null, openingYear: null, openingHours: null, closedDays: null, ...parsed.fields };
    const newFields = FIELDS.filter((field) => !has(field, wikidata[field]) && has(field, wikipedia[field]));
    const conflicts = FIELDS.filter((field) => has(field, wikidata[field]) && has(field, wikipedia[field]) && !same(field, wikidata[field], wikipedia[field]));
    const notes = [...parsed.notes];
    if (!site) notes.push("QID has no ja/en Wikipedia sitelink");
    else if (!page) notes.push("Wikipedia page could not be retrieved");
    if (page && !newFields.length) notes.push("no new requested field in explicit Infobox/page metadata");
    rows.push({ venueId: venue.id, venueName: venue.name, priorityTier: venue.effective_priority_tier, wikidataQid: venue.best_wikidata_candidate_qid, wikipediaTitle: page?.title || null, wikipediaUrl: page?.url || null, wikipediaLanguage: site?.language || null, wikidata, wikipedia, newFields, conflicts, notes });
    console.log(`checked ${rows.length}/${venues.length}: ${venue.name}`);
    await sleep(100);
  }
  const headers = ["venue_id", "venue_name", "priority_tier", "wikidata_qid", "wikipedia_title", "wikipedia_url", "wikidata_address", "wikipedia_address", "wikidata_postal_code", "wikipedia_postal_code", "wikidata_latitude", "wikidata_longitude", "wikipedia_latitude", "wikipedia_longitude", "wikidata_official_url", "wikipedia_official_url", "wikidata_opening_year", "wikipedia_opening_year", "new_fields_from_wikipedia", "conflicts", "notes"];
  const csvRows = rows.map((row) => [row.venueId, row.venueName, row.priorityTier, row.wikidataQid, row.wikipediaTitle, row.wikipediaUrl, row.wikidata.address, row.wikipedia.address, row.wikidata.postalCode, row.wikipedia.postalCode, row.wikidata.coordinates?.latitude, row.wikidata.coordinates?.longitude, row.wikipedia.coordinates?.latitude, row.wikipedia.coordinates?.longitude, row.wikidata.officialUrl, row.wikipedia.officialUrl, row.wikidata.openingYear, row.wikipedia.openingYear, row.newFields, row.conflicts, row.notes].map(csv).join(","));
  await mkdir(dirname(outputPath), { recursive: true });
  await writeFile(outputPath, `${headers.join(",")}\n${csvRows.join("\n")}\n`, "utf8");
  const before = coverage(rows, "before"); const after = coverage(rows, "after");
  if (writeReport) { await mkdir(dirname(reportPath), { recursive: true }); await writeFile(reportPath, report(rows, before, after, errors), "utf8"); }
  console.log(JSON.stringify({ sample: rows.length, wikipediaPages: rows.filter((row) => row.wikipediaTitle).length, before, after, conflicts: rows.reduce((sum, row) => sum + row.conflicts.length, 0), withoutNewFields: rows.filter((row) => !row.newFields.length).map((row) => row.venueName), errors, outputPath, reportPath: writeReport ? reportPath : null }, null, 2));
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
