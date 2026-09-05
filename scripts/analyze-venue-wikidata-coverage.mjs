#!/usr/bin/env node

import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import https from "node:https";
import { createClient } from "@supabase/supabase-js";

const STRICT_THRESHOLD = 0.85;
const REVIEW_THRESHOLD = 0.6;
const DEFAULT_OUTPUT = "tmp/venue-wikidata-coverage.csv";
const DEFAULT_REPORT = "docs/research/venue-wikidata-coverage.md";
const USER_AGENT = "MuuzeeWikidataCoverageTest/1.0 (research; https://github.com/keianduu/muuzee)";

function arg(name, fallback = null) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : fallback;
}

const requestedLimit = arg("--limit", "all");
const limit = requestedLimit === "all" ? null : Number.parseInt(requestedLimit, 10);
const outputPath = resolve(arg("--output", DEFAULT_OUTPUT));
const reportPath = resolve(arg("--report", DEFAULT_REPORT));
const shouldWriteReport = process.argv.includes("--write-report");

function sleep(ms) { return new Promise((resolvePromise) => setTimeout(resolvePromise, ms)); }

function nativeGetJson(url) {
  return new Promise((resolvePromise, reject) => {
    const request = https.get(url, {
      family: 4,
      headers: { Accept: "application/json", "User-Agent": USER_AGENT },
      timeout: 60_000,
    }, (response) => {
      const chunks = [];
      response.on("data", (chunk) => chunks.push(chunk));
      response.on("end", () => {
        if (!response.statusCode || response.statusCode < 200 || response.statusCode >= 300) {
          reject(new Error(`Wikidata HTTP ${response.statusCode || "unknown"}`));
          return;
        }
        try { resolvePromise(JSON.parse(Buffer.concat(chunks).toString("utf8"))); }
        catch (error) { reject(error); }
      });
    });
    request.on("timeout", () => request.destroy(new Error("Wikidata request timed out")));
    request.on("error", reject);
  });
}

async function fetchJson(url) {
  let lastError;
  for (let attempt = 1; attempt <= 4; attempt += 1) {
    try {
      const response = await fetch(url, { headers: { Accept: "application/json", "User-Agent": USER_AGENT }, signal: AbortSignal.timeout(60_000) });
      if (!response.ok) throw new Error(`Wikidata HTTP ${response.status}`);
      return await response.json();
    } catch (error) {
      lastError = error;
      try { return await nativeGetJson(url); }
      catch (nativeError) { lastError = nativeError; }
      await sleep(500 * attempt);
    }
  }
  throw lastError;
}

function normalizeName(value) {
  return (value || "").normalize("NFKC").toLowerCase()
    .replace(/公益財団法人|一般財団法人|独立行政法人|国立研究開発法人/g, "")
    .replace(/[\s・･._‐‑‒–—―ー()（）「」『』\[\]［］]/g, "");
}

function normalizeDomain(value) {
  if (!value) return null;
  try { return new URL(value).hostname.toLowerCase().replace(/^www\./, ""); }
  catch { return null; }
}

function bigrams(value) {
  const normalized = normalizeName(value);
  if (normalized.length < 2) return new Set(normalized ? [normalized] : []);
  return new Set(Array.from({ length: normalized.length - 1 }, (_, index) => normalized.slice(index, index + 2)));
}

function diceSimilarity(left, right) {
  const a = bigrams(left);
  const b = bigrams(right);
  if (!a.size || !b.size) return 0;
  let overlap = 0;
  for (const token of a) if (b.has(token)) overlap += 1;
  return (2 * overlap) / (a.size + b.size);
}

function dataValue(statement) { return statement?.mainsnak?.datavalue?.value ?? null; }
function firstClaim(entity, property) { return dataValue(entity?.claims?.[property]?.[0]); }
function entityId(value) { return value && typeof value === "object" && value.id ? String(value.id) : null; }
function allEntityIds(entity, property) { return (entity?.claims?.[property] || []).map(dataValue).map(entityId).filter(Boolean); }
function stringClaim(entity, property) {
  const value = firstClaim(entity, property);
  if (typeof value === "string") return value;
  if (value && typeof value === "object" && typeof value.text === "string") return value.text;
  return null;
}
function timeYear(entity, property) {
  const value = firstClaim(entity, property);
  const match = typeof value?.time === "string" ? value.time.match(/^([+-]\d{4,})-/) : null;
  return match ? Number.parseInt(match[1], 10) : null;
}

function labels(entity) {
  return {
    labelJa: entity?.labels?.ja?.value || null,
    labelEn: entity?.labels?.en?.value || null,
    aliases: [...(entity?.aliases?.ja || []), ...(entity?.aliases?.en || [])].map((item) => item.value),
    description: entity?.descriptions?.ja?.value || entity?.descriptions?.en?.value || null,
  };
}

function coordinate(entity) {
  const value = firstClaim(entity, "P625");
  return value && typeof value.latitude === "number" && typeof value.longitude === "number"
    ? { latitude: value.latitude, longitude: value.longitude }
    : { latitude: null, longitude: null };
}

function hasOpeningSchedule(entity) {
  const statements = entity?.claims?.P3025 || [];
  return statements.length > 0 || statements.some((statement) => statement.qualifiers?.P8626?.length || statement.qualifiers?.P8627?.length);
}

function currentMuuzeeScore(venue, candidate) {
  const reasons = [];
  let confidence = 0;
  // Keep the formal score aligned with src/lib/wikidata/matcher.ts: the local
  // canonical name is the exact-name input. Extra names are analysis-only.
  const venueNames = [venue.name].filter(Boolean);
  const candidateNames = [candidate.labelJa, candidate.labelEn, ...candidate.aliases].filter(Boolean);
  const exact = venueNames.some((venueName) => candidateNames.some((candidateName) => normalizeName(venueName) === normalizeName(candidateName)));
  if (exact) { confidence += 0.6; reasons.push("normalized name exact match"); }
  const venueDomain = normalizeDomain(venue.official_url);
  const candidateDomain = normalizeDomain(candidate.officialUrl);
  if (venueDomain && candidateDomain && venueDomain === candidateDomain) { confidence += 0.25; reasons.push("official domain exact match"); }
  else if (venueDomain && candidateDomain && venueDomain !== candidateDomain) { confidence -= 0.15; reasons.push("official domain mismatch"); }
  if (/美術館|博物館|museum|gallery/i.test(candidate.description || "")) { confidence += 0.1; reasons.push("entity description identifies a museum or gallery"); }
  if (candidate.countryId === "Q17" || /日本|東京都|北海道|府|県|市|区/.test(candidate.description || "")) { confidence += 0.1; reasons.push("Japan location signal"); }
  if (venue.prefecture && (candidate.description || "").includes(venue.prefecture)) { confidence += 0.08; reasons.push("prefecture match"); }
  if (venue.city && (candidate.description || "").includes(venue.city)) { confidence += 0.07; reasons.push("city match"); }
  return { confidence: Math.max(0, Math.min(1, Number(confidence.toFixed(2)))), reasons, exact };
}

function scoreCandidate(venue, candidate) {
  const current = currentMuuzeeScore(venue, candidate);
  const localNames = [venue.name, venue.name_en, ...(venue.aliases || [])].filter(Boolean);
  const remoteNames = [candidate.labelJa, candidate.labelEn, ...candidate.aliases].filter(Boolean);
  const similarity = Math.max(0, ...localNames.flatMap((left) => remoteNames.map((right) => diceSimilarity(left, right))));
  const typeSignal = /美術館|博物館|museum|gallery|art center|文化館|記念館|展示|芸術|文化施設/i.test(`${candidate.description || ""} ${candidate.typeLabels.join(" ")}`);
  const rankBonus = Math.max(0, 0.1 - candidate.searchRank * 0.015);
  let analysisConfidence = current.confidence;
  if (!current.exact) {
    // Fuzzy-name evidence is useful for review, but must never outrank a clean
    // exact-name candidate or appear equivalent to the formal 0.85 boundary.
    analysisConfidence = Math.max(analysisConfidence, Math.min(0.79, similarity * 0.7 + (typeSignal ? 0.12 : 0) + rankBonus));
  }
  analysisConfidence = Math.max(0, Math.min(1, Number(analysisConfidence.toFixed(2))));
  const reasons = [...current.reasons];
  if (!current.exact && similarity >= 0.45) reasons.push(`name similarity ${similarity.toFixed(2)}`);
  if (typeSignal && !reasons.some((reason) => reason.includes("museum or gallery"))) reasons.push("entity type/description is a cultural venue");
  reasons.push(`Wikidata search rank ${candidate.searchRank + 1}`);
  return { ...candidate, muuzeeConfidence: current.confidence, analysisConfidence, reasons, typeSignal };
}

function geographicGroup(venue) {
  const localText = [venue.prefecture, venue.city, venue.address, venue.region, venue.district].filter(Boolean).join(" ");
  if (venue.country_code && venue.country_code !== "JP") return "Overseas";
  if (/東京/.test(localText)) return "Tokyo";
  if (venue.country_code === "JP" || localText) return "Other Japan";
  return "Unknown";
}

function csv(value) {
  const string = value == null ? "" : Array.isArray(value) ? value.join(" | ") : String(value);
  return /[",\n]/.test(string) ? `"${string.replaceAll('"', '""')}"` : string;
}

function percent(numerator, denominator) { return denominator ? `${((numerator / denominator) * 100).toFixed(1)}%` : "0.0%"; }
function bool(value) { return value ? "true" : "false"; }
function wikiUrl(qid) { return qid ? `https://www.wikidata.org/wiki/${qid}` : ""; }
function commonsFileUrl(filename) { return filename ? `https://commons.wikimedia.org/wiki/File:${encodeURIComponent(filename.replaceAll(" ", "_"))}` : ""; }

async function searchIds(term, language = "ja") {
  const url = new URL("https://www.wikidata.org/w/api.php");
  Object.entries({ action: "wbsearchentities", search: term, language, uselang: language, type: "item", limit: "10", format: "json", origin: "*" }).forEach(([key, value]) => url.searchParams.set(key, value));
  const payload = await fetchJson(url);
  return (payload.search || []).map((item) => item.id);
}

async function getEntities(ids) {
  const result = new Map();
  for (let index = 0; index < ids.length; index += 50) {
    const chunk = ids.slice(index, index + 50);
    const url = new URL("https://www.wikidata.org/w/api.php");
    Object.entries({ action: "wbgetentities", ids: chunk.join("|"), props: "labels|descriptions|aliases|claims", languages: "ja|en", format: "json", origin: "*" }).forEach(([key, value]) => url.searchParams.set(key, value));
    const payload = await fetchJson(url);
    for (const [id, entity] of Object.entries(payload.entities || {})) result.set(id, entity);
    await sleep(120);
  }
  return result;
}

function makeCandidate(id, entity, searchRank, referenceLabels) {
  const text = labels(entity);
  const coords = coordinate(entity);
  const typeIds = allEntityIds(entity, "P31");
  const countryId = entityId(firstClaim(entity, "P17"));
  const adminIds = allEntityIds(entity, "P131");
  const p18 = stringClaim(entity, "P18");
  const inceptionYear = timeYear(entity, "P571");
  const officialOpeningYear = timeYear(entity, "P1619");
  return {
    id,
    ...text,
    searchRank,
    officialUrl: stringClaim(entity, "P856"),
    countryId,
    countryLabel: referenceLabels.get(countryId) || null,
    typeLabels: typeIds.map((typeId) => referenceLabels.get(typeId) || typeId),
    adminLabels: adminIds.map((adminId) => referenceLabels.get(adminId) || adminId),
    streetAddress: stringClaim(entity, "P6375"),
    postalCode: stringClaim(entity, "P281"),
    ...coords,
    p18,
    commonsCategory: stringClaim(entity, "P373"),
    openingHoursAvailable: hasOpeningSchedule(entity),
    inceptionYear,
    officialOpeningYear,
  };
}

function fieldAvailable(candidate, field) {
  if (!candidate) return false;
  const map = {
    nameJa: Boolean(candidate.labelJa), nameEn: Boolean(candidate.labelEn), aliases: candidate.aliases.length > 0,
    type: candidate.typeLabels.length > 0, country: Boolean(candidate.countryId), adminArea: candidate.adminLabels.length > 0,
    address: Boolean(candidate.streetAddress), postalCode: Boolean(candidate.postalCode),
    coordinates: candidate.latitude != null && candidate.longitude != null, officialUrl: Boolean(candidate.officialUrl),
    p18: Boolean(candidate.p18), commonsCategory: Boolean(candidate.commonsCategory), openingHours: candidate.openingHoursAvailable,
    inception: candidate.inceptionYear != null || candidate.officialOpeningYear != null,
  };
  return map[field];
}

const FIELDS = ["nameJa", "nameEn", "aliases", "type", "country", "adminArea", "address", "postalCode", "coordinates", "officialUrl", "p18", "commonsCategory", "openingHours", "inception"];
const FIELD_LABELS = { nameJa: "Japanese name", nameEn: "English name", aliases: "Aliases", type: "Entity type", country: "Country", adminArea: "Administrative area", address: "Street address", postalCode: "Postal code", coordinates: "Coordinates", officialUrl: "Official URL", p18: "P18 image", commonsCategory: "Commons category", openingHours: "Opening schedule", inception: "Inception / opening year" };

function coverageRows(rows, statuses) {
  const eligible = rows.filter((row) => statuses.includes(row.matchStatus));
  return FIELDS.map((field) => ({ field, count: eligible.filter((row) => fieldAvailable(row.best, field)).length, total: eligible.length }));
}

function summaryBy(rows, key) {
  const groups = new Map();
  for (const row of rows) {
    const value = row[key];
    const group = groups.get(value) || { total: 0, strict: 0, possible: 0, none: 0 };
    group.total += 1;
    if (row.matchStatus === "High confidence") group.strict += 1;
    else if (row.matchStatus === "Possible") group.possible += 1;
    else group.none += 1;
    groups.set(value, group);
  }
  return groups;
}

function markdownTable(headers, rows) {
  return `| ${headers.join(" | ")} |\n| ${headers.map(() => "---").join(" | ")} |\n${rows.map((row) => `| ${row.join(" | ")} |`).join("\n")}`;
}

function makeReportBase(rows, totalDatabaseCount, smokeStages, errors) {
  const strict = rows.filter((row) => row.matchStatus === "High confidence");
  const possible = rows.filter((row) => row.matchStatus === "Possible");
  const none = rows.filter((row) => row.matchStatus === "No candidate");
  const candidates = [...strict, ...possible];
  const strictCoverage = coverageRows(rows, ["High confidence"]);
  const relaxedCoverage = coverageRows(rows, ["High confidence", "Possible"]);
  const byGeo = summaryBy(rows, "geographicGroup");
  const byType = summaryBy(rows, "venueType");
  const reasonCounts = new Map();
  for (const row of none) {
    for (const reason of row.notes) reasonCounts.set(reason, (reasonCounts.get(reason) || 0) + 1);
  }
  const fieldTable = FIELDS.map((field) => {
    const a = strictCoverage.find((item) => item.field === field);
    const b = relaxedCoverage.find((item) => item.field === field);
    return [FIELD_LABELS[field], `${a.count} / ${a.total} (${percent(a.count, a.total)})`, `${b.count} / ${b.total} (${percent(b.count, b.total)})`];
  });
  const typeTable = [...byType.entries()].map(([name, group]) => [name, group.total, group.strict, group.possible, group.none, `${group.strict + group.possible} / ${group.total} (${percent(group.strict + group.possible, group.total)})`]);
  const geoTable = [...byGeo.entries()].map(([name, group]) => [name, group.total, group.strict, group.possible, group.none, `${group.strict + group.possible} / ${group.total} (${percent(group.strict + group.possible, group.total)})`]);
  const strictMisses = possible.filter((row) => row.best?.muuzeeConfidence < STRICT_THRESHOLD).slice(0, 30);
  const unavailable = (field) => rows.filter((row) => row.matchStatus === "No candidate" || !fieldAvailable(row.best, field));
  const sourceEvaluation = candidates.length / rows.length >= 0.8 && strict.length / rows.length >= 0.6
    ? "Source Aとして非常に強い"
    : candidates.length / rows.length >= 0.6
      ? "Source Aとして利用可能（人手確認前提）"
      : "Source Aとして不足が大きい";
  const list = (items, formatter = (row) => `${row.venueName} (${row.venueId})`) => items.length ? items.map((item) => `- ${formatter(item)}`).join("\n") : "- なし";
  return `# Venue Wikidata Coverage Test\n\n## 1. Test date\n\n- ${new Date().toISOString()}\n- Local database venue count: ${totalDatabaseCount}\n- Evaluated rows: ${rows.length}\n- Stages: ${smokeStages.join(" → ")}\n\n## 2. Purpose and safety\n\nThis is a read-only coverage measurement for evaluating Wikidata as Venue Master Source A. The script only selected local \`venues\` rows and called Wikidata read APIs. It did not write to the database, Storage, candidate tables, staging, or production.\n\n## 3. Methodology\n\n- Search terms: local \`name\`, \`name_en\`, and aliases.\n- Matching evidence: normalized names, aliases, official-domain agreement, local address/prefecture/city signals when present, country/type signals, name similarity, and Wikidata search rank.\n- Top three candidates were retained in the CSV.\n- **Strict** uses the current Muuzee formal threshold (0.85).\n- **Possible** preserves plausible candidates below the formal threshold for human review; it does not adopt an entity.\n- Field coverage uses the best candidate only. Missing fields remain null; nothing is inferred.\n- Opening schedule is marked available only when Wikidata has P3025 (open days) and/or its P8626/P8627 time qualifiers. This is not assumed to be a complete visitor-hours string.\n- Opening year uses P1619 when present, otherwise P571 inception.\n\n## 4. Match coverage\n\n${markdownTable(["Class", "Count", "Rate"], [["High confidence / Strict", strict.length, percent(strict.length, rows.length)], ["Possible / human review", possible.length, percent(possible.length, rows.length)], ["No candidate", none.length, percent(none.length, rows.length)], ["Entity exists (Strict + Possible)", candidates.length, percent(candidates.length, rows.length)]])}\n\n## 5. Field coverage\n\n${markdownTable(["Field", "Strict only", "Strict + Possible"], fieldTable)}\n\n## 6. Coordinate coverage\n\n- Strict: ${strictCoverage.find((item) => item.field === "coordinates").count} / ${strict.length} (${percent(strictCoverage.find((item) => item.field === "coordinates").count, strict.length)})\n- Strict + Possible: ${relaxedCoverage.find((item) => item.field === "coordinates").count} / ${candidates.length} (${percent(relaxedCoverage.find((item) => item.field === "coordinates").count, candidates.length)})\n\n## 7. P18 coverage\n\n- Strict: ${strictCoverage.find((item) => item.field === "p18").count} / ${strict.length} (${percent(strictCoverage.find((item) => item.field === "p18").count, strict.length)})\n- Strict + Possible: ${relaxedCoverage.find((item) => item.field === "p18").count} / ${candidates.length} (${percent(relaxedCoverage.find((item) => item.field === "p18").count, candidates.length)})\n- Images were not downloaded and rights were not evaluated.\n\n## 8. Official URL coverage\n\n- Strict + Possible: ${relaxedCoverage.find((item) => item.field === "officialUrl").count} / ${candidates.length} (${percent(relaxedCoverage.find((item) => item.field === "officialUrl").count, candidates.length)})\n\n## 9. English name coverage\n\n- Strict + Possible: ${relaxedCoverage.find((item) => item.field === "nameEn").count} / ${candidates.length} (${percent(relaxedCoverage.find((item) => item.field === "nameEn").count, candidates.length)})\n\n## 10. Venue type coverage\n\n${markdownTable(["Local type", "Total", "Strict", "Possible", "None", "Entity coverage"], typeTable)}\n\nThe local source currently classifies all or most imported venues as \`other\`; this limits type-specific conclusions and no Wikidata type was copied back into Muuzee.\n\n## 11. Geographic coverage\n\n${markdownTable(["Local geography", "Total", "Strict", "Possible", "None", "Entity coverage"], geoTable)}\n\nGeography uses only local country/address fields. Unknown rows were not guessed from a Wikidata candidate.\n\n## 12. Main failure reasons\n\n${markdownTable(["Reason", "Count"], [...reasonCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10))}\n\n## 13. Wikidata entity found but current strict matcher rejects it\n\nPossible candidates below 0.85: ${possible.length}. Examples (up to 30):\n\n${list(strictMisses, (row) => `${row.venueName} → [${row.best.id}](${wikiUrl(row.best.id)}) / Muuzee ${row.best.muuzeeConfidence.toFixed(2)}, analysis ${row.best.analysisConfidence.toFixed(2)} / ${row.best.reasons.join("; ")}`)}\n\n## 14. No plausible Wikidata entity found\n\n${list(none)}\n\n## 15. Candidate venues missing coordinates\n\n${list(unavailable("coordinates"), (row) => `${row.venueName} → ${row.best ? `[${row.best.id}](${wikiUrl(row.best.id)})` : "no candidate"}`)}\n\n## 16. Candidate venues missing P18\n\n${list(unavailable("p18"), (row) => `${row.venueName} → ${row.best ? `[${row.best.id}](${wikiUrl(row.best.id)})` : "no candidate"}`)}\n\n## 17. Source A evaluation\n\n**${sourceEvaluation}.** Item coverage is ${candidates.length} / ${rows.length} (${percent(candidates.length, rows.length)}). This measures candidate existence, not safe automatic adoption. Field completeness is materially lower for sparse properties, so Wikidata should be treated as an identity-and-reference source with human review rather than a self-sufficient production venue record.\n\n## 18. Fields to complement with Source B\n\nPriority should follow the observed Strict + Possible gaps:\n\n${list(relaxedCoverage.sort((a, b) => a.count / Math.max(1, a.total) - b.count / Math.max(1, b.total)), (item) => `${FIELD_LABELS[item.field]}: missing ${item.total - item.count} / ${item.total}`)}\n\nLikely complements are official venue websites, trusted public/municipal datasets, and a geocoding source. Any imported fact still needs provenance and human review appropriate to its use.\n\n## 19. P18 candidates\n\n${list(candidates.filter((row) => row.best?.p18), (row) => `${row.venueName}: [${row.best.p18}](${commonsFileUrl(row.best.p18)}) / [${row.best.id}](${wikiUrl(row.best.id)}) / confidence ${row.best.analysisConfidence.toFixed(2)}`)}\n\n## 20. Errors\n\n${errors.length ? list(errors, (error) => error) : "- None"}\n\n## Sources and property interpretation\n\n- [Wikidata API](https://www.wikidata.org/w/api.php)\n- [coordinate location (P625)](https://www.wikidata.org/wiki/Property:P625)\n- [image (P18)](https://www.wikidata.org/wiki/Property:P18)\n- [official website (P856)](https://www.wikidata.org/wiki/Property:P856)\n- [street address (P6375)](https://www.wikidata.org/wiki/Property:P6375)\n- [postal code (P281)](https://www.wikidata.org/wiki/Property:P281)\n- [Commons category (P373)](https://www.wikidata.org/wiki/Property:P373)\n- [open days (P3025)](https://www.wikidata.org/wiki/Property:P3025) with [opening time (P8626)](https://www.wikidata.org/wiki/Property:P8626) and [closing time (P8627)](https://www.wikidata.org/wiki/Property:P8627)\n- [inception (P571)](https://www.wikidata.org/wiki/Property:P571) and [date of official opening (P1619)](https://www.wikidata.org/wiki/Property:P1619)\n`;
}

function makeReport(...args) {
  const [rows] = args;
  let report = makeReportBase(...args)
    .replace("## 15. Candidate venues missing coordinates", "## 15. Venues missing coordinates")
    .replace("## 16. Candidate venues missing P18", "## 16. Venues missing P18");
  for (const row of rows.filter((item) => item.matchStatus === "No candidate" && item.best)) {
    const candidateText = `[${row.best.id}](${wikiUrl(row.best.id)})`;
    report = report.replaceAll(`- ${row.venueName} → ${candidateText}`, `- ${row.venueName} → no plausible candidate`);
  }
  return report;
}

async function main() {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) throw new Error("NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required");
  if (limit != null && (!Number.isInteger(limit) || limit <= 0)) throw new Error("--limit must be a positive integer or all");
  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
  const { count: totalDatabaseCount, error: countError } = await supabase.from("venues").select("id", { count: "exact", head: true });
  if (countError) throw countError;
  let query = supabase.from("venues").select("id,name,name_en,name_native,aliases,venue_type,postal_code,prefecture,city,address,country_code,region,district,official_url,updated_at").order("name", { ascending: true });
  if (limit != null) query = query.limit(limit);
  const { data: venues, error } = await query;
  if (error) throw error;

  const searchResults = new Map();
  const errors = [];
  for (let index = 0; index < venues.length; index += 1) {
    const venue = venues[index];
    const rawTerms = [venue.name, venue.name_en, ...(venue.aliases || [])].filter(Boolean);
    const terms = [...new Set(rawTerms.flatMap((term) => {
      const noQualifier = term.replace(/\s*[\[［(（].*$/, "").trim();
      const noLegalPrefix = noQualifier.replace(/^(公益財団法人|一般財団法人|独立行政法人|国立研究開発法人|株式会社)\s*/, "").trim();
      const beforeSeparator = noLegalPrefix.split(/\s+[・･／/]|[・･／/]\s+|\s{1,}/)[0]?.trim();
      const core = noLegalPrefix.replace(/(写真美術館|ガラスミュージアム|現代美術センター|美術館|博物館|ミュージアム|ギャラリー|アートセンター|芸術センター|記念館|センター).*$/, "").trim();
      return [term, noQualifier, noLegalPrefix, term.replaceAll("+", " ").trim(), beforeSeparator, core];
    }).filter((term) => term && term.length >= 2))].slice(0, 8);
    const ids = [];
    for (const term of terms) {
      try {
        const languages = /[A-Za-z]/.test(term) ? ["en", "ja"] : ["ja", "en"];
        for (const language of languages) {
          for (const id of await searchIds(term, language)) if (!ids.includes(id)) ids.push(id);
          if (ids.length >= 12) break;
          await sleep(80);
        }
      } catch (searchError) {
        errors.push(`${venue.name}: ${searchError.message}`);
      }
      await sleep(120);
      // Only use progressively looser term variants when the more precise term
      // returned nothing. One search response can still contribute up to 10 rows.
      if (ids.length > 0) break;
    }
    searchResults.set(venue.id, ids.slice(0, 12));
    if ((index + 1) % 10 === 0 || index + 1 === venues.length) console.log(`searched ${index + 1}/${venues.length}`);
  }

  const allIds = [...new Set([...searchResults.values()].flat())];
  const entities = await getEntities(allIds);
  const referenceIds = [...new Set([...entities.values()].flatMap((entity) => [...allEntityIds(entity, "P31"), ...allEntityIds(entity, "P131"), ...allEntityIds(entity, "P17")]))];
  const references = await getEntities(referenceIds);
  const referenceLabels = new Map([...references.entries()].map(([id, entity]) => [id, entity.labels?.ja?.value || entity.labels?.en?.value || id]));

  const rows = venues.map((venue) => {
    const ranked = (searchResults.get(venue.id) || []).flatMap((id, searchRank) => {
      const entity = entities.get(id);
      return entity ? [scoreCandidate(venue, makeCandidate(id, entity, searchRank, referenceLabels))] : [];
    }).sort((a, b) => b.analysisConfidence - a.analysisConfidence || a.searchRank - b.searchRank).slice(0, 3);
    const best = ranked[0] || null;
    let matchStatus = "No candidate";
    if (best?.muuzeeConfidence >= STRICT_THRESHOLD) matchStatus = "High confidence";
    else if (best && (best.muuzeeConfidence >= REVIEW_THRESHOLD || (best.analysisConfidence >= REVIEW_THRESHOLD && best.typeSignal))) matchStatus = "Possible";
    const notes = [];
    if (!best) notes.push("Wikidata search returned no entity");
    else if (matchStatus === "No candidate") {
      if (best.analysisConfidence < REVIEW_THRESHOLD) notes.push("candidate confidence below relaxed threshold");
      if (!best.typeSignal) notes.push("candidate lacks a cultural-venue type signal");
      if (!best.reasons.some((reason) => reason.includes("exact match"))) notes.push("no exact normalized name or alias match");
    }
    return { venueId: venue.id, venueName: venue.name, venueType: venue.venue_type, address: venue.address, geographicGroup: geographicGroup(venue), matchStatus, candidates: ranked, best, notes };
  });

  const headers = ["muuzee_venue_id","venue_name","venue_type","address","geographic_group","match_status","best_qid","best_label","match_confidence","muuzee_strict_confidence","match_reason","best_wikidata_url","name_ja_available","name_ja","name_en_available","name_en","aliases_available","aliases","entity_type_available","entity_types","country_available","country","admin_area_available","admin_areas","address_available","wikidata_street_address","postal_code_available","postal_code","coordinates_available","latitude","longitude","official_url_available","official_url","p18_available","p18_filename","p18_commons_url","commons_category_available","commons_category","opening_hours_available","opening_year","inception_available","second_candidate_qid","second_candidate_label","second_candidate_confidence","third_candidate_qid","third_candidate_label","third_candidate_confidence","notes"];
  const csvRows = rows.map((row) => {
    const [best, second, third] = row.candidates;
    const values = [row.venueId,row.venueName,row.venueType,row.address,row.geographicGroup,row.matchStatus,best?.id,best?.labelJa || best?.labelEn,best?.analysisConfidence,best?.muuzeeConfidence,best?.reasons,best ? wikiUrl(best.id) : "",bool(fieldAvailable(best,"nameJa")),best?.labelJa,bool(fieldAvailable(best,"nameEn")),best?.labelEn,bool(fieldAvailable(best,"aliases")),best?.aliases,bool(fieldAvailable(best,"type")),best?.typeLabels,bool(fieldAvailable(best,"country")),best?.countryLabel || best?.countryId,bool(fieldAvailable(best,"adminArea")),best?.adminLabels,bool(fieldAvailable(best,"address")),best?.streetAddress,bool(fieldAvailable(best,"postalCode")),best?.postalCode,bool(fieldAvailable(best,"coordinates")),best?.latitude,best?.longitude,bool(fieldAvailable(best,"officialUrl")),best?.officialUrl,bool(fieldAvailable(best,"p18")),best?.p18,best?.p18 ? commonsFileUrl(best.p18) : "",bool(fieldAvailable(best,"commonsCategory")),best?.commonsCategory,bool(fieldAvailable(best,"openingHours")),best?.officialOpeningYear ?? best?.inceptionYear,bool(fieldAvailable(best,"inception")),second?.id,second?.labelJa || second?.labelEn,second?.analysisConfidence,third?.id,third?.labelJa || third?.labelEn,third?.analysisConfidence,row.notes];
    return values.map(csv).join(",");
  });
  await mkdir(dirname(outputPath), { recursive: true });
  await writeFile(outputPath, `${headers.join(",")}\n${csvRows.join("\n")}\n`, "utf8");
  if (shouldWriteReport) {
    await mkdir(dirname(reportPath), { recursive: true });
    await writeFile(reportPath, makeReport(rows, totalDatabaseCount, ["5 smoke", "20 sample", `${rows.length} full`], errors), "utf8");
  }
  const counts = Object.fromEntries(["High confidence", "Possible", "No candidate"].map((status) => [status, rows.filter((row) => row.matchStatus === status).length]));
  console.log(JSON.stringify({ totalDatabaseCount, evaluated: rows.length, counts, errors: errors.length, outputPath, reportPath: shouldWriteReport ? reportPath : null }, null, 2));
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
