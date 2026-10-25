import { describe, expect, it } from "vitest";
import { RESOLUTION_STATUS_LABELS, resolutionEntityLabel, resolutionOperatorQueues, resolutionStatusLabel } from "./data-acquisition-presentation";

describe("Data Acquisition presentation", () => {
  it("maps every Targeted Resolution status to the approved Japanese label", () => {
    expect(RESOLUTION_STATUS_LABELS).toEqual({
      pending: "未処理",
      resolved: "解決済み",
      ambiguous: "候補が複数",
      no_candidate: "候補なし",
      failed: "取得・処理エラー",
    });
    expect(resolutionStatusLabel("unknown")).toBe("unknown");
  });

  it("keeps the canonical Venue / Artist entity names", () => {
    expect(resolutionEntityLabel("venue")).toBe("Venue");
    expect(resolutionEntityLabel("artist")).toBe("Artist");
  });

  it.each([
    ["pending-only", { venuePending: 1 }, { automatic: 1, human: 0, showAutomaticActions: true }],
    ["failed-only", { artistFailed: 2 }, { automatic: 2, human: 0, showAutomaticActions: true }],
    ["ambiguous-only", { venueAmbiguous: 1 }, { automatic: 0, human: 1, showAutomaticActions: false }],
    ["no-candidate-only", { artistNoCandidate: 3 }, { automatic: 0, human: 3, showAutomaticActions: false }],
    ["resolved-only", { resolved: 4 }, { automatic: 0, human: 0, showAutomaticActions: false }],
    ["mixed", { venuePending: 2, artistFailed: 1, venueAmbiguous: 4, artistNoCandidate: 3 }, { automatic: 3, human: 7, showAutomaticActions: true }],
  ])("separates %s operator queue semantics", (_label, counts, expected) => {
    expect(resolutionOperatorQueues(counts)).toEqual(expected);
  });
});
