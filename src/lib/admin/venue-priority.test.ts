import { describe, expect, it } from "vitest";
import { compareVenueQuality, effectiveVenueTier, tiersForFilter, VENUE_TIER_TARGETS, venueImageStatus } from "./venue-priority";

const row = (id: string, tier: string | null, fields: Record<string, unknown> = {}) => ({
  id, name: id, auto_priority_tier: tier, manual_priority_tier: null,
  address: null, latitude: null, longitude: null, description: null, opening_hours_text: null,
  media_assets: [], source_records: [], ...fields,
});

describe("venue priority operations", () => {
  it("uses the manual tier before the automatic tier", () => {
    expect(effectiveVenueTier({ auto_priority_tier: "C", manual_priority_tier: "A" })).toBe("A");
  });
  it("expands A-C and exposes the shared draft targets", () => {
    expect(tiersForFilter("A-C")).toEqual(["A", "B", "C"]);
    expect(VENUE_TIER_TARGETS).toEqual({ A: 100, B: 83, C: 67, D: 50, E: 17 });
  });
  it("sorts A through E, unclassified last, then incomplete first", () => {
    const completeA = row("complete A", "A", { address: "x", latitude: 1, longitude: 1, description: "x", opening_hours_text: "x", media_assets: [{ is_primary: true }] });
    const values = [row("none", null), row("C", "C"), completeA, row("incomplete A", "A"), row("E", "E")].sort(compareVenueQuality);
    expect(values.map((value) => value.id)).toEqual(["incomplete A", "complete A", "C", "E", "none"]);
  });
  it("prioritizes missing operational fields within the same tier", () => {
    const completeCore = { latitude: 1, longitude: 1, media_assets: [{ is_primary: true }] };
    const completeOperations = row("complete operations", "C", {
      ...completeCore, address: "x", description: "x", opening_hours_text: "x", closed_days_text: "x", access_text: "x",
    });
    const addressMissing = row("address missing", "C", {
      ...completeCore, description: "x", opening_hours_text: "x", closed_days_text: "x", access_text: "x",
    });
    const descriptionMissing = row("description missing", "C", {
      ...completeCore, address: "x", opening_hours_text: "x", closed_days_text: "x", access_text: "x",
    });
    const accessMissing = row("access missing", "C", {
      ...completeCore, address: "x", description: "x", opening_hours_text: "x", closed_days_text: "x",
    });
    const closedMissing = row("closed missing", "C", {
      ...completeCore, address: "x", description: "x", opening_hours_text: "x", access_text: "x",
    });
    const hoursMissing = row("hours missing", "C", {
      ...completeCore, address: "x", description: "x", closed_days_text: "x", access_text: "x",
    });
    const values = [completeOperations, addressMissing, descriptionMissing, accessMissing, closedMissing, hoursMissing].sort(compareVenueQuality);
    expect(values.map((value) => value.id)).toEqual([
      "hours missing", "closed missing", "access missing", "description missing", "address missing", "complete operations",
    ]);
  });
  it("keeps image selection and rights status separate", () => {
    expect(venueImageStatus(row("one", "A", { media_assets: [{ is_primary: true, rights_status: "needs_review" }] }))).toBe("Primaryあり / Rights未確認");
    expect(venueImageStatus(row("approved", "A", { media_assets: [{ is_primary: true, rights_status: "approved" }] }))).toBe("Primaryあり / Rights確認済み");
  });
});
