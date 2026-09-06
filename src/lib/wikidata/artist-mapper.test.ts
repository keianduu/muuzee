import { describe, expect, it } from "vitest";
import { normalizeArtistEntity } from "./artist-mapper";

const claim = (value: unknown, precision?: number) => [{ mainsnak: { datavalue: { value: precision ? { ...(value as object), precision } : value } } }];
describe("artist mapping", () => {
  it("maps labels, aliases, nationality, dates and raw classification without inference", () => {
    const artist = normalizeArtistEntity("Q42", { labels: { ja: { value: "作家" }, en: { value: "Artist" } }, aliases: { en: [{ value: "A. Artist" }] }, claims: { P27: claim({ id: "Q30" }), P19: claim({ id: "QCITY" }), P569: claim({ time: "+1900-02-03T00:00:00Z" }, 11), P570: claim({ time: "+1980-00-00T00:00:00Z" }, 9), P106: claim({ id: "Q1028181" }), P101: claim({ id: "Q36649" }), P135: claim({ id: "QMOVE" }), P18: claim("Portrait.jpg") }, sitelinks: { enwiki: { title: "Artist" } } }, { Q30: { claims: { P297: claim("US") } }, QCITY: { labels: { en: { value: "City" } }, claims: { P17: claim({ id: "Q30" }) } }, Q1028181: { labels: { en: { value: "painter" } } }, Q36649: { labels: { en: { value: "visual arts" } } }, QMOVE: { labels: { en: { value: "modernism" } } } });
    expect(artist).toMatchObject({ name: "作家", nameEn: "Artist", aliases: ["A. Artist"], nationalityCountryCode: "US", birthDate: "1900-02-03", birthYear: 1900, deathDate: null, deathYear: 1980, birthPlace: "City", imageFileTitle: "Portrait.jpg", wikipediaLanguage: "en" });
    expect(artist?.occupation[0]).toEqual({ qid: "Q1028181", label: "painter" });
  });
  it("does not collapse multiple citizenships into one canonical code", () => {
    const artist = normalizeArtistEntity("Q1", { labels: { en: { value: "A" } }, claims: { P27: [...claim({ id: "Q30" }), ...claim({ id: "Q145" })] } }, { Q30: { claims: { P297: claim("US") } }, Q145: { claims: { P297: claim("GB") } } });
    expect(artist?.nationalityCountryCode).toBeNull(); expect(artist?.nationalityQids).toEqual(["Q30", "Q145"]);
  });
});
