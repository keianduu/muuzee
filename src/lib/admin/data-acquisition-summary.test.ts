import { describe, expect, it } from "vitest";
import { buildOverviewMetrics, countDistinctOwners, countUnresolvedMentions, normalizeDataAcquisitionEntity, operationBelongsToEntity } from "./data-acquisition-summary";

describe("data acquisition summary boundary", () => {
  it("normalizes missing and invalid entity values to Exhibitions", () => {
    expect(normalizeDataAcquisitionEntity()).toBe("exhibitions");
    expect(normalizeDataAcquisitionEntity("invalid")).toBe("exhibitions");
    expect(normalizeDataAcquisitionEntity("venues")).toBe("venues");
  });

  it("counts distinct linked Masters and ignores owners outside the active Master set", () => {
    const masters = new Set(["venue-1", "venue-2"]);
    expect(countDistinctOwners([
      { venue_id: "venue-1" }, { venue_id: "venue-1" }, { venue_id: "venue-2" }, { venue_id: "merged-loser" }, { venue_id: null },
    ], "venue_id", masters)).toBe(2);
  });

  it("counts only unresolved mention states", () => {
    expect(countUnresolvedMentions([
      { resolution_status: "resolved" }, { resolution_status: "rejected" }, { resolution_status: "pending" }, { resolution_status: "ambiguous" }, {},
    ])).toBe(3);
  });

  it("builds common real metrics and exact supported list deep links", () => {
    const metrics = buildOverviewMetrics("artists", [
      { id: "published", publication_status: "published" },
      { id: "draft", publication_status: "draft" },
      { id: "ready", publication_status: "ready" },
      { id: "archived", publication_status: "archived" },
    ], [{ artist_id: "published" }, { artist_id: "draft" }, { artist_id: "draft" }], [{ artist_id: "published" }]);

    expect(Object.fromEntries(metrics.map((metric) => [metric.key, metric.value]))).toEqual({
      total: 4, published: 1, unpublished: 2, archived: 1, "source-linked": 2, "image-missing": 2,
    });
    expect(metrics.find((metric) => metric.key === "unpublished")?.href).toBe("/admin/artists?status=unpublished");
    expect(metrics.find((metric) => metric.key === "image-missing")?.href).toBe("/admin/artists?status=unpublished&image=missing");
  });

  it("attributes import history only through explicit operation types", () => {
    expect(operationBelongsToEntity("venues", "wikidata_venue_import")).toBe(true);
    expect(operationBelongsToEntity("artists", "wikidata_artist_import")).toBe(true);
    expect(operationBelongsToEntity("exhibitions", "exhibition_daily_sync")).toBe(true);
    expect(operationBelongsToEntity("venues", "targeted_master_resolution")).toBe(false);
    expect(operationBelongsToEntity("works", "targeted_master_resolution")).toBe(false);
  });
});
