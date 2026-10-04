import { describe, expect, it } from "vitest";
import { applyVenueCoordinateSelection, isVenueCoordinateSelection } from "./venue-coordinate-selection";

describe("Venue coordinate selection state", () => {
  it("updates only coordinates and preserves dirty unrelated fields", () => {
    const current = {
      latitude: "",
      longitude: "",
      description: "保存前に編集した概要",
      official_url: "https://dirty.example/",
    };

    expect(applyVenueCoordinateSelection(current, { latitude: 35.681236, longitude: 139.767125 })).toEqual({
      latitude: "35.681236",
      longitude: "139.767125",
      description: "保存前に編集した概要",
      official_url: "https://dirty.example/",
    });
  });

  it("rejects malformed event details", () => {
    expect(isVenueCoordinateSelection({ venueId: "venue-1", latitude: 35, longitude: 139, source: "wikidata", precision: "exact" })).toBe(true);
    expect(isVenueCoordinateSelection({ venueId: "venue-1", latitude: "35", longitude: 139, source: "wikidata", precision: "exact" })).toBe(false);
  });
});
