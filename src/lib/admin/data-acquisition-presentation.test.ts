import { describe, expect, it } from "vitest";
import { RESOLUTION_STATUS_LABELS, resolutionEntityLabel, resolutionStatusLabel } from "./data-acquisition-presentation";

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
});
