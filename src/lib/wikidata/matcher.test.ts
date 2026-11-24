import { describe, expect, it } from "vitest";
import { normalizeVenueName, scoreWikidataCandidate, venueNameMatchKind } from "./matcher";
import type { WikidataVenueCandidate } from "./types";

const candidate = (overrides: Partial<WikidataVenueCandidate> = {}): WikidataVenueCandidate => ({
  id: "Q1", labelJa: "国立新美術館", labelEn: "The National Art Center, Tokyo", aliases: [],
  description: "東京都港区にある日本の美術館", officialUrl: "https://www.nact.jp/", latitude: 35.665,
  longitude: 139.726, imageFileTitle: "National Art Center.jpg", commonsCategory: null, wikipediaArticleTitle: null, countryId: "Q17", raw: {}, ...overrides,
});

describe("Wikidata venue matcher", () => {
  it("normalizes organization prefixes and punctuation", () => {
    expect(normalizeVenueName("独立行政法人 国立・新美術館")).toBe("国立新美術館");
  });

  it("auto-matches only when independent signals support the exact name", () => {
    const result = scoreWikidataCandidate({ name: "国立新美術館", official_url: "https://nact.jp/about", prefecture: "東京都", city: "港区" }, candidate());
    expect(result.suggestedStatus).toBe("matched");
    expect(result.nameMatchKind).toBe("primary_label_exact");
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

  it("classifies primary labels, aliases, and unrelated names explicitly", () => {
    const wikidata = candidate({ aliases: ["国立新美術館別館"] });
    expect(venueNameMatchKind("国立新美術館", wikidata)).toBe("primary_label_exact");
    expect(venueNameMatchKind("国立新美術館別館", wikidata)).toBe("alias_exact");
    expect(venueNameMatchKind("別の美術館", wikidata)).toBe("none");
  });

  it("never marks the Asahikawa alias-only collision pattern as an automatic match", () => {
    const result = scoreWikidataCandidate({
      name: "旭川市博物館",
      official_url: "https://www.city.asahikawa.hokkaido.jp/hakubutukan/index.html",
      prefecture: "北海道",
      city: "旭川市",
    }, candidate({
      id: "Q11511731",
      labelJa: "旭川市大雪クリスタルホール",
      labelEn: "Asahikawa Taisetsu Crystal Hall",
      aliases: ["旭川市博物館", "大雪クリスタルホール"],
      description: "北海道旭川市にあるmuseumを含む複合施設",
      officialUrl: "https://www.city.asahikawa.hokkaido.jp/kurashi/329/348/357/",
      countryId: "Q17",
    }));

    expect(result.nameMatchKind).toBe("alias_exact");
    expect(result.reasons).toContain("alias exact match");
    expect(result.suggestedStatus).toBe("candidate");
  });
});
