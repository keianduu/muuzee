import { describe, expect, it, vi } from "vitest";
import { completeExhibitionMutation } from "./exhibition-mutation";

describe("Exhibition mutation completion", () => {
  it("applies immediate UI state, awaits authoritative Detail refresh, then notifies the list", async () => {
    const order: string[] = [];
    await completeExhibitionMutation({
      applyImmediate: () => order.push("media"),
      refreshDetail: async () => { order.push("detail:start"); await Promise.resolve(); order.push("detail:end"); },
      notifyList: () => order.push("list"),
    });
    expect(order).toEqual(["media", "detail:start", "detail:end", "list"]);
  });

  it("does not notify the list when the authoritative Detail refresh fails", async () => {
    const notifyList = vi.fn();
    await expect(completeExhibitionMutation({
      refreshDetail: async () => { throw new Error("refresh failed"); },
      notifyList,
    })).rejects.toThrow("refresh failed");
    expect(notifyList).not.toHaveBeenCalled();
  });
});
