import { describe, expect, it } from "vitest";
import { blocksPublishedOccurrenceDelete, isRelationVisibility, isVenueRelationKind } from "./venue-relations";

describe("Venue relation rules", () => {
  it("accepts only supported relation kinds and visibility values", () => {
    expect(isVenueRelationKind("holding")).toBe(true);
    expect(isVenueRelationKind("exhibition")).toBe(true);
    expect(isVenueRelationKind("artist")).toBe(false);
    expect(isRelationVisibility("public")).toBe(true);
    expect(isRelationVisibility("hidden")).toBe(true);
    expect(isRelationVisibility("stale")).toBe(false);
  });

  it("blocks removal of the only public active occurrence from a published Exhibition", () => {
    expect(blocksPublishedOccurrenceDelete({ publicationStatus: "published", activeVisibleCount: 1, targetRelationStatus: "active", targetVisibility: "public" })).toBe(true);
    expect(blocksPublishedOccurrenceDelete({ publicationStatus: "published", activeVisibleCount: 2, targetRelationStatus: "active", targetVisibility: "public" })).toBe(false);
    expect(blocksPublishedOccurrenceDelete({ publicationStatus: "draft", activeVisibleCount: 1, targetRelationStatus: "active", targetVisibility: "public" })).toBe(false);
    expect(blocksPublishedOccurrenceDelete({ publicationStatus: "published", activeVisibleCount: 1, targetRelationStatus: "stale", targetVisibility: "public" })).toBe(false);
  });
});
