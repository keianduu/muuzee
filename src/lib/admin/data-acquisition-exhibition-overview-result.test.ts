import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  fail: new Set<string>(),
  filters: [] as Array<[string, string, unknown]>,
}));

vi.mock("@/lib/supabase/admin", () => ({
  hasSupabaseAdminEnvironment: () => true,
  createSupabaseAdminClient: () => ({
    from: (table: string) => {
      let mode = table;
      const filters: Array<[string, string, unknown]> = [];
      const query = {
        select: () => query,
        eq: (field: string, value: unknown) => { filters.push(["eq", field, value]); return query; },
        neq: (field: string, value: unknown) => { filters.push(["neq", field, value]); return query; },
        lt: (field: string, value: unknown) => { filters.push(["lt", field, value]); return query; },
        range: () => {
          state.filters.push(...filters);
          return Promise.resolve(state.fail.has("ended")
            ? { data: null, error: { message: "ended failed" } }
            : { data: [{ exhibition_id: "ended-a" }, { exhibition_id: "ended-a" }, { exhibition_id: "ended-b" }], error: null });
        },
        then: (resolve: (value: { count: number | null; error: { message: string } | null }) => void) => {
          const published = filters.some((filter) => filter[0] === "eq");
          const unpublished = filters.filter((filter) => filter[0] === "neq").length === 2;
          mode = published ? "published" : unpublished ? "unpublished" : mode === "exhibitions" ? "total" : mode;
          state.filters.push(...filters);
          return resolve(state.fail.has(mode)
            ? { count: null, error: { message: `${mode} failed` } }
            : { count: mode === "total" ? 6 : mode === "published" ? 2 : 3, error: null });
        },
      };
      return query;
    },
  }),
}));

import { getExhibitionOperatorOverview } from "./data-acquisition-operator-overview";

describe("Exhibition operator overview result", () => {
  beforeEach(() => {
    state.fail.clear();
    state.filters.length = 0;
    vi.restoreAllMocks();
  });

  it("uses publication status and distinct non-stale past occurrence semantics", async () => {
    const result = await getExhibitionOperatorOverview(new Date("2026-10-31T16:00:00Z"));
    expect(result).toEqual({
      configured: true,
      error: null,
      data: { total: 6, published: 2, unpublished: 3, ended: 2 },
    });
    expect(state.filters).toContainEqual(["eq", "publication_status", "published"]);
    expect(state.filters).toContainEqual(["neq", "publication_status", "published"]);
    expect(state.filters).toContainEqual(["neq", "publication_status", "archived"]);
    expect(state.filters).toContainEqual(["neq", "relation_status", "stale"]);
    expect(state.filters).toContainEqual(["lt", "end_date", "2026-11-01"]);
  });

  it("isolates a lifecycle count failure from publication counts", async () => {
    state.fail.add("ended");
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    const result = await getExhibitionOperatorOverview(new Date("2026-10-31T16:00:00Z"));
    expect(result.data).toEqual({ total: 6, published: 2, unpublished: 3, ended: null });
    expect(result.error).toBe("一部の件数を取得できませんでした。");
  });
});
