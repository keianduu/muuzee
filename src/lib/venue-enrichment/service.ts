import { createHash } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { geocodeWithGeolonia } from "@/lib/geolonia/client";
import { getCommonsImageMetadata } from "@/lib/wikimedia-commons/client";
import { getWikidataEntities, searchWikidataVenues } from "@/lib/wikidata/client";
import { rankWikidataCandidates } from "@/lib/wikidata/matcher";
import type { ScoredWikidataCandidate } from "@/lib/wikidata/types";
import { processVenueEnrichmentItems } from "./batch";
import { CANDIDATE_MIN_THRESHOLD, distanceMeters, ENTITY_AUTO_MATCH_THRESHOLD, findCoordinateCandidate, findImageCandidates, thresholdForConfidence } from "./policy";
import type { VenueEnrichmentBatchResult, VenueEnrichmentResult } from "./types";
import { applyStoredWikidataCandidate, selectSingleSourceCandidate, type StoredWikidataCandidate } from "./source-application";

type Venue = {
  id: string; name: string; name_en: string | null; address: string | null; prefecture: string | null; city: string | null;
  official_url: string | null; latitude: number | null; longitude: number | null; coordinate_source: string | null;
  coordinate_status: string; coordinate_candidate_qid: string | null;
  wikidata_match_status: string;
};

export function canApplyAutomaticCoordinates(venue: Pick<Venue, "latitude" | "longitude" | "coordinate_source">) {
  return venue.latitude == null && venue.longitude == null && !venue.coordinate_source;
}

async function sourceIds(db: SupabaseClient) {
  const { data, error } = await db.from("data_sources").select("id,key").in("key", ["wikidata", "wikimedia_commons", "geolonia_addresses"]);
  if (error) throw error;
  const ids = Object.fromEntries((data || []).map((item) => [item.key, item.id])) as Record<string, string>;
  for (const key of ["wikidata", "wikimedia_commons", "geolonia_addresses"]) {
    if (!ids[key]) throw new Error(`Missing data source: ${key}`);
  }
  return ids;
}

async function getGeoloniaFallback(db: SupabaseClient, ids: Record<string, string>, venue: Venue) {
  if (!canApplyAutomaticCoordinates(venue) || !venue.address) return null;
  const geocoded = await geocodeWithGeolonia(venue);
  if (!geocoded) return null;
  await saveSourceRecord(db, ids.geolonia_addresses, venue.id, `${venue.prefecture || ""}:${venue.city || ""}:${geocoded.matchedLocality}`, null, geocoded.raw);
  return geocoded;
}

async function saveSourceRecord(db: SupabaseClient, dataSourceId: string, venueId: string, externalId: string, sourceUrl: string | null, raw: unknown) {
  const serialized = JSON.stringify(raw);
  const { data, error } = await db.from("source_records").upsert({
    data_source_id: dataSourceId,
    external_id: `venue:${venueId}:${externalId}`,
    venue_id: venueId,
    source_url: sourceUrl,
    raw_payload: raw,
    checksum: createHash("sha256").update(serialized).digest("hex"),
    fetched_at: new Date().toISOString(),
  }, { onConflict: "data_source_id,external_id" }).select("id").single();
  if (error || !data) throw error || new Error("Source record could not be saved");
  return data.id as string;
}

async function saveMatchCandidates(db: SupabaseClient, venueId: string, candidates: ScoredWikidataCandidate[]) {
  if (!candidates.length) return new Map<string, string>();
  const externalIds = candidates.map((candidate) => candidate.id);
  const { data: existing, error: existingError } = await db
    .from("venue_external_match_candidates")
    .select("external_id,status")
    .eq("venue_id", venueId)
    .eq("provider", "wikidata")
    .in("external_id", externalIds);
  if (existingError) throw existingError;
  const protectedStatuses = new Map(
    (existing || [])
      .filter((item) => item.status === "matched" || item.status === "rejected")
      .map((item) => [item.external_id, item.status]),
  );
  const now = new Date().toISOString();
  const rows = candidates.map((candidate) => ({
    venue_id: venueId, provider: "wikidata", external_id: candidate.id, label_ja: candidate.labelJa, label_en: candidate.labelEn,
    description: candidate.description, official_url: candidate.officialUrl, latitude: candidate.latitude, longitude: candidate.longitude,
    image_file_title: candidate.imageFileTitle, confidence: candidate.confidence, match_reasons: candidate.reasons,
    status: protectedStatuses.get(candidate.id) || "candidate", raw_payload: candidate.raw, last_seen_at: now,
  }));
  const { error } = await db.from("venue_external_match_candidates").upsert(rows, { onConflict: "venue_id,provider,external_id" });
  if (error) throw error;
  return new Map(rows.map((row) => [row.external_id, row.status]));
}

async function saveCommonsCandidate(db: SupabaseClient, ids: Record<string, string>, venueId: string, candidate: ScoredWikidataCandidate, foundThreshold: number) {
  if (!candidate.imageFileTitle) return false;
  const fileTitle = candidate.imageFileTitle;
  const metadata = await getCommonsImageMetadata(fileTitle);
  if (!metadata) return false;
  const sourceRecordId = await saveSourceRecord(db, ids.wikimedia_commons, venueId, `${candidate.id}:${metadata.fileTitle}`, metadata.sourceUrl, metadata.raw);
  const { data: existing, error: existingError } = await db.from("source_image_candidates").select("id,review_status,rights_status").eq("source_record_id", sourceRecordId).eq("provider", "wikimedia_commons").eq("stable_identifier", metadata.fileTitle).maybeSingle();
  if (existingError) throw existingError;
  const { error } = await db.from("source_image_candidates").upsert({
    source_record_id: sourceRecordId, image_url: metadata.imageUrl, thumbnail_url: metadata.thumbnailUrl,
    provider: "wikimedia_commons", stable_identifier: metadata.fileTitle, source_url: metadata.sourceUrl,
    author: metadata.author, credit: metadata.credit, license_short_name: metadata.licenseShortName,
    license_url: metadata.licenseUrl, usage_terms: metadata.usageTerms,
    candidate_entity_id: candidate.id, candidate_entity_label: candidate.labelJa || candidate.labelEn,
    candidate_match_confidence: candidate.confidence, candidate_match_threshold: foundThreshold,
    candidate_kind: foundThreshold >= ENTITY_AUTO_MATCH_THRESHOLD ? "probable" : "reference",
    contents_rights_type: metadata.licenseShortName, contents_access: metadata.usageTerms,
    review_status: existing?.review_status || "unreviewed", rights_status: existing?.rights_status || "needs_review",
    is_active: true, last_seen_at: new Date().toISOString(),
  }, { onConflict: "source_record_id,provider,stable_identifier" });
  if (error) throw error;
  return !existing;
}

async function imageDecisionStatus(db: SupabaseClient, venueId: string, fallback: "no_entity_candidate" | "no_image_candidate") {
  const [{ data: sources, error: sourceError }, { data: assets, error: assetError }] = await Promise.all([
    db.from("source_records").select("id").eq("venue_id", venueId),
    db.from("media_assets").select("id").eq("venue_id", venueId).eq("rights_status", "approved"),
  ]);
  if (sourceError) throw sourceError;
  if (assetError) throw assetError;
  if (assets?.length) return "approved_image_exists" as const;
  const sourceRecordIds = (sources || []).map((source) => source.id);
  if (!sourceRecordIds.length) return fallback;
  const { data: imageCandidates, error } = await db.from("source_image_candidates").select("review_status,is_active").in("source_record_id", sourceRecordIds);
  if (error) throw error;
  const active = (imageCandidates || []).filter((candidate) => candidate.is_active);
  if (active.some((candidate) => candidate.review_status === "accepted")) return "image_candidate_kept" as const;
  if (active.some((candidate) => candidate.review_status === "unreviewed")) return "image_candidate_found" as const;
  if (active.length && active.every((candidate) => candidate.review_status === "rejected")) return "image_candidate_rejected" as const;
  return fallback;
}

async function buildCandidateDiagnostics(
  db: SupabaseClient,
  ids: Record<string, string>,
  venue: Venue,
  candidates: ScoredWikidataCandidate[],
  statuses: Map<string, string>,
) {
  const top = candidates[0];
  const coordinate = findCoordinateCandidate(candidates, statuses);
  const geolonia = await getGeoloniaFallback(db, ids, venue);
  const imageSearch = findImageCandidates(candidates, statuses);
  let imageCandidateAdded = false;
  if (imageSearch.foundThreshold != null) {
    for (const candidate of imageSearch.candidates) {
      if (await saveCommonsCandidate(db, ids, venue.id, candidate, imageSearch.foundThreshold)) imageCandidateAdded = true;
    }
  }
  const updates: Record<string, unknown> = {
    best_wikidata_candidate_qid: top?.id || null,
    coordinate_search_trace: candidates
      .filter((candidate) => candidate.confidence >= CANDIDATE_MIN_THRESHOLD && statuses.get(candidate.id) !== "rejected")
      .map((candidate) => ({ qid: candidate.id, confidence: candidate.confidence, threshold: thresholdForConfidence(candidate.confidence), coordinatesPresent: candidate.latitude != null && candidate.longitude != null, selected: candidate.id === coordinate?.candidate.id })),
    image_search_trace: imageSearch.trace,
    image_search_status: await imageDecisionStatus(db, venue.id, candidates.length ? "no_image_candidate" : "no_entity_candidate"),
    image_candidate_found_threshold: imageSearch.foundThreshold,
    image_candidate_found_confidence: imageSearch.candidates[0]?.confidence ?? null,
    image_candidate_found_qid: imageSearch.candidates[0]?.id ?? null,
    image_candidate_found_reason: imageSearch.candidates[0]?.reasons.join("; ") || null,
    geolonia_candidate_latitude: geolonia?.latitude ?? null,
    geolonia_candidate_longitude: geolonia?.longitude ?? null,
    geolonia_candidate_precision: geolonia?.precision ?? null,
  };
  const hasCurrentCoordinates = venue.latitude != null && venue.longitude != null;
  if (hasCurrentCoordinates || venue.coordinate_source === "manual") {
    updates.coordinate_status = venue.coordinate_source === "manual" ? "manual" : "approved";
  } else if (coordinate) {
    const sameRejectedCandidate = venue.coordinate_status === "rejected" && venue.coordinate_candidate_qid === coordinate.candidate.id;
    updates.coordinate_status = sameRejectedCandidate ? "rejected" : "candidate";
    updates.coordinate_candidate_qid = coordinate.candidate.id;
    updates.coordinate_candidate_latitude = coordinate.candidate.latitude;
    updates.coordinate_candidate_longitude = coordinate.candidate.longitude;
    updates.coordinate_candidate_source = "wikidata";
    updates.coordinate_candidate_confidence = coordinate.candidate.confidence;
    updates.coordinate_candidate_threshold = coordinate.threshold;
    updates.coordinate_candidate_reason = coordinate.candidate.reasons.join("; ");
    updates.coordinate_candidate_distance_m = geolonia
      ? distanceMeters({ latitude: Number(coordinate.candidate.latitude), longitude: Number(coordinate.candidate.longitude) }, geolonia)
      : null;
  } else if (geolonia) {
    const sameRejectedCandidate = venue.coordinate_status === "rejected" && venue.coordinate_candidate_qid == null;
    updates.coordinate_status = sameRejectedCandidate ? "rejected" : "candidate";
    updates.coordinate_candidate_qid = null;
    updates.coordinate_candidate_latitude = geolonia.latitude;
    updates.coordinate_candidate_longitude = geolonia.longitude;
    updates.coordinate_candidate_source = "geolonia";
    updates.coordinate_candidate_confidence = null;
    updates.coordinate_candidate_threshold = null;
    updates.coordinate_candidate_reason = `Geolonia locality match: ${geolonia.matchedLocality}`;
    updates.coordinate_candidate_distance_m = null;
  } else if (venue.coordinate_status !== "rejected") {
    updates.coordinate_status = "missing";
  }
  return { updates, coordinateCandidateFound: Boolean(coordinate || geolonia), imageCandidateAdded, imageCandidateFound: imageSearch.candidates.length > 0, imageFoundAtRelaxedThreshold: imageSearch.foundThreshold != null && imageSearch.foundThreshold < ENTITY_AUTO_MATCH_THRESHOLD };
}

async function applyMatchedEntity(db: SupabaseClient, ids: Record<string, string>, venue: Venue, candidate: ScoredWikidataCandidate, candidates: ScoredWikidataCandidate[], statuses: Map<string, string>, humanSelected = false): Promise<VenueEnrichmentResult> {
  const { data: stored, error: storedError } = await db.from("venue_external_match_candidates").select("*").eq("venue_id", venue.id).eq("provider", "wikidata").eq("external_id", candidate.id).single();
  if (storedError || !stored) throw storedError || new Error("Stored Wikidata candidate not found");
  const application = await applyStoredWikidataCandidate(db, venue.id, stored as StoredWikidataCandidate, humanSelected ? "human selected source candidate" : "single source candidate auto-applied");
  const { data: refreshed, error: refreshedError } = await db.from("venues").select("*").eq("id", venue.id).single();
  if (refreshedError || !refreshed) throw refreshedError || new Error("Venue could not be refreshed");
  const diagnostics = await buildCandidateDiagnostics(db, ids, refreshed as Venue, candidates, statuses);
  const { error } = await db.from("venues").update(diagnostics.updates).eq("id", venue.id);
  if (error) throw error;
  return { venueId: venue.id, venueName: venue.name, matchStatus: "matched", wikidataId: candidate.id, confidence: candidate.confidence, coordinateAdded: application.applied.includes("latitude") && application.applied.includes("longitude"), coordinateSource: application.applied.includes("latitude") ? "wikidata" : null, coordinateCandidateFound: diagnostics.coordinateCandidateFound, imageCandidateAdded: diagnostics.imageCandidateAdded, imageCandidateFound: diagnostics.imageCandidateFound, imageFoundAtRelaxedThreshold: diagnostics.imageFoundAtRelaxedThreshold, entityCandidateFound: true };
}

export async function enrichVenue(venueId: string, options: { forceWikidataId?: string } = {}, db: SupabaseClient = createSupabaseAdminClient()): Promise<VenueEnrichmentResult> {
  const { data, error } = await db.from("venues").select("*").eq("id", venueId).single();
  if (error || !data) throw error || new Error("Venue not found");
  const venue = data as Venue;
  const ids = await sourceIds(db);
  let preservedWikidataId: string | null = null;
  if (venue.wikidata_match_status === "matched") {
    const { data: matchedCandidate, error: matchedCandidateError } = await db
      .from("venue_external_match_candidates")
      .select("external_id")
      .eq("venue_id", venue.id)
      .eq("provider", "wikidata")
      .eq("status", "matched")
      .order("last_seen_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (matchedCandidateError) throw matchedCandidateError;
    preservedWikidataId = matchedCandidate?.external_id || null;
  }
  const requestedWikidataId = options.forceWikidataId || preservedWikidataId;
  const rawCandidates = requestedWikidataId ? await getWikidataEntities([requestedWikidataId]) : await searchWikidataVenues(venue.name);
  const candidates = rankWikidataCandidates(venue, rawCandidates);
  const candidateStatuses = await saveMatchCandidates(db, venue.id, candidates);
  const top = candidates[0];
  const automatic = requestedWikidataId ? top : selectSingleSourceCandidate(candidates.map((candidate) => ({ ...candidate, status: candidateStatuses.get(candidate.id) || "candidate" })));
  if (automatic) return applyMatchedEntity(db, ids, venue, automatic, candidates, candidateStatuses, Boolean(options.forceWikidataId));
  const matchStatus = top ? "candidate" : "unmatched";
  const updates: Record<string, unknown> = { wikidata_match_status: matchStatus, wikidata_match_confidence: top?.confidence ?? null, wikidata_match_reason: top?.reasons.join("; ") || null, enriched_at: new Date().toISOString() };
  const diagnostics = await buildCandidateDiagnostics(db, ids, venue, candidates, candidateStatuses);
  Object.assign(updates, diagnostics.updates);
  const { error: updateError } = await db.from("venues").update(updates).eq("id", venue.id);
  if (updateError) throw updateError;
  return { venueId: venue.id, venueName: venue.name, matchStatus, wikidataId: null, confidence: top?.confidence ?? null, coordinateAdded: false, coordinateSource: null, coordinateCandidateFound: diagnostics.coordinateCandidateFound, imageCandidateAdded: diagnostics.imageCandidateAdded, imageCandidateFound: diagnostics.imageCandidateFound, imageFoundAtRelaxedThreshold: diagnostics.imageFoundAtRelaxedThreshold, entityCandidateFound: Boolean(top) };
}

export async function enrichVenueBatch(limit = 20, db: SupabaseClient = createSupabaseAdminClient()): Promise<VenueEnrichmentBatchResult> {
  const safeLimit = Math.max(1, Math.min(50, Math.floor(limit)));
  const ids = await sourceIds(db);
  const { data: venues, error } = await db.from("venues").select("id,name").order("enriched_at", { ascending: true, nullsFirst: true }).order("updated_at", { ascending: false }).limit(safeLimit);
  if (error) throw error;
  const { data: run, error: runError } = await db.from("import_runs").insert({ data_source_id: ids.wikidata, operation_type: "venue_enrichment", status: "running", requested_count: venues?.length || 0 }).select("id").single();
  if (runError || !run) throw runError || new Error("Enrichment run could not be created");
  const processed = await processVenueEnrichmentItems(venues || [], (venueId) => enrichVenue(venueId, {}, db));
  const result: VenueEnrichmentBatchResult = { runId: run.id, ...processed };
  const status = result.errors.length ? (result.processed > result.errors.length ? "partial" : "failed") : "completed";
  await db.from("import_runs").update({ status, fetched_count: result.processed, updated_count: result.matched, error_count: result.errors.length, errors: result.errors, metrics: result, finished_at: new Date().toISOString() }).eq("id", result.runId);
  return result;
}
