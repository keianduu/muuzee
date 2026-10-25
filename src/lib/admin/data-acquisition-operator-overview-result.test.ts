import { beforeEach, describe, expect, it, vi } from "vitest";

type QueryKey = `${"venues" | "artists" | "works"}:${"total" | "published"}`;

const state = vi.hoisted(() => ({
  configured: true,
  counts: {
    "venues:total": 58,
    "venues:published": 4,
    "artists:total": 57,
    "artists:published": 3,
    "works:total": 57,
    "works:published": 3,
  } as Record<string, number>,
  failures: new Set<string>(),
  fromCalls: [] as string[],
}));

const queryError = {
  code: "PGRST_TEST",
  message: "count failed",
  details: "sanitized details",
  hint: "sanitized hint",
  status: 503,
  serviceRoleKey: "must-not-be-logged",
  environmentValue: "must-not-be-logged",
};

vi.mock("@/lib/supabase/admin", () => ({
  hasSupabaseAdminEnvironment: () => state.configured,
  createSupabaseAdminClient: () => ({
    from: (entity: "venues" | "artists" | "works") => {
      state.fromCalls.push(entity);
      let publishedOnly = false;
      const query = {
        select: () => query,
        is: () => query,
        eq: () => {
          publishedOnly = true;
          return query;
        },
        then: (resolve: (value: { count: number | null; error: typeof queryError | null }) => void) => {
          const key: QueryKey = `${entity}:${publishedOnly ? "published" : "total"}`;
          return resolve({
            count: state.failures.has(key) ? null : state.counts[key],
            error: state.failures.has(key) ? queryError : null,
          });
        },
      };
      return query;
    },
  }),
}));

import { getMasterOperatorOverviews } from "./data-acquisition-operator-overview";

describe("Master operator overview result states", () => {
  beforeEach(() => {
    state.configured = true;
    state.failures.clear();
    state.fromCalls.length = 0;
    Object.assign(state.counts, {
      "venues:total": 58,
      "venues:published": 4,
      "artists:total": 57,
      "artists:published": 3,
      "works:total": 57,
      "works:published": 3,
    });
    vi.restoreAllMocks();
  });

  it("returns real counts for every Entity when all queries succeed", async () => {
    const result = await getMasterOperatorOverviews();
    expect(result).toEqual({
      configured: true,
      error: null,
      data: [
        { entity: "venues", total: 58, published: 4, unpublished: 54 },
        { entity: "artists", total: 57, published: 3, unpublished: 54 },
        { entity: "works", total: 57, published: 3, unpublished: 54 },
      ],
    });
  });

  it("distinguishes a configured real zero from unavailable data", async () => {
    Object.keys(state.counts).forEach((key) => { state.counts[key] = 0; });
    const result = await getMasterOperatorOverviews();
    expect(result.data.every((overview) => overview.total === 0 && overview.published === 0 && overview.unpublished === 0)).toBe(true);
  });

  it.each([
    ["venues:total", "venues"],
    ["venues:published", "venues"],
    ["artists:total", "artists"],
    ["works:published", "works"],
  ] as const)("isolates a %s failure to its Entity", async (failure, failedEntity) => {
    state.failures.add(failure);
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    const result = await getMasterOperatorOverviews();
    expect(result.configured).toBe(true);
    expect(result.error).toBe("一部のMaster件数を取得できませんでした。");
    expect(result.data.find((overview) => overview.entity === failedEntity)).toEqual({
      entity: failedEntity,
      total: null,
      published: null,
      unpublished: null,
    });
    expect(result.data.filter((overview) => overview.entity !== failedEntity).every((overview) => overview.total !== null)).toBe(true);
  });

  it("returns every Entity as unavailable when all three fail", async () => {
    state.failures.add("venues:total");
    state.failures.add("artists:total");
    state.failures.add("works:total");
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    const result = await getMasterOperatorOverviews();
    expect(result.configured).toBe(true);
    expect(result.error).toBe("Master件数を取得できませんでした。時間をおいて再度お試しください。");
    expect(result.data.every((overview) => overview.total === null && overview.published === null && overview.unpublished === null)).toBe(true);
  });

  it("logs only sanitized error metadata with the failed Entity and count type", async () => {
    state.failures.add("artists:published");
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    await getMasterOperatorOverviews();
    expect(errorSpy).toHaveBeenCalledWith("[admin:data-acquisition] Master count failed", {
      entity: "artists",
      countType: "published",
      code: "PGRST_TEST",
      message: "count failed",
      details: "sanitized details",
      hint: "sanitized hint",
      status: 503,
    });
    const logged = JSON.stringify(errorSpy.mock.calls);
    expect(logged).not.toContain("must-not-be-logged");
    expect(logged).not.toContain("serviceRoleKey");
    expect(logged).not.toContain("environmentValue");
  });

  it("returns unavailable metrics and an unusable environment state when unconfigured", async () => {
    state.configured = false;
    const result = await getMasterOperatorOverviews();
    expect(result.configured).toBe(false);
    expect(result.data.every((overview) => overview.total === null)).toBe(true);
    expect(state.fromCalls).toEqual([]);
  });
});
