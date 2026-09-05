import { describe, expect, it } from "vitest";
import { selectWikidataImageCandidates } from "./image-candidates";
import type { ScoredWikidataCandidate } from "@/lib/wikidata/types";

const candidate = (id: string, confidence: number, imageFileTitle: string | null): ScoredWikidataCandidate => ({
  id, confidence, imageFileTitle, labelJa: id, labelEn: null, aliases: [], description: null,
  officialUrl: null, latitude: null, longitude: null, countryId: "Q17", raw: {}, reasons: [],
  suggestedStatus: confidence >= 0.85 ? "matched" : "candidate",
});

describe("unconfirmed Wikidata image candidates", () => {
  it("allows P18 research candidates without lowering the entity auto-match threshold", () => {
    expect(selectWikidataImageCandidates([candidate("Q1", 0.8, "Museum.jpg")]).map((item) => item.id)).toEqual(["Q1"]);
  });

  it("keeps low-confidence references but excludes imageless and human-rejected entities", () => {
    const statuses = new Map([["Q3", "rejected"]]);
    expect(selectWikidataImageCandidates([
      candidate("Q1", 0.5, "Weak.jpg"), candidate("Q2", 0.8, null), candidate("Q3", 0.8, "Rejected.jpg"),
    ], statuses).map((item) => item.id)).toEqual(["Q1"]);
  });
});
