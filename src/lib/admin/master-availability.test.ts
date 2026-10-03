import { describe, expect, it } from "vitest";
import { masterImageState, venuePositionState } from "./master-availability";

const candidateRows = (...candidates: Array<Record<string, unknown>>) => ({
  source_records: [{ source_image_candidates: candidates }],
});

describe("master image availability", () => {
  it("treats untouched records as unfetched", () => {
    expect(masterImageState({ media_assets: [], source_records: [] })).toBe("未取得");
  });

  it("distinguishes a completed search with no result", () => {
    expect(masterImageState({ image_search_status: "no_image_found" })).toBe("画像なし");
  });

  it("treats exactly one candidate as available for review", () => {
    expect(masterImageState(candidateRows({ is_active: true, rights_status: "needs_review" }))).toBe("候補あり");
  });

  it("treats multiple candidates as available for review", () => {
    expect(masterImageState(candidateRows({ is_active: true }, { is_active: true }))).toBe("候補あり");
  });

  it("treats an uploaded needs-review asset as a candidate", () => {
    expect(masterImageState({ media_assets: [{ rights_status: "needs_review" }] })).toBe("候補あり");
  });

  it("treats rejected-only evidence as unavailable", () => {
    expect(masterImageState({ media_assets: [{ rights_status: "rejected" }] })).toBe("利用不可");
  });

  it("treats any approved uploaded asset as usable without requiring Primary", () => {
    expect(masterImageState({ media_assets: [{ is_primary: false, rights_status: "approved" }] })).toBe("利用可能");
  });
});

describe("venue position availability", () => {
  it("treats current coordinates as confirmed", () => {
    expect(venuePositionState({ latitude: 35, longitude: 139, coordinate_status: "approved" })).toBe("確認済み");
  });

  it("treats a usable candidate without current coordinates as a candidate", () => {
    expect(venuePositionState({ coordinate_candidate_latitude: 35, coordinate_candidate_longitude: 139, coordinate_status: "candidate" })).toBe("候補あり");
  });

  it("treats missing coordinates as unavailable", () => {
    expect(venuePositionState({ coordinate_status: "missing" })).toBe("取得不可");
  });

  it("treats a rejected-only candidate as unavailable", () => {
    expect(venuePositionState({ coordinate_candidate_latitude: 35, coordinate_candidate_longitude: 139, coordinate_status: "rejected" })).toBe("取得不可");
  });

  it("treats manually entered current coordinates as confirmed", () => {
    expect(venuePositionState({ latitude: 35, longitude: 139, coordinate_status: "manual" })).toBe("確認済み");
  });
});
