import { describe, expect, it, vi } from "vitest";
import { adoptWorkCandidates, hasWorkCandidateCore } from "./adoption";
import { preservedCandidateState } from "./targeted";

describe("Work candidate adoption", () => {
  it("requires the Core 3 fields", () => {
    expect(hasWorkCandidateCore({ title: "Work", artist_id: "a", matched_venue_id: "v" })).toBe(true);
    expect(hasWorkCandidateCore({ title_original: "De sterrennacht", artist_id: "a", matched_venue_id: "v" })).toBe(true);
    expect(hasWorkCandidateCore({ title: "Work", artist_id: "a", matched_venue_id: null })).toBe(false);
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
