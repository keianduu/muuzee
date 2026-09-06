import { describe, expect, it } from "vitest";
import { matchApjArtistCandidates, parseApjArtistPage, type ApjArtistRecord } from "./apj-client";

const record = (overrides: Partial<ApjArtistRecord> = {}): ApjArtistRecord => ({
  id: "A1", url: "https://artplatform.go.jp/artists/A1", name: "平山郁夫", nameEn: "HIRAYAMA Ikuo",
  aliases: [], birthYear: 1930, deathYear: 2009, birthPlace: "瀬戸田町", ulanId: "500319544",
  wikidataId: "Q3124280", nationalityRaw: null, ...overrides,
});

describe("APJ artist identity matching", () => {
  it("accepts one exact name and date match", () => {
    expect(matchApjArtistCandidates({ name: "平山郁夫", birthYear: 1930, deathYear: 2009 }, [record()]).status).toBe("exact");
  });

  it("keeps multiple exact candidates ambiguous", () => {
    expect(matchApjArtistCandidates({ name: "平山郁夫" }, [record(), record({ id: "A2" })]).status).toBe("ambiguous");
  });

  it("parses authority identifiers without inferring nationality", () => {
    const parsed = parseApjArtistPage("<html><body><h1>平山郁夫</h1><p>1930 | 2009</p><p>ULAN ID 500319544</p><p>Wikidata ID Q3124280</p></body></html>", "A1822");
    expect(parsed).toMatchObject({ id: "A1822", name: "平山郁夫", birthYear: 1930, deathYear: 2009, ulanId: "500319544", wikidataId: "Q3124280", nationalityRaw: null });
  });
});
