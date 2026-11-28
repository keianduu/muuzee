import { describe, expect, it, vi } from "vitest";
import { ARTIST_REFERENCE_CACHE_MAX_ENTRIES, fetchNormalizedArtists, normalizeArtistEntity } from "./artist-mapper";
import type { WikidataRawEntity } from "./client";

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
  it("reuses reference entities across batches instead of refetching shared lookups", async () => {
    const fetchEntities = vi.fn(async (qids: string[]): Promise<Record<string, WikidataRawEntity>> => {
      const result: Record<string, WikidataRawEntity> = {};
      for (const qid of qids) {
        result[qid] = qid === "Q30"
          ? { claims: { P297: claim("US") } }
          : { labels: { en: { value: qid } }, claims: { P27: claim({ id: "Q30" }), P106: claim({ id: "Q1028181" }) } };
      }
      return result;
    });
    const cache = new Map();
    await fetchNormalizedArtists([{ qid: "Q1" }], { cache, fetchEntities });
    await fetchNormalizedArtists([{ qid: "Q2" }], { cache, fetchEntities });
    const loaded = fetchEntities.mock.calls.flatMap(([qids]) => qids);
    expect(loaded.filter((qid) => qid === "Q30")).toHaveLength(1);
    expect(loaded.filter((qid) => qid === "Q1028181")).toHaveLength(1);
    expect(cache.has("Q1")).toBe(false);
    expect(cache.has("Q2")).toBe(false);
    expect(cache.size).toBeLessThanOrEqual(ARTIST_REFERENCE_CACHE_MAX_ENTRIES);
  });
  it("fails closed when the provider omits a requested entity", async () => {
    await expect(fetchNormalizedArtists([{ qid: "Q404" }], {
      fetchEntities: vi.fn(async () => ({})),
    })).rejects.toThrow("omitted requested Artist IDs: Q404");
  });
  it("classifies a present entity without a usable label as terminal invalid", async () => {
    const result = await fetchNormalizedArtists([{ qid: "Q1" }], {
      fetchEntities: vi.fn(async (qids: string[]): Promise<Record<string, WikidataRawEntity>> => Object.fromEntries(qids.map((qid) => [qid, { claims: {} }]))),
    });
    expect(result.artists).toEqual([]);
    expect(result.errors).toEqual([{ qid: "Q1", message: "Artist has no usable label", terminal: true }]);
  });
});
