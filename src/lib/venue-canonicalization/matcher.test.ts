import { describe, expect, it } from "vitest";
import { rankCanonicalCandidates, scoreCanonicalCandidate, type VenueMatchRecord } from "./matcher";

const venue = (id: string, overrides: Partial<VenueMatchRecord> = {}): VenueMatchRecord => ({ id, name: `Venue ${id}`, aliases: [], qids: [], ...overrides });

describe("venue canonical matcher", () => {
  it("classifies an exact QID as HIGH", () => expect(scoreCanonicalCandidate(venue("a", { qids: ["Q1"] }), venue("b", { qids: ["Q1"] })).category).toBe("HIGH"));
  it("classifies exact official domain and name as HIGH", () => expect(scoreCanonicalCandidate(venue("a", { name: "東京美術館", officialUrl: "https://museum.example/a" }), venue("b", { name: "東京美術館", officialUrl: "https://www.museum.example/" })).category).toBe("HIGH"));
  it("does not auto-merge on name alone", () => {
    const result = scoreCanonicalCandidate(venue("a", { name: "東京美術館" }), venue("b", { name: "東京美術館" }));
    expect(result.category).toBe("POSSIBLE");
    expect(result.autoMergeEligible).toBe(false);
  });
  it("uses nearby coordinates and locality to corroborate a name", () => expect(scoreCanonicalCandidate(
    venue("a", { name: "東京美術館", latitude: 35.0, longitude: 139.0, prefecture: "東京都" }),
    venue("b", { name: "東京美術館", latitude: 35.0001, longitude: 139.0001, prefecture: "東京都" }),
  ).category).toBe("HIGH"));
  it("keeps a weak unrelated candidate as NONE", () => expect(scoreCanonicalCandidate(venue("a", { name: "東京美術館" }), venue("b", { name: "大阪科学館" })).category).toBe("NONE"));
  it("sends conflicting QIDs and dual primary media to review", () => {
    const result = scoreCanonicalCandidate(
      venue("a", { name: "同一美術館", qids: ["Q1"], primaryMediaCount: 1 }),
      venue("b", { name: "同一美術館", qids: ["Q2"], primaryMediaCount: 1 }),
    );
    expect(result.autoMergeEligible).toBe(false);
    expect(result.recommendedAction).toBe("human_review");
  });
  it("returns at most three candidates in score order", () => {
    const ranked = rankCanonicalCandidates(venue("a", { name: "Alpha" }), [venue("b", { name: "Alpha" }), venue("c", { name: "Alfa" }), venue("d"), venue("e")]);
    expect(ranked).toHaveLength(3);
    expect(ranked[0].candidateVenueId).toBe("b");
  });
});
