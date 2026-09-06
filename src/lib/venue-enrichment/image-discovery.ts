import { createHash } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getWikidataEntities } from "@/lib/wikidata/client";
import { getCommonsImageMetadata, listCommonsCategoryFiles, listWikipediaArticleImages } from "@/lib/wikimedia-commons/client";
import { autoSetPreferredVenueCandidatePrimary } from "@/lib/admin/venue-primary-image";

export type VenueImageDiscoverySource = "wikidata_p18" | "commons_category" | "wikipedia_article";
export type DiscoveredVenueImage = { fileTitle: string; discoverySource: VenueImageDiscoverySource; score: number };

const SOURCE_PRIORITY: Record<VenueImageDiscoverySource, number> = { wikidata_p18: 3, commons_category: 2, wikipedia_article: 1 };
const EXCLUDED = /(?:\blogo\b|\bicon\b|\bmap\b|\bdiagram\b|\bposter\b|\bpainting\b|\bsculpture\b|\bartwork\b|collection[ _-]?object|commons-logo|wikimedia-logo|question_book|replace_this_image)/i;
const FACILITY = /(?:museum|gallery|building|exterior|interior|entrance|facade|hall|lobby|atrium|美術館|博物館|外観|内観|入口|エントランス|ギャラリー)/i;

function normalized(value: string) {
  return value.replace(/^(?:File|ファイル):/i, "").replace(/\.[^.]+$/, "").replace(/[_\W]+/gu, "").toLowerCase();
}

function canonicalFileTitle(value: string) {
  return value.replace(/^ファイル:/, "File:");
}

export function scoreVenueImageTitle(fileTitle: string, venueNames: string[], source: VenueImageDiscoverySource) {
  if (/\.svg$/i.test(fileTitle) || EXCLUDED.test(fileTitle)) return null;
  const compactTitle = normalized(fileTitle);
  let score = SOURCE_PRIORITY[source] * 10;
  const hasFacilitySignal = FACILITY.test(fileTitle);
  let hasNameSignal = false;
  if (hasFacilitySignal) score += 8;
  for (const name of venueNames.filter(Boolean)) {
    const compactName = normalized(name);
    if (compactName.length >= 4 && compactTitle.includes(compactName)) { score += 20; hasNameSignal = true; }
    const tokens = name.replace(/[（）()・]/g, " ").split(/[\s_-]+/).map(normalized).filter((token) => token.length >= 3);
    const matchingTokens = tokens.filter((token) => compactTitle.includes(token)).length;
    if (matchingTokens) hasNameSignal = true;
    score += Math.min(12, matchingTokens * 4);
  }
  if (source !== "wikidata_p18" && !hasFacilitySignal && !hasNameSignal) return null;
  return score;
}

export function selectVenueImageFiles(input: {
  p18: string | null;
  commonsFiles: string[];
  wikipediaFiles: string[];
  venueNames: string[];
  limit?: number;
}) {
  const found = new Map<string, DiscoveredVenueImage>();
  const consider = (fileTitle: string, discoverySource: VenueImageDiscoverySource) => {
    const score = scoreVenueImageTitle(fileTitle, input.venueNames, discoverySource);
    if (score == null) return;
    const key = normalized(fileTitle);
    const current = found.get(key);
    if (!current || SOURCE_PRIORITY[discoverySource] > SOURCE_PRIORITY[current.discoverySource] || score > current.score) {
      found.set(key, { fileTitle: canonicalFileTitle(fileTitle), discoverySource, score });
    }
  };
  if (input.p18) consider(input.p18, "wikidata_p18");
  input.commonsFiles.forEach((title) => consider(title, "commons_category"));
  input.wikipediaFiles.forEach((title) => consider(title, "wikipedia_article"));
  const p18 = [...found.values()].filter((item) => item.discoverySource === "wikidata_p18");
  const rest = [...found.values()].filter((item) => item.discoverySource !== "wikidata_p18").sort((a, b) => b.score - a.score || a.fileTitle.localeCompare(b.fileTitle));
  return [...p18, ...rest].slice(0, Math.max(1, Math.min(3, input.limit || 3)));
}

export async function discoverVenueImageFiles(input: { qid: string; venueName: string; venueNameEn?: string | null }) {
  const [entity] = await getWikidataEntities([input.qid]);
  if (!entity) return { qid: input.qid, files: [] as DiscoveredVenueImage[], trace: [{ source: "wikidata", result: "qid_missing" }] };
  const trace: Array<Record<string, unknown>> = [];
  let commonsFiles: string[] = [];
  let wikipediaFiles: string[] = [];
  if (entity.commonsCategory) {
    try { commonsFiles = await listCommonsCategoryFiles(entity.commonsCategory); trace.push({ source: "commons_category", category: entity.commonsCategory, found: commonsFiles.length }); }
    catch (error) { trace.push({ source: "commons_category", category: entity.commonsCategory, error: error instanceof Error ? error.message : "lookup failed" }); }
  } else trace.push({ source: "commons_category", result: "category_missing" });
  if (entity.wikipediaArticleTitle) {
    const language = entity.raw && typeof entity.raw === "object" && "sitelinks" in entity.raw && (entity.raw as { sitelinks?: Record<string, unknown> }).sitelinks?.jawiki ? "ja" : "en";
    try { wikipediaFiles = await listWikipediaArticleImages(entity.wikipediaArticleTitle, language); trace.push({ source: "wikipedia_article", article: entity.wikipediaArticleTitle, language, found: wikipediaFiles.length }); }
    catch (error) { trace.push({ source: "wikipedia_article", article: entity.wikipediaArticleTitle, error: error instanceof Error ? error.message : "lookup failed" }); }
  } else trace.push({ source: "wikipedia_article", result: "article_missing" });
  const files = selectVenueImageFiles({ p18: entity.imageFileTitle, commonsFiles, wikipediaFiles, venueNames: [input.venueName, input.venueNameEn || "", entity.labelJa || "", entity.labelEn || ""] });
  trace.unshift({ source: "wikidata_p18", fileTitle: entity.imageFileTitle, found: Boolean(entity.imageFileTitle) });
  return { qid: entity.id, entity, files, trace };
}

async function dataSourceId(db: SupabaseClient, key: string) {
  const { data, error } = await db.from("data_sources").select("id").eq("key", key).single();
  if (error || !data) throw error || new Error(`Missing data source: ${key}`);
  return data.id as string;
}

function preferredDiscoverySource(current: string | null | undefined, incoming: VenueImageDiscoverySource) {
  if (!current || !(current in SOURCE_PRIORITY)) return incoming;
  return SOURCE_PRIORITY[incoming] > SOURCE_PRIORITY[current as VenueImageDiscoverySource] ? incoming : current;
}

export async function saveVenueImageDiscovery(db: SupabaseClient, input: { venueId: string; qid: string; venueName: string; venueNameEn?: string | null }) {
  const discovery = await discoverVenueImageFiles(input);
  const commonsSourceId = await dataSourceId(db, "wikimedia_commons");
  let added = 0;
  const saved: Array<DiscoveredVenueImage & { candidateId: string }> = [];
  for (const file of discovery.files) {
    const metadata = await getCommonsImageMetadata(file.fileTitle);
    if (!metadata) continue;
    const externalId = `venue:${input.venueId}:${input.qid}:${metadata.fileTitle}`;
    const { data: source, error: sourceError } = await db.from("source_records").upsert({
      data_source_id: commonsSourceId, external_id: externalId, venue_id: input.venueId, source_url: metadata.sourceUrl,
      raw_payload: metadata.raw, checksum: createHash("sha256").update(JSON.stringify(metadata.raw)).digest("hex"), fetched_at: new Date().toISOString(),
    }, { onConflict: "data_source_id,external_id" }).select("id").single();
    if (sourceError || !source) throw sourceError || new Error("Commons source record could not be saved");
    const { data: prior, error: priorError } = await db.from("source_image_candidates").select("id,review_status,rights_status,discovery_source").eq("source_record_id", source.id).eq("provider", "wikimedia_commons").eq("stable_identifier", metadata.fileTitle).maybeSingle();
    if (priorError) throw priorError;
    const { data: candidate, error: candidateError } = await db.from("source_image_candidates").upsert({
      source_record_id: source.id, image_url: metadata.imageUrl, thumbnail_url: metadata.thumbnailUrl,
      provider: "wikimedia_commons", stable_identifier: metadata.fileTitle, source_url: metadata.sourceUrl,
      author: metadata.author, credit: metadata.credit, license_short_name: metadata.licenseShortName,
      license_url: metadata.licenseUrl, usage_terms: metadata.usageTerms,
      candidate_entity_id: input.qid, candidate_entity_label: input.venueName,
      candidate_match_confidence: 1, candidate_match_threshold: 1, candidate_kind: "probable",
      discovery_source: preferredDiscoverySource(prior?.discovery_source, file.discoverySource),
      contents_rights_type: metadata.licenseShortName, contents_access: metadata.usageTerms,
      review_status: prior?.review_status || "unreviewed", rights_status: prior?.rights_status || "needs_review",
      is_active: true, last_seen_at: new Date().toISOString(),
    }, { onConflict: "source_record_id,provider,stable_identifier" }).select("id").single();
    if (candidateError || !candidate) throw candidateError || new Error("Image candidate could not be saved");
    if (!prior) added += 1;
    saved.push({ ...file, candidateId: candidate.id });
  }
  if (saved.length) await autoSetPreferredVenueCandidatePrimary(input.venueId);
  return { ...discovery, saved, added };
}

export function imageDiscoveryStatus(files: DiscoveredVenueImage[]) {
  if (files.some((item) => item.discoverySource === "wikidata_p18")) return "p18_found" as const;
  if (files.some((item) => item.discoverySource === "commons_category")) return "commons_candidate_found" as const;
  if (files.some((item) => item.discoverySource === "wikipedia_article")) return "wikipedia_candidate_found" as const;
  return "no_image_found" as const;
}
