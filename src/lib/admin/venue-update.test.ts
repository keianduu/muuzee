import { describe, expect, it } from "vitest";
import { coordinateUpdateValues } from "./venue-update";

const current = {
  latitude: null,
  longitude: null,
  coordinate_source: null,
  coordinate_precision: null,
  coordinate_candidate_latitude: null,
  coordinate_candidate_longitude: null,
};

describe("Venue coordinate update semantics", () => {
  it("preserves Geolonia provenance for unchanged preview coordinates", () => {
    expect(coordinateUpdateValues(current, { latitude: 35.68, longitude: 139.76, sourceHint: "geolonia", precisionHint: "town" }))
      .toMatchObject({ coordinate_source: "geolonia", coordinate_precision: "town", coordinate_status: "approved" });
  });

  it("marks directly edited coordinates as manual", () => {
    expect(coordinateUpdateValues(current, { latitude: 35.68, longitude: 139.76, sourceHint: "manual" }))
      .toMatchObject({ coordinate_source: "manual", coordinate_precision: "exact", coordinate_status: "manual" });
  });

  it("does not rewrite coordinate provenance when coordinates are unchanged", () => {
    expect(coordinateUpdateValues({ ...current, latitude: 35.68, longitude: 139.76, coordinate_source: "wikidata" }, { latitude: 35.68, longitude: 139.76, sourceHint: "manual" }))
      .toEqual({});
  });
});
