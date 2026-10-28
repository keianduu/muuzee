import type { SupabaseClient } from "@supabase/supabase-js";
import { beforeEach, describe, expect, it, vi } from "vitest";

const discoverWikidataVenues = vi.hoisted(() => vi.fn());
const discoverWikidataVenuePage = vi.hoisted(() => vi.fn());

vi.mock("./venue-discovery", () => ({
  discoverWikidataVenues,
  discoverWikidataVenuePage,
}));

import { importWikidataVenues } from "./venue-importer";

function importDb() {
  const runUpdates: Array<Record<string, unknown>> = [];
  let staleRecoveryReads = 0;

  const db = {
    from(table: string) {
      if (table === "data_sources") {
        return {
          select: () => ({
            eq: async () => ({ data: [{ id: "wikidata-source", key: "wikidata" }], error: null }),
          }),
        };
      }
      if (table === "venues") {
        return {
          select: () => ({
            order: () => ({
              range: async () => ({ data: [], error: null, count: 0 }),
            }),
          }),
        };
      }
      if (table === "import_runs") {
        return {
          select: (columns: string) => {
            if (columns === "id") {
              staleRecoveryReads += 1;
              const chain = {
                eq: () => chain,
                lt: async () => ({ data: [], error: null }),
              };
              return chain;
            }
            return {
              eq: () => ({
                order: () => ({
                  limit: () => ({
                    maybeSingle: async () => ({ data: null, error: null }),
                  }),
                }),
              }),
            };
          },
          insert: () => ({
            select: () => ({
              single: async () => ({ data: { id: "run-1" }, error: null }),
            }),
          }),
          update: (payload: Record<string, unknown>) => {
            runUpdates.push(payload);
            return { eq: async () => ({ error: null }) };
          },
        };
      }
      throw new Error(`Unexpected table: ${table}`);
    },
  } as unknown as SupabaseClient;

  return { db, runUpdates, staleRecoveryReads: () => staleRecoveryReads };
}

describe("Wikidata Venue importer hosted runtime finalization", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    discoverWikidataVenues.mockRejectedValue(new Error("WDQS request timed out"));
  });

  it("returns normally and finishes a hosted run as failed when discovery cannot start Core processing", async () => {
    const { db, runUpdates, staleRecoveryReads } = importDb();

    const result = await importWikidataVenues({ mode: "count", count: 5, offset: 5, runtime: "hosted" }, db);

    expect(result.errors).toEqual([{ message: "WDQS request timed out" }]);
    expect(runUpdates.at(-1)).toMatchObject({
      status: "failed",
      fetched_count: 0,
      error_count: 1,
      finished_at: expect.any(String),
    });
    expect(staleRecoveryReads()).toBe(1);
    expect(discoverWikidataVenues).toHaveBeenCalledWith(expect.objectContaining({
      limit: 5,
      offset: 5,
      runtimeBudget: expect.objectContaining({ runtime: "hosted" }),
    }));
  });

  it("does not perform abandoned-run recovery for LOCAL imports", async () => {
    const { db, staleRecoveryReads } = importDb();

    await importWikidataVenues({ mode: "count", count: 5, offset: 5, runtime: "local" }, db);

    expect(staleRecoveryReads()).toBe(0);
  });
});
