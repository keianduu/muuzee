import { describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { VenueCoordinateCandidateRow } from "./types";
import { autoSelectSingleVenueCoordinateCandidate, coordinateAutoSelectionCandidateId, coordinateCandidateVenueUpdate, reviewVenueCoordinateCandidate, venueCoordinateCandidateMapUrl } from "./venue-coordinate-review";

function candidate(overrides: Partial<VenueCoordinateCandidateRow> = {}): VenueCoordinateCandidateRow {
  return {
    id: "candidate-1", venue_id: "venue-1", source: "wikidata", candidate_key: "Q1", external_id: "Q1",
    latitude: 35.1, longitude: 139.1, confidence: 0.9, reason: "name and locality", precision: "exact",
    source_url: "https://www.wikidata.org/wiki/Q1", source_record_id: null, review_status: "candidate",
    decided_at: null, created_at: "2026-10-04T00:00:00Z", updated_at: "2026-10-04T00:00:00Z", ...overrides,
  };
}

function coordinateReviewDb(rows: VenueCoordinateCandidateRow[]) {
  const state = { candidates: structuredClone(rows), venue: { id: "venue-1", latitude: null as number | null, longitude: null as number | null }, provenance: [] as Array<Record<string, unknown>> };
  const db = { from(table: string) {
    let operation: "select" | "update" | "insert" = "select";
    let payload: Record<string, unknown> = {};
    const filters: Array<["eq" | "neq", string, unknown]> = [];
    const matches = (row: Record<string, unknown>) => filters.every(([kind, key, value]) => kind === "eq" ? row[key] === value : row[key] !== value);
    const query: Record<string, unknown> = {};
    query.select = () => { operation = "select"; return query; };
    query.update = (value: Record<string, unknown>) => { operation = "update"; payload = value; return query; };
    query.insert = (value: Record<string, unknown>) => { operation = "insert"; payload = value; return query; };
    query.eq = (key: string, value: unknown) => { filters.push(["eq", key, value]); return query; };
    query.neq = (key: string, value: unknown) => { filters.push(["neq", key, value]); return query; };
    query.single = async () => ({ data: table === "venue_coordinate_candidates" ? state.candidates.find((row) => matches(row as unknown as Record<string, unknown>)) : state.venue, error: null });
    query.then = (resolve: (value: { data?: unknown; error: null }) => unknown) => {
      if (operation === "update" && table === "venue_coordinate_candidates") state.candidates.filter((row) => matches(row as unknown as Record<string, unknown>)).forEach((row) => Object.assign(row, payload));
      if (operation === "update" && table === "venues" && matches(state.venue)) Object.assign(state.venue, payload);
      if (operation === "insert" && table === "venue_field_sources") state.provenance.push(payload);
      return Promise.resolve({ data: operation === "select" ? state.candidates.filter((row) => matches(row as unknown as Record<string, unknown>)) : undefined, error: null }).then(resolve);
    };
    return query;
  } } as unknown as SupabaseClient;
  return { db, state };
}

describe("Venue coordinate candidate review", () => {
  it("keeps candidate identities independent while mapping the adopted coordinates", () => {
    const wikidata = candidate();
    const geolonia = candidate({ id: "candidate-2", source: "geolonia", candidate_key: "35.2,139.2", external_id: null, latitude: 35.2, longitude: 139.2, confidence: null });
    expect(wikidata.id).not.toBe(geolonia.id);
    expect(coordinateCandidateVenueUpdate(geolonia)).toMatchObject({ latitude: 35.2, longitude: 139.2, coordinate_source: "geolonia", coordinate_status: "approved" });
  });

  it("does not include Wikidata entity match state in coordinate adoption updates", () => {
    expect(coordinateCandidateVenueUpdate(candidate())).not.toHaveProperty("wikidata_match_status");
    expect(coordinateCandidateVenueUpdate(candidate())).not.toHaveProperty("best_wikidata_candidate_qid");
  });

  it("builds the Google Maps URL from the exact candidate coordinates", () => {
    expect(venueCoordinateCandidateMapUrl(candidate({ latitude: 35.66528, longitude: 139.72634 })))
      .toBe("https://www.google.com/maps?q=35.66528%2C139.72634");
  });

  it("auto-selects one eligible candidate but never multiple, rejected, or an existing current coordinate", () => {
    expect(coordinateAutoSelectionCandidateId({ hasCurrentCoordinates: false, candidates: [candidate()] })).toBe("candidate-1");
    expect(coordinateAutoSelectionCandidateId({ hasCurrentCoordinates: false, candidates: [candidate(), candidate({ id: "candidate-2" })] })).toBeNull();
    expect(coordinateAutoSelectionCandidateId({ hasCurrentCoordinates: false, candidates: [candidate({ review_status: "rejected" })] })).toBeNull();
    expect(coordinateAutoSelectionCandidateId({ hasCurrentCoordinates: true, candidates: [candidate()] })).toBeNull();
  });

  it("accepts one winner, rejects every other candidate, updates Venue coordinates, and records provenance", async () => {
    const { db, state } = coordinateReviewDb([
      candidate({ id: "candidate-a", latitude: 35.1, longitude: 139.1 }),
      candidate({ id: "candidate-b", source: "geolonia", latitude: 35.2, longitude: 139.2, source_url: "https://geo.example/b" }),
      candidate({ id: "candidate-c", latitude: 35.3, longitude: 139.3 }),
    ]);
    await reviewVenueCoordinateCandidate(db, "venue-1", "candidate-b", "accept");
    expect(state.candidates.map(({ id, review_status }) => [id, review_status])).toEqual([
      ["candidate-a", "rejected"], ["candidate-b", "accepted"], ["candidate-c", "rejected"],
    ]);
    expect(state.venue).toMatchObject({ latitude: 35.2, longitude: 139.2, coordinate_source: "geolonia", coordinate_status: "approved" });
    expect(state.provenance).toEqual(expect.arrayContaining([
      expect.objectContaining({ field_name: "latitude", source: "trusted_api", value_snapshot: 35.2, is_current: true }),
      expect.objectContaining({ field_name: "longitude", source: "trusted_api", value_snapshot: 139.2, is_current: true }),
    ]));
  });

  it("auto-selects and persists an exactly-one coordinate candidate", async () => {
    const { db, state } = coordinateReviewDb([candidate({ latitude: 35.4, longitude: 139.4 })]);
    const result = await autoSelectSingleVenueCoordinateCandidate(db, "venue-1");
    expect(result).toMatchObject({ action: "accept", candidateId: "candidate-1", latitude: 35.4, longitude: 139.4 });
    expect(state.candidates[0].review_status).toBe("accepted");
    expect(state.venue).toMatchObject({ latitude: 35.4, longitude: 139.4, coordinate_status: "approved" });
  });

  it("rejects only the requested candidate and leaves the current Venue unchanged", async () => {
    const { db, state } = coordinateReviewDb([candidate({ id: "candidate-a" }), candidate({ id: "candidate-b" })]);
    await reviewVenueCoordinateCandidate(db, "venue-1", "candidate-a", "reject");
    expect(state.candidates.map(({ id, review_status }) => [id, review_status])).toEqual([["candidate-a", "rejected"], ["candidate-b", "candidate"]]);
    expect(state.venue).toMatchObject({ latitude: null, longitude: null });
    expect(state.provenance).toHaveLength(0);
  });
});
