import { describe, expect, it } from "vitest";
import { selectSingleSourceCandidate, shouldApplySourceField } from "./source-application";

describe("Venue Source application policy", () => {
  it("auto-selects exactly one candidate regardless of confidence", () => {
    expect(selectSingleSourceCandidate([{ id: "Q1", status: "candidate", confidence: 0.1 }])).toMatchObject({ id: "Q1" });
  });

  it("does not auto-select multiple or zero candidates", () => {
    expect(selectSingleSourceCandidate([])).toBeNull();
    expect(selectSingleSourceCandidate([{ id: "Q1", status: "candidate" }, { id: "Q2", status: "candidate" }])).toBeNull();
  });

  it("ignores rejected rows when deciding whether identity is unique", () => {
    expect(selectSingleSourceCandidate([{ id: "Q1", status: "candidate" }, { id: "Q2", status: "rejected" }])).toMatchObject({ id: "Q1" });
  });

  it("lets Wikidata fill blanks and refresh Wikidata-owned values", () => {
    expect(shouldApplySourceField(null, null)).toBe(true);
    expect(shouldApplySourceField("old", "wikidata")).toBe(true);
  });

  it("protects Official Website and Manual values from Wikidata", () => {
    expect(shouldApplySourceField("official", "official_website")).toBe(false);
    expect(shouldApplySourceField("manual", "manual")).toBe(false);
    expect(shouldApplySourceField(null, "manual")).toBe(false);
  });
});
