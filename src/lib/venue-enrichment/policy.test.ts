import { describe, expect, it } from "vitest";
import type { ScoredWikidataCandidate } from "@/lib/wikidata/types";
import { distanceMeters, findCoordinateCandidate, findImageCandidates } from "./policy";

const candidate = (id: string, confidence: number, options: { image?: string; coordinates?: [number, number] } = {}): ScoredWikidataCandidate => ({
  id, confidence, imageFileTitle: options.image || null, labelJa: id, labelEn: null, aliases: [], description: null,
  officialUrl: null, latitude: options.coordinates?.[0] ?? null, longitude: options.coordinates?.[1] ?? null,
  countryId: "Q17", raw: {}, reasons: [], suggestedStatus: confidence >= 0.85 ? "matched" : "candidate",
});

describe("venue enrichment threshold policy", () => {
  it("steps down until the first threshold containing P18", () => {
    const result = findImageCandidates([candidate("Q1", 0.9), candidate("Q2", 0.8, { image: "Museum.jpg" })]);
    expect(result.foundThreshold).toBe(0.8);
    expect(result.candidates.map((item) => item.id)).toEqual(["Q2"]);
    expect(result.trace.map((step) => [step.threshold, step.result])).toEqual([
      [0.95, "not_found"], [0.9, "not_found"], [0.85, "not_found"], [0.8, "found"],
    ]);
  });

  it("distinguishes no candidate image and respects rejection", () => {
    const result = findImageCandidates([candidate("Q1", 0.8, { image: "Museum.jpg" })], new Map([["Q1", "rejected"]]));
    expect(result.foundThreshold).toBeNull();
    expect(result.candidates).toEqual([]);
  });

  it("distinguishes no entity candidates from entities without P18", () => {
    const noEntity = findImageCandidates([]);
    const noImage = findImageCandidates([candidate("Q1", 0.8)]);
    expect(noEntity.trace.every((step) => step.eligibleCount === 0)).toBe(true);
    expect(noImage.trace.some((step) => step.eligibleCount > 0)).toBe(true);
    expect(noImage.trace.every((step) => step.availableCount === 0)).toBe(true);
  });

  it("keeps coordinates as a candidate without adopting the entity", () => {
    const result = findCoordinateCandidate([candidate("Q1", 0.8, { coordinates: [35, 139] })]);
    expect(result).toMatchObject({ threshold: 0.8, candidate: { id: "Q1", latitude: 35, longitude: 139 } });
  });

  it("continues below 0.60 and records the low diagnostic threshold", () => {
    const image = findImageCandidates([candidate("Q-low-image", 0.35, { image: "Low-confidence.jpg" })]);
    const coordinate = findCoordinateCandidate([candidate("Q-low-coordinate", 0.25, { coordinates: [35, 139] })]);
    expect(image.foundThreshold).toBe(0.35);
    expect(image.trace.at(-1)).toMatchObject({ threshold: 0.35, result: "found", qid: "Q-low-image" });
    expect(coordinate).toMatchObject({ threshold: 0.25, candidate: { id: "Q-low-coordinate" } });
  });

  it("calculates the comparison distance", () => {
    expect(distanceMeters({ latitude: 35, longitude: 139 }, { latitude: 35, longitude: 139 })).toBe(0);
  });
});
