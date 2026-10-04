import { describe, expect, it } from "vitest";
import type { VenueCoordinateCandidateRow } from "./types";
import { coordinateCandidateVenueUpdate, venueCoordinateCandidateMapUrl } from "./venue-coordinate-review";

function candidate(overrides: Partial<VenueCoordinateCandidateRow> = {}): VenueCoordinateCandidateRow {
  return {
    id: "candidate-1", venue_id: "venue-1", source: "wikidata", candidate_key: "Q1", external_id: "Q1",
    latitude: 35.1, longitude: 139.1, confidence: 0.9, reason: "name and locality", precision: "exact",
    source_url: "https://www.wikidata.org/wiki/Q1", source_record_id: null, review_status: "candidate",
    decided_at: null, created_at: "2026-10-04T00:00:00Z", updated_at: "2026-10-04T00:00:00Z", ...overrides,
  };
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
});
