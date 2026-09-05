import { describe, expect, it } from "vitest";
import { classifyWikidataVenueMatch, isProtectedVenueField, shouldSkipWikidataVenue, wikidataImportRunStatus, wikidataVenueChecksum } from "./venue-importer";

describe("Wikidata Venue importer decisions", () => {
  it("uses the QID source checksum for external-ID dedup and unchanged skip", () => {
    const checksum = wikidataVenueChecksum({ qid: "Q1", raw: { a: 1 } });
    expect(shouldSkipWikidataVenue({ id: "source", venue_id: "venue", checksum }, checksum)).toBe(true);
    expect(shouldSkipWikidataVenue({ id: "source", venue_id: null, checksum }, checksum)).toBe(false);
    expect(shouldSkipWikidataVenue({ id: "source", venue_id: "venue", checksum: "old" }, checksum)).toBe(false);
  });

  it("marks a partially processed run with errors as partial", () => {
    expect(wikidataImportRunStatus(10, 1)).toBe("partial");
    expect(wikidataImportRunStatus(0, 1)).toBe("failed");
    expect(wikidataImportRunStatus(10, 0)).toBe("completed");
  });

  it("separates high, possible, and no-existing-match creation paths", () => {
    expect(classifyWikidataVenueMatch(0.9)).toBe("high");
    expect(classifyWikidataVenueMatch(0.7)).toBe("possible");
    expect(classifyWikidataVenueMatch(0.4)).toBe("none");
  });

  it("uses source priority instead of treating every populated field as protected", () => {
    expect(isProtectedVenueField("unattributed value", null)).toBe(false);
    expect(isProtectedVenueField(null, { source: "manual", review_status: "unreviewed" })).toBe(true);
    expect(isProtectedVenueField(null, { source: "official_website", review_status: "applied" })).toBe(true);
    expect(isProtectedVenueField(null, { source: "wikidata", review_status: "unreviewed" })).toBe(false);
  });

  it("marks partial failures without reporting completion", () => {
    expect(wikidataImportRunStatus(20, 1)).toBe("partial");
    expect(wikidataImportRunStatus(0, 1)).toBe("failed");
    expect(wikidataImportRunStatus(20, 0)).toBe("completed");
  });
});
