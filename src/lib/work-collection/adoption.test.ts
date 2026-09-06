import { describe, expect, it, vi } from "vitest";
import { adoptWorkCandidates, hasWorkCandidateCore, workCandidateAdoptionReasons } from "./adoption";
import { preservedCandidateState } from "./targeted";

describe("Work candidate adoption", () => {
  it("requires the Core 3 fields", () => {
    expect(hasWorkCandidateCore({ title: "Work", artist_id: "a", matched_venue_id: "v" })).toBe(true);
    expect(hasWorkCandidateCore({ title_original: "De sterrennacht", artist_id: "a", matched_venue_id: "v" })).toBe(true);
    expect(hasWorkCandidateCore({ title: "Work", artist_id: "a", matched_venue_id: null })).toBe(false);
  });

  it("explains every reason a candidate cannot be adopted", () => {
    expect(workCandidateAdoptionReasons({ match_status: "candidate", source_venue_name: null }))
      .toEqual(["作品名が登録されていません", "アーティスト情報と紐づいていません", "所蔵先情報が登録されていません"]);
    expect(workCandidateAdoptionReasons({ title: "Work", artist_id: "a", match_status: "ambiguous", source_venue_name: "Museum" }))
      .toEqual(["所蔵先に一致する会場候補が複数あります"]);
    expect(workCandidateAdoptionReasons({ title: "Work", artist_id: "a", matched_venue_id: "v", match_status: "imported" }))
      .toEqual(["採用済み"]);
    expect(workCandidateAdoptionReasons({ title: "Work", artist_id: "a", matched_venue_id: "v", match_status: "candidate" }))
      .toEqual([]);
  });

  it("deduplicates candidate IDs before calling the atomic RPC", async () => {
    const rpc = vi.fn().mockResolvedValue({ data: { workId: "w" }, error: null });
    const results = await adoptWorkCandidates(["c", "c"], { rpc } as never);
    expect(rpc).toHaveBeenCalledTimes(1);
    expect(results).toHaveLength(1);
  });

  it("preserves adopted state when a source candidate is fetched again", () => {
    expect(preservedCandidateState({ match_status: "imported", matched_work_id: "work-1" }, "duplicate", "work-2"))
      .toEqual({ matchStatus: "imported", matchedWorkId: "work-1" });
  });
});
