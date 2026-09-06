import type { SupabaseClient } from "@supabase/supabase-js";
import { mapWikidataVenue } from "@/lib/wikidata/venue-mapper";
import type { WikidataVenue } from "@/lib/wikidata/venue-import-types";
import { imageDiscoveryStatus, saveVenueImageDiscovery } from "./image-discovery";

export type StoredWikidataCandidate = {
  id: string;
  venue_id: string;
  external_id: string;
  label_ja: string | null;
  label_en: string | null;
  description: string | null;
  official_url: string | null;
  latitude: number | null;
  longitude: number | null;
  image_file_title: string | null;
  confidence: number;
  match_reasons: string[];
  status: string;
  raw_payload: unknown;
};

export const SOURCE_PRIORITY: Record<string, number> = {
  wikidata: 1,
  wikipedia: 2,
  trusted_api: 3,
  official_website: 4,
  manual: 5,
};

export function selectSingleSourceCandidate<T extends { status: string }>(candidates: T[]) {
  const eligible = candidates.filter((candidate) => candidate.status !== "rejected");
  return eligible.length === 1 ? eligible[0] : null;
}

export function shouldApplySourceField(currentValue: unknown, currentSource: string | null | undefined, incomingSource = "wikidata") {
  if ((SOURCE_PRIORITY[currentSource || ""] || 0) > (SOURCE_PRIORITY[incomingSource] || 0)) return false;
  if (currentSource === incomingSource) return true;
  const empty = currentValue == null || (Array.isArray(currentValue) ? currentValue.length === 0 : String(currentValue).trim() === "");
  return empty || !currentSource;
}

function candidateVenue(candidate: StoredWikidataCandidate): WikidataVenue {
  const payload = candidate.raw_payload as { normalized?: WikidataVenue; raw?: unknown } | null;
  if (payload?.normalized?.qid) return payload.normalized;
  const raw = payload?.raw || candidate.raw_payload;
  const country = (((raw as { claims?: Record<string, Array<{ mainsnak?: { datavalue?: { value?: { id?: string } } } }>> } | null)?.claims?.P17 || [])[0]?.mainsnak?.datavalue?.value?.id) || "Q17";
  const mapped = mapWikidataVenue({
    id: candidate.external_id,
    labelJa: candidate.label_ja,
    labelEn: candidate.label_en,
    aliases: [],
    description: candidate.description,
    officialUrl: candidate.official_url,
    latitude: candidate.latitude == null ? null : Number(candidate.latitude),
    longitude: candidate.longitude == null ? null : Number(candidate.longitude),
    imageFileTitle: candidate.image_file_title,
    commonsCategory: typeof payload?.normalized?.commonsCategory === "string" ? payload.normalized.commonsCategory : null,
    wikipediaArticleTitle: null,
    countryId: country,
    raw,
  }, []);
  if (!mapped) throw new Error(`Wikidata candidate ${candidate.external_id} is not a Japan Venue`);
  return mapped;
}

function wikidataFields(venue: WikidataVenue) {
  return {
    name: venue.name,
    name_en: venue.nameEn,
    aliases: venue.aliases,
    venue_type: venue.venueType,
    country_code: venue.countryCode,
    region: venue.region,
    city: venue.city,
    address: venue.address,
    postal_code: venue.postalCode,
    latitude: venue.latitude,
    longitude: venue.longitude,
    official_url: venue.officialUrl,
    inception_year: venue.inceptionYear,
    opening_hours_text: venue.openingHours,
    description: venue.description,
  };
}

async function saveProvenance(db: SupabaseClient, venueId: string, field: string, value: unknown, sourceRecordId: string, qid: string, current: boolean) {
  const snapshot = JSON.stringify(value);
  const { data: existing, error: existingError } = await db.from("venue_field_sources")
    .select("id,value_snapshot,is_current")
    .eq("venue_id", venueId).eq("field_name", field).eq("source_record_id", sourceRecordId);
  if (existingError) throw existingError;
  const same = (existing || []).find((row) => JSON.stringify(row.value_snapshot) === snapshot);
  if (current) {
    const { error } = await db.from("venue_field_sources").update({ is_current: false }).eq("venue_id", venueId).eq("field_name", field).eq("is_current", true);
    if (error) throw error;
  }
  if (same) {
    const { error } = await db.from("venue_field_sources").update({ is_current: current, review_status: current ? "applied" : "unreviewed", updated_at: new Date().toISOString() }).eq("id", same.id);
    if (error) throw error;
    return;
  }
  const { error } = await db.from("venue_field_sources").insert({
    venue_id: venueId, field_name: field, source: "wikidata", source_url: `https://www.wikidata.org/wiki/${qid}`,
    source_record_id: sourceRecordId, value_snapshot: value, generated_by_ai: false,
    review_status: current ? "applied" : "unreviewed", is_current: current,
  });
  if (error) throw error;
}

export async function applyStoredWikidataCandidate(db: SupabaseClient, venueId: string, candidate: StoredWikidataCandidate, reasonPrefix = "single source candidate auto-applied") {
  const [{ data: venue, error: venueError }, { data: source, error: sourceError }] = await Promise.all([
    db.from("venues").select("*").eq("id", venueId).single(),
    db.from("data_sources").select("id").eq("key", "wikidata").single(),
  ]);
  if (venueError || !venue) throw venueError || new Error("Venue not found");
  if (sourceError || !source) throw sourceError || new Error("Wikidata source not found");
  const normalized = candidateVenue(candidate);
  const envelope = { qid: normalized.qid, discoveryRootIds: normalized.discoveryRootIds, rawTypeIds: normalized.rawTypeIds, normalized, raw: normalized.raw };
  const { data: priorSourceRecord, error: priorSourceError } = await db.from("source_records").select("id,venue_id").eq("data_source_id", source.id).eq("external_id", normalized.qid).maybeSingle();
  if (priorSourceError) throw priorSourceError;
  if (priorSourceRecord?.venue_id && priorSourceRecord.venue_id !== venueId) throw new Error(`${normalized.qid} is linked to another Venue; use Canonical Merge`);
  const { data: sourceRecord, error: sourceRecordError } = await db.from("source_records").upsert({
    data_source_id: source.id, external_id: normalized.qid, venue_id: venueId,
    source_url: `https://www.wikidata.org/wiki/${normalized.qid}`, raw_payload: envelope, fetched_at: new Date().toISOString(),
  }, { onConflict: "data_source_id,external_id" }).select("id,venue_id").single();
  if (sourceRecordError || !sourceRecord) throw sourceRecordError || new Error("Wikidata source record could not be saved");

  const { data: currentSources, error: provenanceError } = await db.from("venue_field_sources")
    .select("field_name,source").eq("venue_id", venueId).eq("is_current", true);
  if (provenanceError) throw provenanceError;
  const provenance = new Map((currentSources || []).map((row) => [row.field_name, row.source]));
  const updates: Record<string, unknown> = {};
  const applied: string[] = [];
  const protectedFields: string[] = [];
  for (const [field, value] of Object.entries(wikidataFields(normalized))) {
    if (value == null || (Array.isArray(value) && !value.length)) continue;
    if (shouldApplySourceField(venue[field], provenance.get(field), "wikidata")) {
      updates[field] = value; applied.push(field);
      await saveProvenance(db, venueId, field, value, sourceRecord.id, normalized.qid, true);
    } else {
      protectedFields.push(field);
      if (JSON.stringify(venue[field]) !== JSON.stringify(value)) await saveProvenance(db, venueId, field, value, sourceRecord.id, normalized.qid, false);
    }
  }
  if (updates.latitude != null && updates.longitude != null) {
    updates.coordinate_source = "wikidata";
    updates.coordinate_precision = "exact";
    updates.coordinate_status = "approved";
    updates.coordinate_candidate_qid = normalized.qid;
    updates.coordinate_candidate_latitude = updates.latitude;
    updates.coordinate_candidate_longitude = updates.longitude;
    updates.coordinate_candidate_source = "wikidata";
    updates.coordinate_candidate_confidence = Number(candidate.confidence);
  }
  updates.wikidata_match_status = "matched";
  updates.wikidata_match_confidence = Number(candidate.confidence);
  updates.wikidata_match_reason = `${reasonPrefix}; ${(candidate.match_reasons || []).join("; ")}`;
  updates.best_wikidata_candidate_qid = normalized.qid;
  updates.enriched_at = new Date().toISOString();
  const { error: updateError } = await db.from("venues").update(updates).eq("id", venueId);
  if (updateError) throw updateError;
  const { error: candidateError } = await db.from("venue_external_match_candidates").update({ status: "matched" }).eq("id", candidate.id);
  if (candidateError) throw candidateError;
  await db.from("venue_external_match_candidates").update({ status: "candidate" }).eq("venue_id", venueId).eq("provider", "wikidata").neq("id", candidate.id).neq("status", "rejected");
  let imageDiscovery: Awaited<ReturnType<typeof saveVenueImageDiscovery>> = { qid: normalized.qid, files: [], trace: [], saved: [], added: 0 };
  try {
    imageDiscovery = await saveVenueImageDiscovery(db, { venueId, qid: normalized.qid, venueName: normalized.name, venueNameEn: normalized.nameEn });
    const { data: primary } = await db.from("media_assets").select("id").eq("venue_id", venueId).eq("is_primary", true).limit(1);
    await db.from("venues").update({
      image_search_status: primary?.length ? "approved_image_exists" : imageDiscoveryStatus(imageDiscovery.files),
      image_search_trace: imageDiscovery.trace,
      image_candidate_found_qid: imageDiscovery.files.length ? normalized.qid : null,
      image_candidate_found_reason: imageDiscovery.files.map((item) => `${item.discoverySource}: ${item.fileTitle}`).join("; ") || null,
    }).eq("id", venueId);
  } catch (error) {
    await db.from("venues").update({ image_search_trace: [{ source: "image_discovery", error: error instanceof Error ? error.message : "Image discovery failed" }] }).eq("id", venueId);
  }
  return { venueId, qid: normalized.qid, applied, protectedFields, imageDiscovery };
}

export async function classifyExhibitionVenueCandidates(db: SupabaseClient) {
  const { data: occurrences, error } = await db.from("exhibition_occurrences").select("venue_id").not("venue_id", "is", null);
  if (error) throw error;
  const venueIds = [...new Set((occurrences || []).map((row) => row.venue_id).filter(Boolean))] as string[];
  const { data: candidates, error: candidateError } = venueIds.length
    ? await db.from("venue_external_match_candidates").select("*").in("venue_id", venueIds).eq("provider", "wikidata").neq("status", "rejected")
    : { data: [], error: null };
  if (candidateError) throw candidateError;
  const grouped = new Map<string, StoredWikidataCandidate[]>();
  for (const venueId of venueIds) grouped.set(venueId, []);
  for (const candidate of (candidates || []) as StoredWikidataCandidate[]) grouped.get(candidate.venue_id)?.push(candidate);
  const zero: string[] = [], single: Array<{ venueId: string; candidate: StoredWikidataCandidate }> = [], multiple: Array<{ venueId: string; candidates: StoredWikidataCandidate[] }> = [];
  for (const [venueId, rows] of grouped) {
    if (!rows.length) zero.push(venueId);
    else if (rows.length === 1) single.push({ venueId, candidate: rows[0] });
    else multiple.push({ venueId, candidates: rows.sort((a, b) => Number(b.confidence) - Number(a.confidence)) });
  }
  return { venueIds, zero, single, multiple };
}
