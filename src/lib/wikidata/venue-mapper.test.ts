import { describe, expect, it } from "vitest";
import { mapWikidataVenue } from "./venue-mapper";
import { mapWikidataVenueType } from "./venue-type-mapper";
import type { WikidataVenueCandidate } from "./types";

function entityValue(id: string) { return { mainsnak: { datavalue: { value: { id } } } }; }
function stringValue(value: string) { return { mainsnak: { datavalue: { value } } }; }

const candidate: WikidataVenueCandidate = {
  id: "Q123", labelJa: "テスト美術館", labelEn: "Test Art Museum", aliases: ["テスト館"],
  description: "日本の美術館", officialUrl: "https://museum.example", latitude: 35, longitude: 139,
  imageFileTitle: "Museum.jpg", countryId: "Q17",
  raw: { claims: {
    P31: [entityValue("Q207694")], P131: [entityValue("Q1490")], P281: [stringValue("100-0001")],
    P373: [stringValue("Test museum")], P6375: [{ mainsnak: { datavalue: { value: { text: "東京都テスト区1-1", language: "ja" } } } }],
    P1619: [{ mainsnak: { datavalue: { value: { time: "+1999-01-01T00:00:00Z" } } } }],
  } },
};

describe("Wikidata Venue mapping", () => {
  it("maps Source A fields without inventing a city", () => {
    const mapped = mapWikidataVenue(candidate, ["Q33506"], new Map([["Q1490", "東京都"]]));
    expect(mapped).toMatchObject({ qid: "Q123", name: "テスト美術館", nameEn: "Test Art Museum", venueType: "museum", countryCode: "JP", region: "東京都", city: null, address: "東京都テスト区1-1", postalCode: "100-0001", latitude: 35, longitude: 139, inceptionYear: 1999, imageFileTitle: "Museum.jpg" });
  });

  it("rejects non-Japan entities at normalization", () => {
    expect(mapWikidataVenue({ ...candidate, countryId: "Q30" }, ["Q33506"])).toBeNull();
  });
});

describe("Venue type mapping", () => {
  it("maps art gallery and museum roots centrally and defaults unknown to other", () => {
    expect(mapWikidataVenueType({ instanceOfIds: [], discoveryRootIds: ["Q1007870"] })).toBe("gallery");
    expect(mapWikidataVenueType({ instanceOfIds: ["Q207694"], discoveryRootIds: [] })).toBe("museum");
    expect(mapWikidataVenueType({ instanceOfIds: ["Q999"], discoveryRootIds: [] })).toBe("other");
  });
});
