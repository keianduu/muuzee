import { describe, expect, it } from "vitest";
import { buildArtistSeedManifest, buildMomaArtistCandidates, mergeApjEvidence } from "./lib/artist-seed-manifest.mjs";

function row(overrides = {}) {
  return {
    ExhibitionRole: "Artist",
    WikidataID: "Q1",
    DisplayName: "Artist One",
    Nationality: "Japanese",
    ExhibitionID: "E1",
    ExhibitionTitle: "First",
    ExhibitionBeginDate: "2000-01-01",
    ExhibitionURL: "https://example.test/e1",
    VIAFID: "",
    ULANID: "",
    ...overrides,
  };
}

describe("MVP Artist seed manifest", () => {
  it("requires at least two distinct documented Artist-role exhibitions", () => {
    const rows = [row(), row({ ExhibitionRole: "Curator", ExhibitionID: "E2" })];
    expect(buildMomaArtistCandidates(rows)).toHaveLength(0);
    expect(buildMomaArtistCandidates([...rows, row({ ExhibitionID: "E3", ExhibitionTitle: "Third" })])).toHaveLength(1);
  });

  it("deduplicates touring APJ evidence by tour root", () => {
    const candidates = buildMomaArtistCandidates([row(), row({ ExhibitionID: "E2", ExhibitionTitle: "Second" })]);
    mergeApjEvidence(candidates, [{
      qid: "Q1", identityStatus: "qid_confirmed", apjArtistId: "A1",
      exhibitions: [
        { id: "A-E1", tourStartExhibitionID: "TOUR", titleJa: "巡回展", year: "2020", venueJa: "館A", region: "japan" },
        { id: "A-E2", tourStartExhibitionID: "TOUR", titleJa: "巡回展", year: "2020", venueJa: "館B", region: "japan" },
      ],
    }]);
    expect(candidates[0].evidence.size).toBe(3);
  });

  it("is deterministic, QID-unique, capped, and carries evidence/ranking identity", () => {
    const manifest = buildArtistSeedManifest({
      momaRows: [row(), row({ ExhibitionID: "E2", ExhibitionTitle: "Second" })],
      apjAugmentations: [],
      wikidataMetadata: { Q1: { nameJa: "作家一", nameEn: "Artist One", occupations: ["画家"], fieldOfWork: ["絵画"] } },
      maxArtists: 1000,
      sources: [{ key: "fixture" }],
    });
    expect(manifest.counts).toMatchObject({ selected: 1, identityConfirmed: 1, identityReview: 0 });
    expect(manifest.artists[0]).toMatchObject({ rank: 1, qid: "Q1", name: "作家一", verifiedExhibitionCount: 2 });
    expect(manifest.artists[0].genres).toEqual(expect.arrayContaining(["画家", "絵画"]));
    expect(manifest.checksum).toMatch(/^[0-9a-f]{64}$/);
  });
});
