import { describe, expect, it } from "vitest";
import { normalizeSourcePolicyInput } from "./source-policy";

describe("source assertion policy", () => {
  it("accepts low-risk auto apply without review", () => {
    expect(normalizeSourcePolicyInput({ assertionType: "collection_holding", enabled: true, autoApply: true, defaultVisibility: "public", reviewRequired: false }))
      .toEqual({ assertionType: "collection_holding", enabled: true, autoApply: true, defaultVisibility: "public", reviewRequired: false });
  });

  it("keeps Presentation and Media review-only regardless of client input", () => {
    expect(normalizeSourcePolicyInput({ assertionType: "work_presentation", enabled: true, autoApply: true, defaultVisibility: "public", reviewRequired: false }))
      .toEqual({ assertionType: "work_presentation", enabled: true, autoApply: false, defaultVisibility: "hidden", reviewRequired: true });
    expect(normalizeSourcePolicyInput({ assertionType: "media", enabled: true, autoApply: true, defaultVisibility: "public", reviewRequired: false }).reviewRequired).toBe(true);
  });

  it("rejects contradictory low-risk policy", () => {
    expect(() => normalizeSourcePolicyInput({ assertionType: "work_artist", enabled: true, autoApply: true, defaultVisibility: "public", reviewRequired: true })).toThrow("cannot both");
  });
});
