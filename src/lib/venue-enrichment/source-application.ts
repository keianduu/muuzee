import type { SupabaseClient } from "@supabase/supabase-js";
import { buildVenueFieldReviewRows, eligibleSelectedVenueFields, VENUE_REVIEW_FIELDS, VENUE_SOURCE_PRIORITY } from "@/lib/admin/venue-data-review";
import { getWikidataEntities } from "@/lib/wikidata/client";
import { mapWikidataVenue } from "@/lib/wikidata/venue-mapper";
import type { WikidataVenue } from "@/lib/wikidata/venue-import-types";

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

export const SOURCE_PRIORITY = VENUE_SOURCE_PRIORITY;

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

export function wikidataFields(venue: WikidataVenue) {
  return {
    name: venue.name,
    name_en: venue.nameEn,
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

async function saveIdentitySourceRecord(db: SupabaseClient, venueId: string, candidate: StoredWikidataCandidate, rawPayload: unknown = candidate.raw_payload) {
  const { data: source, error: sourceError } = await db.from("data_sources").select("id").eq("key", "wikidata").single();
  if (sourceError || !source) throw sourceError || new Error("Wikidata source not found");
  const { data: priorSourceRecord, error: priorSourceError } = await db.from("source_records").select("id,venue_id").eq("data_source_id", source.id).eq("external_id", candidate.external_id).maybeSingle();
  if (priorSourceError) throw priorSourceError;
  if (priorSourceRecord?.venue_id && priorSourceRecord.venue_id !== venueId) throw new Error(`${candidate.external_id} is linked to another Venue; use Canonical Merge`);
  const { data: sourceRecord, error: sourceRecordError } = await db.from("source_records").upsert({
    data_source_id: source.id, external_id: candidate.external_id, venue_id: venueId,
    source_url: `https://www.wikidata.org/wiki/${candidate.external_id}`, raw_payload: rawPayload, fetched_at: new Date().toISOString(),
  }, { onConflict: "data_source_id,external_id" }).select("id,venue_id").single();
  if (sourceRecordError || !sourceRecord) throw sourceRecordError || new Error("Wikidata source record could not be saved");
  return sourceRecord;
}

export async function confirmWikidataIdentity(db: SupabaseClient, venueId: string, candidate: StoredWikidataCandidate, reasonPrefix = "human confirmed Wikidata identity") {
  await saveIdentitySourceRecord(db, venueId, candidate);
  const updates = {
    wikidata_match_status: "matched",
    wikidata_match_confidence: Number(candidate.confidence),
    wikidata_match_reason: `${reasonPrefix}; ${(candidate.match_reasons || []).join("; ")}`,
    best_wikidata_candidate_qid: candidate.external_id,
    enriched_at: new Date().toISOString(),
  };
  const { error: updateError } = await db.from("venues").update(updates).eq("id", venueId);
  if (updateError) throw updateError;
  const { error: candidateError } = await db.from("venue_external_match_candidates").update({ status: "matched" }).eq("id", candidate.id);
  if (candidateError) throw candidateError;
  await db.from("venue_external_match_candidates").update({ status: "candidate" }).eq("venue_id", venueId).eq("provider", "wikidata").neq("id", candidate.id).neq("status", "rejected");
  return { venueId, qid: candidate.external_id };
}

export async function rejectWikidataIdentity(db: SupabaseClient, venueId: string, candidateId: string) {
  const { error } = await db.from("venue_external_match_candidates").update({ status: "rejected" }).eq("id", candidateId).eq("venue_id", venueId).eq("provider", "wikidata");
  if (error) throw error;
}

async function confirmedCandidate(db: SupabaseClient, venueId: string) {
  const { data, error } = await db.from("venue_external_match_candidates").select("*").eq("venue_id", venueId).eq("provider", "wikidata").eq("status", "matched").order("last_seen_at", { ascending: false }).limit(1).maybeSingle();
  if (error) throw error;
  if (!data) throw new Error("Wikidata QIDを先に確定してください。");
  return data as StoredWikidataCandidate;
}

async function freshWikidataVenue(candidate: StoredWikidataCandidate) {
  const [fresh] = await getWikidataEntities([candidate.external_id]);
  if (!fresh) throw new Error("Wikidataから確定QIDを取得できませんでした。");
  const storedPayload = candidate.raw_payload as { normalized?: WikidataVenue } | null;
  const normalized = mapWikidataVenue(fresh, storedPayload?.normalized?.discoveryRootIds || []);
  if (!normalized) throw new Error(`Wikidata candidate ${candidate.external_id} is not a supported Venue`);
  return normalized;
}

export async function previewWikidataVenueFields(db: SupabaseClient, venueId: string) {
  const candidate = await confirmedCandidate(db, venueId);
  const normalized = await freshWikidataVenue(candidate);
  const [{ data: venue, error: venueError }, { data: sources, error: sourceError }] = await Promise.all([
    db.from("venues").select("*").eq("id", venueId).single(),
    db.from("venue_field_sources").select("field_name,source,source_url,is_current").eq("venue_id", venueId).eq("is_current", true),
  ]);
  if (venueError || !venue) throw venueError || new Error("Venue not found");
  if (sourceError) throw sourceError;
  const values = wikidataFields(normalized);
  const sourceUrl = `https://www.wikidata.org/wiki/${candidate.external_id}`;
  return {
    qid: candidate.external_id,
    rows: buildVenueFieldReviewRows(venue, sources || [], values, "wikidata", Object.fromEntries(VENUE_REVIEW_FIELDS.map(([key]) => [key, sourceUrl]))),
    values,
    normalized,
    candidate,
  };
}

export async function applyWikidataVenueFields(db: SupabaseClient, venueId: string, selectedFields: string[]) {
  const preview = await previewWikidataVenueFields(db, venueId);
  const allowed = new Set(VENUE_REVIEW_FIELDS.map(([key]) => key));
  if (selectedFields.some((field) => !allowed.has(field as typeof VENUE_REVIEW_FIELDS[number][0]))) throw new Error("Unsupported Wikidata field");
  const eligible = eligibleSelectedVenueFields(preview.rows, selectedFields);
  if (!eligible.length) return { applied: [], protectedFields: preview.rows.filter((row) => row.protected).map((row) => row.key) };
  const envelope = { qid: preview.normalized.qid, discoveryRootIds: preview.normalized.discoveryRootIds, rawTypeIds: preview.normalized.rawTypeIds, normalized: preview.normalized, raw: preview.normalized.raw };
  const sourceRecord = await saveIdentitySourceRecord(db, venueId, preview.candidate, envelope);
  const updates = Object.fromEntries(eligible.map((row) => [row.key, row.candidateValue])) as Record<string, unknown>;
  if (eligible.some((row) => row.key === "latitude" || row.key === "longitude")) {
    updates.coordinate_source = "wikidata";
    updates.coordinate_precision = "exact";
    updates.coordinate_status = "approved";
  }
  const { error: updateError } = await db.from("venues").update(updates).eq("id", venueId);
  if (updateError) throw updateError;
  for (const row of eligible) await saveProvenance(db, venueId, row.key, row.candidateValue, sourceRecord.id, preview.qid, true);
  return { applied: eligible.map((row) => row.key), protectedFields: preview.rows.filter((row) => row.protected).map((row) => row.key) };
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
