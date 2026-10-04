import type { SupabaseClient } from "@supabase/supabase-js";
import type { VenueCoordinateCandidateRow } from "./types";

export function venueCoordinateCandidateMapUrl(candidate: Pick<VenueCoordinateCandidateRow, "latitude" | "longitude">) {
  return `https://www.google.com/maps?q=${encodeURIComponent(`${candidate.latitude},${candidate.longitude}`)}`;
}

export function coordinateCandidateVenueUpdate(candidate: VenueCoordinateCandidateRow) {
  return {
    latitude: Number(candidate.latitude),
    longitude: Number(candidate.longitude),
    coordinate_source: candidate.source,
    coordinate_precision: candidate.precision || "exact",
    coordinate_status: "approved",
    coordinate_candidate_qid: candidate.external_id,
    coordinate_candidate_latitude: Number(candidate.latitude),
    coordinate_candidate_longitude: Number(candidate.longitude),
    coordinate_candidate_source: candidate.source,
    coordinate_candidate_confidence: candidate.confidence,
    coordinate_candidate_reason: candidate.reason,
    coordinate_candidate_decided_at: new Date().toISOString(),
  };
}

async function saveCoordinateProvenance(db: SupabaseClient, candidate: VenueCoordinateCandidateRow, field: "latitude" | "longitude", value: number) {
  const source = candidate.source === "wikidata" ? "wikidata" : "trusted_api";
  const { error: clearError } = await db.from("venue_field_sources").update({ is_current: false }).eq("venue_id", candidate.venue_id).eq("field_name", field).eq("is_current", true);
  if (clearError) throw clearError;
  const { error } = await db.from("venue_field_sources").insert({
    venue_id: candidate.venue_id,
    field_name: field,
    source,
    source_url: candidate.source_url,
    source_record_id: candidate.source_record_id,
    value_snapshot: value,
    generated_by_ai: false,
    review_status: "applied",
    is_current: true,
  });
  if (error) throw error;
}

export async function reviewVenueCoordinateCandidate(db: SupabaseClient, venueId: string, candidateId: string, action: "accept" | "reject") {
  const { data, error } = await db.from("venue_coordinate_candidates").select("*").eq("id", candidateId).eq("venue_id", venueId).single();
  if (error || !data) throw error || new Error("位置情報候補が見つかりません。");
  const candidate = data as VenueCoordinateCandidateRow;
  const decidedAt = new Date().toISOString();
  const { error: decisionError } = await db.from("venue_coordinate_candidates").update({ review_status: action === "accept" ? "accepted" : "rejected", decided_at: decidedAt }).eq("id", candidateId);
  if (decisionError) throw decisionError;
  if (action === "reject") return { action, candidateId };
  const { error: venueError } = await db.from("venues").update(coordinateCandidateVenueUpdate(candidate)).eq("id", venueId);
  if (venueError) throw venueError;
  await saveCoordinateProvenance(db, candidate, "latitude", Number(candidate.latitude));
  await saveCoordinateProvenance(db, candidate, "longitude", Number(candidate.longitude));
  return { action, candidateId, latitude: Number(candidate.latitude), longitude: Number(candidate.longitude) };
}
