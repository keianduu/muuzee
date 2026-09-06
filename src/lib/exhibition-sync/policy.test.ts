import { describe, expect, it } from "vitest";
import { dailySyncWindow, deriveEventStatus, mayApplySourceField, resolveVenueName } from "./policy";

describe("Exhibition daily sync policy", () => {
  const today = "2026-09-06";
  it.each([
    ["2026-09-07", "2026-09-08", "upcoming"],
    [today, "2026-09-08", "ongoing"],
    ["2026-09-01", "2026-09-08", "ongoing"],
    ["2026-09-01", today, "ongoing"],
    ["2026-09-01", "2026-09-05", "ended"],
  ])("derives date status", (start, end, status) => expect(deriveEventStatus(start, end, today)).toBe(status));

  it("uses a Tokyo-aware 45-day buffer", () => expect(dailySyncWindow(new Date("2026-09-05T16:00:00Z"))).toEqual({ dateFrom: "2026-07-23", dateTo: "2027-09-06" }));
  it("resolves exact primary, English, and alias names without fuzzy partial matching", () => {
    const venues = [{ id: "1", name: "国立西洋美術館", name_en: "National Museum of Western Art", aliases: ["NMWA"] }];
    expect(resolveVenueName("NMWA", venues).status).toBe("resolved");
    expect(resolveVenueName("西洋美術館", venues).status).toBe("unresolved");
  });
  it("reports multiple exact candidates and preserves higher priority values", () => {
    expect(resolveVenueName("Same", [{ id: "1", name: "Same" }, { id: "2", name: "Same" }]).status).toBe("ambiguous");
    expect(mayApplySourceField("manual")).toBe(false);
    expect(mayApplySourceField("wikidata")).toBe(true);
  });
});
