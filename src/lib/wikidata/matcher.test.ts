import { describe, expect, it } from "vitest";
import { normalizeVenueName, scoreWikidataCandidate } from "./matcher";
import type { WikidataVenueCandidate } from "./types";

const candidate = (overrides: Partial<WikidataVenueCandidate> = {}): WikidataVenueCandidate => ({
  id: "Q1", labelJa: "国立新美術館", labelEn: "The National Art Center, Tokyo", aliases: [],
  description: "東京都港区にある日本の美術館", officialUrl: "https://www.nact.jp/", latitude: 35.665,
  longitude: 139.726, imageFileTitle: "National Art Center.jpg", countryId: "Q17", raw: {}, ...overrides,
});

describe("Wikidata venue matcher", () => {
  it("normalizes organization prefixes and punctuation", () => {
    expect(normalizeVenueName("独立行政法人 国立・新美術館")).toBe("国立新美術館");
  });

  it("auto-matches only when independent signals support the exact name", () => {
    const result = scoreWikidataCandidate({ name: "国立新美術館", official_url: "https://nact.jp/about", prefecture: "東京都", city: "港区" }, candidate());
    expect(result.suggestedStatus).toBe("matched");
    expect(result.confidence).toBe(1);
  });

  it("does not auto-match an exact name with a conflicting official domain", () => {
    const result = scoreWikidataCandidate({ name: "国立新美術館", official_url: "https://example.jp" }, candidate({ description: "museum", countryId: null }));
    expect(result.suggestedStatus).toBe("candidate");
    expect(result.reasons).toContain("official domain mismatch");
  });

  it("keeps weak name-only results as diagnostics candidates", () => {
    const result = scoreWikidataCandidate({ name: "同名施設" }, candidate({ labelJa: "別の施設", labelEn: null, description: null, countryId: null }));
    expect(result.suggestedStatus).toBe("candidate");
    expect(result.confidence).toBe(0);
  });
});
