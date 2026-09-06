import { describe, expect, it } from "vitest";
import { buildArtistDiscoveryQuery, normalizeArtistDiscovery, VISUAL_ARTIST_OCCUPATION_QID } from "./artist-discovery";

describe("artist discovery", () => {
  it("uses the verified visual-artist occupation tree without a country restriction", () => {
    const query = buildArtistDiscoveryQuery({ limit: 20 });
    expect(query).toContain(`wd:${VISUAL_ARTIST_OCCUPATION_QID}`); expect(query).toContain("P106/wdt:P279*"); expect(query).not.toContain("P17");
  });
  it("normalizes and deduplicates QIDs", () => {
    expect(normalizeArtistDiscovery({ results: { bindings: [{ item: { value: "http://www.wikidata.org/entity/Q1" } }, { item: { value: "http://www.wikidata.org/entity/Q1" } }] } })).toEqual([{ qid: "Q1" }]);
  });
});
