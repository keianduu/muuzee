import { createHash } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { calculateCompleteness } from "@/lib/admin/master-completeness";
import { slugify } from "@/lib/admin/slug";
import { getWikidataEntities } from "./client";
import { scoreWikidataCandidate } from "./matcher";
import type { ScoredWikidataCandidate, WikidataVenueCandidate } from "./types";
import { discoverWikidataVenuePage, discoverWikidataVenues, type DiscoveredWikidataVenue } from "./venue-discovery";
import { mapWikidataVenue } from "./venue-mapper";
import { WIKIDATA_VENUE_CLASSES } from "./venue-type-mapper";
import type { WikidataVenue, WikidataVenueImportSummary } from "./venue-import-types";
import { shouldApplySourceField } from "@/lib/venue-enrichment/source-application";
import { saveVenueImageDiscovery } from "@/lib/venue-enrichment/image-discovery";

const DATA_SOURCE_KEY = "wikidata";
const AUTO_MATCH = 0.85;
const POSSIBLE_MATCH = 0.6;
const DETAIL_BATCH_SIZE = 50;
const DETAIL_DELAY_MS = 500;
const FULL_SYNC_PAGE_SIZE = 100;
const DISCOVERY_PAGE_DELAY_MS = 1_000;

type ExistingVenue = Record<string, unknown> & {
  id: string; name: string; official_url: string | null; prefecture: string | null; city: string | null;
};
type ExistingSource = { id: string; venue_id: string | null; checksum: string | null };

export function wikidataVenueChecksum(payload: unknown) {
  return createHash("sha256").update(JSON.stringify(payload)).digest("hex");
}

export function classifyWikidataVenueMatch(confidence: number) {
  return confidence >= AUTO_MATCH ? "high" : confidence >= POSSIBLE_MATCH ? "possible" : "none";
}

export function shouldSkipWikidataVenue(existing: ExistingSource | null, checksum: string) {
  return Boolean(existing?.venue_id && existing.checksum === checksum);
}

export function isProtectedVenueField(value: unknown, provenance?: { source?: string; review_status?: string } | null) {
  return !shouldApplySourceField(value, provenance?.source, "wikidata");
}

export function wikidataImportRunStatus(fetched: number, errorCount: number) {
  return errorCount === 0 ? "completed" : fetched > 0 ? "partial" : "failed";
}

async function sourceIds(db: SupabaseClient) {
  const { data, error } = await db.from("data_sources").select("id,key").eq("key", DATA_SOURCE_KEY);
  if (error) throw error;
  const values = Object.fromEntries((data || []).map((row) => [row.key, row.id])) as Record<string, string>;
  if (!values[DATA_SOURCE_KEY]) throw new Error("Wikidata data source is missing. Apply local migrations first.");
  return values;
}

async function snapshot(db: SupabaseClient) {
  const rows: Array<Record<string, unknown>> = [];
  let total: number | null = null;
  for (let start = 0; ; start += 1000) {
    const { data, error, count } = await db.from("venues").select("*,media_assets(*)", { count: "exact" }).order("id").range(start, start + 999);
    if (error) throw error;
    if (total == null) total = count;
    rows.push(...((data || []) as Array<Record<string, unknown>>));
    if ((data || []).length < 1000) break;
  }
  const averageCompleteness = rows.length
    ? Math.round(rows.reduce((sum, row) => sum + calculateCompleteness("venues", row).percent, 0) / rows.length)
    : 0;
  return { total: total ?? rows.length, averageCompleteness };
}

async function nextSampleOffset(db: SupabaseClient, count: number) {
  const { data } = await db.from("import_runs").select("metrics").eq("operation_type", "wikidata_venue_import").order("started_at", { ascending: false }).limit(1).maybeSingle();
  const prior = Number((data?.metrics as Record<string, unknown> | null)?.discoveryOffsetEnd || 0);
  return Number.isFinite(prior) ? prior : count;
}

async function fetchNormalizedVenues(discovered: DiscoveredWikidataVenue[]) {
  const normalized: WikidataVenue[] = [];
  const errors: Array<{ qid?: string; message: string }> = [];
  for (let start = 0; start < discovered.length; start += DETAIL_BATCH_SIZE) {
    const batch = discovered.slice(start, start + DETAIL_BATCH_SIZE);
    try {
      if (start) await new Promise((resolve) => setTimeout(resolve, DETAIL_DELAY_MS));
      const candidates = await getWikidataEntities(batch.map((item) => item.qid));
      const administrativeIds = [...new Set(candidates.flatMap((candidate) => {
        const claims = (candidate.raw as { claims?: Record<string, Array<{ mainsnak?: { datavalue?: { value?: unknown } } }>> } | null)?.claims;
        return (claims?.P131 || []).flatMap((claim) => {
          const value = claim.mainsnak?.datavalue?.value;
          return value && typeof value === "object" && "id" in value ? [String((value as { id: unknown }).id)] : [];
        });
      }))];
      let administrativeEntities: WikidataVenueCandidate[] = [];
      try { administrativeEntities = administrativeIds.length ? await getWikidataEntities(administrativeIds.slice(0, 50)) : []; }
      catch { /* Region labels are optional; do not discard otherwise valid Venue details. */ }
      const labels = new Map(administrativeEntities.map((item) => [item.id, item.labelJa || item.labelEn || item.id]));
      for (const candidate of candidates) {
        const discovery = batch.find((item) => item.qid === candidate.id);
        const venue = mapWikidataVenue(candidate, discovery?.rootIds || [], labels);
        if (venue) normalized.push(venue);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Wikidata entity batch failed";
      batch.forEach((item) => errors.push({ qid: item.qid, message }));
    }
  }
  return { venues: normalized, errors };
}

function sourceEnvelope(venue: WikidataVenue) {
  return { qid: venue.qid, discoveryRootIds: venue.discoveryRootIds, rawTypeIds: venue.rawTypeIds, normalized: venue, raw: venue.raw };
}

async function upsertSourceRecord(db: SupabaseClient, dataSourceId: string, venue: WikidataVenue, venueId: string | null) {
  const raw = sourceEnvelope(venue);
  const checksum = wikidataVenueChecksum(raw);
  const { data: before, error: beforeError } = await db.from("source_records").select("id,venue_id,checksum").eq("data_source_id", dataSourceId).eq("external_id", venue.qid).maybeSingle();
  if (beforeError) throw beforeError;
  const { data, error } = await db.from("source_records").upsert({
    data_source_id: dataSourceId, external_id: venue.qid, venue_id: venueId ?? before?.venue_id ?? null,
    source_url: `https://www.wikidata.org/wiki/${venue.qid}`, raw_payload: raw, checksum, fetched_at: new Date().toISOString(),
  }, { onConflict: "data_source_id,external_id" }).select("id,venue_id,checksum").single();
  if (error || !data) throw error || new Error("Wikidata source record could not be saved");
  return { before: before as ExistingSource | null, stored: data as ExistingSource, checksum };
}

function normalizedFields(venue: WikidataVenue) {
  return {
    name: venue.name, name_en: venue.nameEn, aliases: venue.aliases, venue_type: venue.venueType,
    country_code: venue.countryCode, region: venue.region, city: venue.city, address: venue.address,
    postal_code: venue.postalCode, latitude: venue.latitude, longitude: venue.longitude,
    official_url: venue.officialUrl, inception_year: venue.inceptionYear, opening_hours_text: venue.openingHours,
  };
}

async function provenanceMap(db: SupabaseClient, venueId: string) {
  const { data, error } = await db.from("venue_field_sources").select("field_name,source,review_status").eq("venue_id", venueId).eq("is_current", true);
  if (error) throw error;
  return new Map((data || []).map((row) => [row.field_name, row]));
}

async function insertProvenance(db: SupabaseClient, venueId: string, field: string, value: unknown, sourceRecordId: string, qid: string, current: boolean) {
  if (!current) {
    const { data } = await db.from("venue_field_sources").select("id,value_snapshot").eq("venue_id", venueId).eq("field_name", field).eq("source_record_id", sourceRecordId).eq("is_current", false);
    if ((data || []).some((row) => JSON.stringify(row.value_snapshot) === JSON.stringify(value))) return;
  } else {
    const { error } = await db.from("venue_field_sources").update({ is_current: false }).eq("venue_id", venueId).eq("field_name", field).eq("is_current", true);
    if (error) throw error;
  }
  const { error } = await db.from("venue_field_sources").insert({
    venue_id: venueId, field_name: field, source: "wikidata", source_url: `https://www.wikidata.org/wiki/${qid}`,
    source_record_id: sourceRecordId, value_snapshot: value, generated_by_ai: false, review_status: current ? "applied" : "unreviewed", is_current: current,
  });
  if (error) throw error;
}

async function fillExistingVenue(
  db: SupabaseClient,
  existing: ExistingVenue,
  venue: WikidataVenue,
  sourceRecordId: string,
  match?: { confidence: number; reasons: string[] },
) {
  const provenance = await provenanceMap(db, existing.id);
  const updates: Record<string, unknown> = {};
  for (const [field, value] of Object.entries(normalizedFields(venue))) {
    if (value == null || (Array.isArray(value) && !value.length)) continue;
    const protectedField = isProtectedVenueField(existing[field], provenance.get(field));
    if (!protectedField) {
      updates[field] = value;
      await insertProvenance(db, existing.id, field, value, sourceRecordId, venue.qid, true);
    } else if (JSON.stringify(existing[field]) !== JSON.stringify(value)) {
      await insertProvenance(db, existing.id, field, value, sourceRecordId, venue.qid, false);
    }
  }
  if (updates.latitude != null && updates.longitude != null) {
    updates.coordinate_source = "wikidata"; updates.coordinate_precision = "exact"; updates.coordinate_status = "approved";
  }
  updates.wikidata_match_status = "matched";
  if (match) {
    updates.wikidata_match_confidence = match.confidence;
    updates.wikidata_match_reason = match.reasons.join("; ");
  }
  updates.enriched_at = new Date().toISOString();
  const meaningful = Object.keys(updates).filter((key) => !["wikidata_match_status", "wikidata_match_confidence", "wikidata_match_reason", "enriched_at"].includes(key));
  if (meaningful.length || existing.wikidata_match_status !== "matched") {
    const { error } = await db.from("venues").update(updates).eq("id", existing.id); if (error) throw error;
  }
  return meaningful.length > 0;
}

async function createVenue(db: SupabaseClient, venue: WikidataVenue, sourceRecordId: string) {
  const values = normalizedFields(venue);
  const slug = `${slugify(venue.name)}-${venue.qid.toLowerCase()}`;
  const { data, error } = await db.from("venues").insert({
    ...values, slug, normalized_name: slugify(venue.name).replaceAll("-", ""),
    normalized_address: venue.address ? slugify(venue.address).replaceAll("-", "") : null,
    publication_status: "draft", is_active: true,
    coordinate_source: venue.latitude != null && venue.longitude != null ? "wikidata" : null,
    coordinate_precision: venue.latitude != null && venue.longitude != null ? "exact" : null,
    coordinate_status: venue.latitude != null && venue.longitude != null ? "approved" : "missing",
    wikidata_match_status: "matched", wikidata_match_confidence: 1,
    wikidata_match_reason: "Created from Wikidata Source A; QID is the stable external identifier",
  }).select("id,*").single();
  if (error || !data) throw error || new Error("Venue could not be created");
  for (const [field, value] of Object.entries(values)) if (value != null && (!Array.isArray(value) || value.length)) await insertProvenance(db, data.id, field, value, sourceRecordId, venue.qid, true);
  return data as ExistingVenue;
}

function asScoredCandidate(venue: WikidataVenue, confidence = 1, reasons: string[] = []): ScoredWikidataCandidate {
  return {
    id: venue.qid, labelJa: venue.name, labelEn: venue.nameEn, aliases: venue.aliases, description: venue.description,
    officialUrl: venue.officialUrl, latitude: venue.latitude, longitude: venue.longitude,
    imageFileTitle: venue.imageFileTitle, countryId: "Q17", raw: sourceEnvelope(venue), confidence, reasons,
    commonsCategory: venue.commonsCategory, wikipediaArticleTitle: null,
    suggestedStatus: confidence >= AUTO_MATCH ? "matched" : "candidate",
  };
}

async function saveMatchCandidate(db: SupabaseClient, venueId: string, venue: WikidataVenue, confidence: number, reasons: string[], status: "matched" | "candidate") {
  const { data: prior } = await db.from("venue_external_match_candidates").select("status").eq("venue_id", venueId).eq("provider", "wikidata").eq("external_id", venue.qid).maybeSingle();
  const preserved = prior?.status === "rejected" || prior?.status === "matched" ? prior.status : status;
  const { error } = await db.from("venue_external_match_candidates").upsert({
    venue_id: venueId, provider: "wikidata", external_id: venue.qid, label_ja: venue.name, label_en: venue.nameEn,
    description: venue.description, official_url: venue.officialUrl, latitude: venue.latitude, longitude: venue.longitude,
    image_file_title: venue.imageFileTitle, confidence, match_reasons: reasons, status: preserved,
    raw_payload: sourceEnvelope(venue), last_seen_at: new Date().toISOString(),
  }, { onConflict: "venue_id,provider,external_id" });
  if (error) throw error;
  return preserved as "matched" | "candidate" | "rejected";
}

async function allExistingVenues(db: SupabaseClient) {
  const rows: ExistingVenue[] = [];
  for (let start = 0; ; start += 1000) {
    const { data, error } = await db.from("venues").select("*").order("id").range(start, start + 999);
    if (error) throw error; rows.push(...((data || []) as ExistingVenue[])); if ((data || []).length < 1000) break;
  }
  return rows;
}

function bestExistingMatch(existing: ExistingVenue[], venue: WikidataVenue) {
  const candidate = asScoredCandidate(venue);
  return existing.map((row) => ({ row, scored: scoreWikidataCandidate(row, candidate) })).sort((a, b) => b.scored.confidence - a.scored.confidence)[0] || null;
}

export async function importWikidataVenues(input: { mode: "count" | "full"; count?: number; offset?: number; qids?: string[] }, db: SupabaseClient = createSupabaseAdminClient()): Promise<WikidataVenueImportSummary> {
  const targetedQids = [...new Set((input.qids || []).filter((value) => /^Q\d+$/.test(value)))].slice(0, 50);
  const ids = await sourceIds(db);
  const before = await snapshot(db);
  const count = targetedQids.length || Math.max(1, Math.min(500, Math.floor(input.count || 20)));
  let offset = input.mode === "count" ? (input.offset == null ? await nextSampleOffset(db, count) : Math.max(0, Math.floor(input.offset))) : 0;
  const { data: run, error: runError } = await db.from("import_runs").insert({
    data_source_id: ids[DATA_SOURCE_KEY], operation_type: targetedQids.length ? "wikidata_venue_targeted_import" : "wikidata_venue_import", status: "running",
    requested_count: input.mode === "count" ? count : 0, metrics: { mode: input.mode, targeted: Boolean(targetedQids.length), discoveryOffset: offset },
  }).select("id").single();
  if (runError || !run) throw runError || new Error("Import run could not be created");
  const result: WikidataVenueImportSummary = {
    runId: run.id, mode: input.mode, requested: input.mode === "count" ? count : null, discoveryOffset: offset,
    discovered: 0, fetched: 0, processed: 0, discoveryPages: 0, retryCount: 0, currentOffset: offset,
    currentCursor: null,
    currentRoot: null,
    newVenues: 0, linkedExisting: 0, updated: 0, unchanged: 0,
    sourceSelectionRequired: 0, imageCandidatesAdded: 0, errors: [], before, after: before,
  };
  const persistProgress = async (status: "running" | "completed" | "partial" | "failed", finished = false) => {
    const update: Record<string, unknown> = {
      status,
      requested_count: input.mode === "count" ? count : result.discovered,
      fetched_count: result.fetched,
      created_count: result.newVenues,
      updated_count: result.updated + result.linkedExisting,
      skipped_count: result.unchanged,
      error_count: result.errors.length,
      errors: result.errors.length ? result.errors : null,
      metrics: { ...result, discoveryOffsetEnd: result.currentOffset },
    };
    if (finished) update.finished_at = new Date().toISOString();
    const { error } = await db.from("import_runs").update(update).eq("id", result.runId);
    if (error) throw error;
  };
  const existing = await allExistingVenues(db);
  const processPage = async (discovered: DiscoveredWikidataVenue[]) => {
    result.discovered += discovered.length;
    const fetched = await fetchNormalizedVenues(discovered);
    result.errors.push(...fetched.errors);
    result.fetched += fetched.venues.length;
    for (const venue of fetched.venues) {
      result.processed += 1;
      try {
        const { before: existingSource, stored, checksum } = await upsertSourceRecord(db, ids[DATA_SOURCE_KEY], venue, null);
        if (shouldSkipWikidataVenue(existingSource, checksum)) { result.unchanged += 1; continue; }
        let target = existingSource?.venue_id ? existing.find((row) => row.id === existingSource.venue_id) || null : null;
        let created = false;
        let matchMetadata: { confidence: number; reasons: string[] } | undefined;
        if (!target) {
          const { data: linkedCandidate } = await db.from("venue_external_match_candidates").select("venue_id").eq("provider", "wikidata").eq("external_id", venue.qid).eq("status", "matched").limit(1).maybeSingle();
          target = linkedCandidate?.venue_id ? existing.find((row) => row.id === linkedCandidate.venue_id) || null : null;
        }
        if (!target) {
          const match = bestExistingMatch(existing, venue);
          const classification = classifyWikidataVenueMatch(match?.scored.confidence || 0);
          if (classification === "possible" && match) {
            const status = await saveMatchCandidate(db, match.row.id, venue, match.scored.confidence, match.scored.reasons, "candidate");
            if (status === "rejected") result.unchanged += 1; else result.sourceSelectionRequired += 1;
            continue;
          }
          if (classification === "high" && match) {
            target = match.row; result.linkedExisting += 1;
            matchMetadata = { confidence: match.scored.confidence, reasons: match.scored.reasons };
            await saveMatchCandidate(db, target.id, venue, match.scored.confidence, match.scored.reasons, "matched");
          } else {
            target = await createVenue(db, venue, stored.id); existing.push(target); created = true; result.newVenues += 1;
            await saveMatchCandidate(db, target.id, venue, 1, ["Created from Wikidata Source A"], "matched");
          }
        }
        const { error: linkError } = await db.from("source_records").update({ venue_id: target.id }).eq("id", stored.id); if (linkError) throw linkError;
        if (!created && await fillExistingVenue(db, target, venue, stored.id, matchMetadata)) result.updated += 1;
        const imageDiscovery = await saveVenueImageDiscovery(db, { venueId: target.id, qid: venue.qid, venueName: venue.name, venueNameEn: venue.nameEn });
        result.imageCandidatesAdded += imageDiscovery.added;
      } catch (error) {
        result.errors.push({ qid: venue.qid, message: error instanceof Error ? error.message : "Venue import failed" });
      }
    }
  };
  try {
    if (targetedQids.length) {
      result.discoveryPages = 1;
      await processPage(targetedQids.map((qid) => ({ qid, rootIds: [] })));
    } else if (input.mode === "count") {
      let discovered = await discoverWikidataVenues({ limit: count, offset });
      if (!discovered.length && offset > 0) {
        offset = 0; result.discoveryOffset = 0; result.currentOffset = 0;
        discovered = await discoverWikidataVenues({ limit: count, offset: 0 });
      }
      result.discoveryPages = discovered.length ? Math.ceil(discovered.length / 100) : 1;
      result.currentOffset = offset + discovered.length;
      await processPage(discovered);
    } else {
      const seenQids = new Set<string>();
      for (const rootQid of [WIKIDATA_VENUE_CLASSES.museum, WIKIDATA_VENUE_CLASSES.artGallery]) {
        result.currentRoot = rootQid;
        result.currentCursor = null;
        for (;;) {
          const previousCursor: string | null = result.currentCursor;
          const discovered = await discoverWikidataVenuePage({
            rootQid,
            limit: FULL_SYNC_PAGE_SIZE,
            afterQid: previousCursor,
            onRetry: async () => { result.retryCount += 1; await persistProgress("running"); },
          });
          result.discoveryPages += 1;
          const fresh = discovered.filter((item) => {
            if (seenQids.has(item.qid)) return false;
            seenQids.add(item.qid); return true;
          });
          await processPage(fresh);
          result.currentOffset += fresh.length;
          result.currentCursor = discovered.at(-1)?.qid || previousCursor;
          await persistProgress("running");
          if (discovered.length < FULL_SYNC_PAGE_SIZE) break;
          if (result.currentCursor === previousCursor) throw new Error("WDQS cursor did not advance");
          await new Promise((resolve) => setTimeout(resolve, DISCOVERY_PAGE_DELAY_MS));
        }
      }
    }
    result.after = await snapshot(db);
    const status = wikidataImportRunStatus(result.fetched, result.errors.length);
    await persistProgress(status, true);
    return result;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Wikidata discovery failed"; result.errors.push({ message });
    result.after = await snapshot(db);
    await persistProgress(result.processed > 0 ? "partial" : "failed", true);
    return result;
  }
}
