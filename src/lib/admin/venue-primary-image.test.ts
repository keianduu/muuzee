import { describe, expect, it } from "vitest";
import { chooseAutoPrimaryCandidate } from "./primary-image-policy";

describe("venue image auto-primary rule", () => {
  it("uses the shared P18-first policy", () => {
    const decision = chooseAutoPrimaryCandidate({ primaryCount: 0, candidates: [
      { id: "fallback", discovery_source: "commons_category", is_active: true },
      { id: "p18", discovery_source: "wikidata_p18", is_active: true },
    ] });
    expect(decision).toMatchObject({ candidateId: "p18", reason: "wikidata_p18" });
  });
});
