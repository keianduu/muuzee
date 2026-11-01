import { describe, expect, it } from "vitest";
import { buildExhibitionOperatorOverview, buildMasterOperatorOverview, buildUnavailableMasterOperatorOverview, countDistinctEndedExhibitions } from "./data-acquisition-operator-overview";

describe("Master operator overview", () => {
  it("defines every non-published canonical Master as unpublished", () => {
    expect(buildMasterOperatorOverview("venues", 58, 12)).toEqual({
      entity: "venues",
      total: 58,
      published: 12,
      unpublished: 46,
    });
  });

  it("keeps total equal to published plus unpublished", () => {
    const overview = buildMasterOperatorOverview("works", 0, 0);
    expect(overview).toEqual({ entity: "works", total: 0, published: 0, unpublished: 0 });
  });

  it("represents unavailable counts without numeric fallback values", () => {
    expect(buildUnavailableMasterOperatorOverview("artists")).toEqual({
      entity: "artists",
      total: null,
      published: null,
      unpublished: null,
    });
  });
});

describe("Exhibition operator overview", () => {
  it("counts distinct ended Exhibitions across multiple past occurrences", () => {
    expect(countDistinctEndedExhibitions([
      { exhibition_id: "published-ended" },
      { exhibition_id: "published-ended" },
      { exhibition_id: "draft-ended" },
    ])).toBe(2);
  });

  it("keeps publication and lifecycle metrics independent", () => {
    const overview = buildExhibitionOperatorOverview({ total: 4, published: 2, unpublished: 1, ended: 2 });
    expect(overview).toEqual({ total: 4, published: 2, unpublished: 1, ended: 2 });
    expect(overview.published! + overview.unpublished! + overview.ended!).toBe(5);
  });
});
