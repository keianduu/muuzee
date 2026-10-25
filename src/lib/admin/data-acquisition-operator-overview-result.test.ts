import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({ configured: true, queryError: true }));

vi.mock("@/lib/supabase/admin", () => ({
  hasSupabaseAdminEnvironment: () => state.configured,
  createSupabaseAdminClient: () => ({
    from: () => {
      const query = {
        select: () => query,
        is: () => query,
        eq: () => query,
        then: (resolve: (value: { count: number | null; error: Error | null }) => void) => resolve({
          count: state.queryError ? null : 0,
          error: state.queryError ? new Error("count failed") : null,
        }),
      };
      return query;
    },
  }),
}));

import { getMasterOperatorOverviews } from "./data-acquisition-operator-overview";

describe("Master operator overview result states", () => {
  beforeEach(() => {
    state.configured = true;
    state.queryError = true;
  });

  it("keeps actions eligible while count-query failures return unavailable metrics", async () => {
    const result = await getMasterOperatorOverviews();
    expect(result.configured).toBe(true);
    expect(result.data.every((overview) => overview.total === null)).toBe(true);
  });

  it("distinguishes a configured real zero from unavailable data", async () => {
    state.queryError = false;
    const result = await getMasterOperatorOverviews();
    expect(result.configured).toBe(true);
    expect(result.error).toBeNull();
    expect(result.data.every((overview) => overview.total === 0 && overview.published === 0 && overview.unpublished === 0)).toBe(true);
  });

  it("returns unavailable metrics and an unusable environment state when unconfigured", async () => {
    state.configured = false;
    const result = await getMasterOperatorOverviews();
    expect(result.configured).toBe(false);
    expect(result.data.every((overview) => overview.total === null)).toBe(true);
  });
});
