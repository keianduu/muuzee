import type { SupabaseClient } from "@supabase/supabase-js";
import { beforeEach, describe, expect, it, vi } from "vitest";

const discoverWikidataVenues = vi.hoisted(() => vi.fn());
const discoverWikidataVenuePage = vi.hoisted(() => vi.fn());
const getWikidataEntities = vi.hoisted(() => vi.fn());

vi.mock("./venue-discovery", () => ({
  discoverWikidataVenues,
  discoverWikidataVenuePage,
}));
vi.mock("./client", () => ({ getWikidataEntities }));

import { importWikidataVenues, wikidataVenueChecksum } from "./venue-importer";
import { mapWikidataVenue } from "./venue-mapper";

function importDb(claimed: Array<Record<string, unknown>> = []) {
  const runUpdates: Array<Record<string, unknown>> = [];
  const rpcCalls: Array<{ name: string; args: Record<string, unknown> }> = [];
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
    async rpc(name: string, args: Record<string, unknown>) {
      rpcCalls.push({ name, args });
      if (name === "claim_venue_discovery_inventory") return { data: claimed, error: null };
      if (name === "release_venue_discovery_inventory_claims") return { data: 0, error: null };
      return { data: null, error: null };
    },
  } as unknown as SupabaseClient;

  return { db, runUpdates, rpcCalls, staleRecoveryReads: () => staleRecoveryReads };
}

function resultQuery(data: unknown, count: number | null = null) {
  const result = { data, error: null, count };
  const query: Record<string, unknown> = {};
  for (const method of ["eq", "in", "not", "neq", "lt", "order", "range", "limit", "select"]) {
    query[method] = () => query;
  }
  query.single = async () => result;
  query.maybeSingle = async () => result;
  query.then = (resolve: (value: typeof result) => unknown, reject: (reason: unknown) => unknown) => Promise.resolve(result).then(resolve, reject);
  return query;
}

function inventoryCoreDb(
  existingRows: Array<Record<string, unknown>> = [],
  sourceBefore: { id: string; venue_id: string | null; checksum: string | null } | null = null,
) {
  const rpcCalls: Array<{ name: string; args: Record<string, unknown> }> = [];
  const rows = [...existingRows];
  const sourceRecord = sourceBefore || { id: "source-record", venue_id: null, checksum: null };
  const candidate = { id: "inventory-1", external_id: "Q1", discovery_root_ids: ["Q33506"], attempt_count: 1 };

  const db = {
    from(table: string) {
      if (table === "data_sources") return { select: () => resultQuery([{ id: "wikidata-source", key: "wikidata" }]) };
      if (table === "import_runs") return {
        select: () => resultQuery([]),
        insert: () => resultQuery({ id: "run-1" }),
        update: () => resultQuery(null),
      };
      if (table === "venues") return {
        select: () => resultQuery(rows, rows.length),
        insert: (payload: Record<string, unknown>) => {
          const created = { id: "created-venue", ...payload };
          rows.push(created);
          return resultQuery(created);
        },
        update: () => resultQuery(null),
      };
      if (table === "source_records") return {
        select: () => resultQuery(sourceBefore),
        upsert: () => resultQuery(sourceRecord),
        update: () => resultQuery(null),
      };
      if (table === "venue_external_match_candidates") return {
        select: () => resultQuery(null),
        upsert: () => resultQuery(null),
      };
      if (table === "venue_field_sources") return {
        select: () => resultQuery([]),
        update: () => resultQuery(null),
        insert: () => resultQuery(null),
      };
      throw new Error(`Unexpected table: ${table}`);
    },
    async rpc(name: string, args: Record<string, unknown>) {
      rpcCalls.push({ name, args });
      if (name === "claim_venue_discovery_inventory") return { data: [candidate], error: null };
      return { data: null, error: null };
    },
  } as unknown as SupabaseClient;

  return { db, rpcCalls };
}

const validVenueCandidate = {
  id: "Q1",
  labelJa: "テスト美術館",
  labelEn: "Test Museum",
  aliases: [],
  description: "日本の美術館",
  officialUrl: "https://museum.example",
  latitude: 35,
  longitude: 139,
  imageFileTitle: null,
  commonsCategory: null,
  wikipediaArticleTitle: null,
  countryId: "Q17",
  raw: { claims: { P31: [{ mainsnak: { datavalue: { value: { id: "Q33506" } } } }] } },
};

describe("Wikidata Venue importer hosted runtime finalization", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    discoverWikidataVenues.mockRejectedValue(new Error("WDQS request timed out"));
    getWikidataEntities.mockRejectedValue(new Error("Wikidata detail request timed out"));
  });

  it("claims hosted count work from Inventory without calling WDQS Discovery", async () => {
    const { db, runUpdates, rpcCalls, staleRecoveryReads } = importDb([{
      id: "inventory-1", external_id: "Q1", discovery_root_ids: ["Q33506"], attempt_count: 1,
    }]);

    const result = await importWikidataVenues({ mode: "count", count: 5, offset: 5, runtime: "hosted" }, db);

    expect(result.errors).toEqual([{ qid: "Q1", message: "Wikidata detail request timed out" }]);
    expect(result.inventoryClaimed).toBe(1);
    expect(result.inventoryRetried).toBe(1);
    expect(runUpdates.at(-1)).toMatchObject({
      status: "failed",
      fetched_count: 0,
      error_count: 1,
      finished_at: expect.any(String),
    });
    expect((runUpdates.at(-1)?.metrics as Record<string, unknown>)).not.toHaveProperty("discoveryOffsetEnd");
    expect(staleRecoveryReads()).toBe(1);
    expect(discoverWikidataVenues).not.toHaveBeenCalled();
    expect(rpcCalls[0]).toMatchObject({ name: "claim_venue_discovery_inventory", args: { p_limit: 5 } });
    expect(rpcCalls.some((call) => call.name === "retry_venue_discovery_inventory_candidate")).toBe(true);
  });

  it("cleanly completes an empty hosted Inventory without WDQS fallback", async () => {
    const { db, runUpdates } = importDb();

    const result = await importWikidataVenues({ mode: "count", count: 50, runtime: "hosted" }, db);

    expect(result.inventoryEmpty).toBe(true);
    expect(result.operatorMessage).toBe("現在取り込める新規候補はありません。");
    expect(result.inventoryClaimed).toBe(0);
    expect(discoverWikidataVenues).not.toHaveBeenCalled();
    expect(runUpdates.at(-1)).toMatchObject({ status: "completed", requested_count: 5 });
  });

  it("marks a successfully fetched but unusable entity invalid and continues cleanly", async () => {
    getWikidataEntities.mockResolvedValue([]);
    const { db, runUpdates, rpcCalls } = importDb([{
      id: "inventory-invalid", external_id: "Q404", discovery_root_ids: ["Q33506"], attempt_count: 1,
    }]);

    const result = await importWikidataVenues({ mode: "count", count: 5, runtime: "hosted" }, db);

    expect(result.inventoryInvalid).toBe(1);
    expect(result.inventoryRetried).toBe(0);
    expect(result.errors).toEqual([]);
    expect(runUpdates.at(-1)).toMatchObject({ status: "completed" });
    expect(rpcCalls.some((call) => call.name === "invalidate_venue_discovery_inventory_candidate")).toBe(true);
  });

  it("releases all remaining owned claims on a controlled runtime stop", async () => {
    const { db, rpcCalls } = importDb([
      { id: "inventory-1", external_id: "Q1", discovery_root_ids: [], attempt_count: 1 },
      { id: "inventory-2", external_id: "Q2", discovery_root_ids: [], attempt_count: 1 },
    ]);

    const result = await importWikidataVenues({
      mode: "count", count: 5, runtime: "hosted", runtimeBudgetMs: 0, now: () => 1_000,
    }, db);

    expect(result.runtimeBudgetExhausted).toBe(true);
    expect(rpcCalls.filter((call) => call.name === "release_venue_discovery_inventory_claims")).toHaveLength(1);
    expect(getWikidataEntities).not.toHaveBeenCalled();
  });

  it("reuses the canonical core to create and settle a hosted Inventory candidate", async () => {
    getWikidataEntities.mockResolvedValue([validVenueCandidate]);
    const { db, rpcCalls } = inventoryCoreDb();

    const result = await importWikidataVenues({ mode: "count", count: 5, runtime: "hosted" }, db);

    expect(result.newVenues).toBe(1);
    expect(result.inventoryProcessed).toBe(1);
    expect(rpcCalls).toContainEqual({
      name: "process_venue_discovery_inventory_candidate",
      args: { p_inventory_id: "inventory-1", p_run_id: "run-1", p_linked_venue_id: "created-venue" },
    });
  });

  it("settles a Human-review identity outcome without a linked Venue", async () => {
    getWikidataEntities.mockResolvedValue([validVenueCandidate]);
    const { db, rpcCalls } = inventoryCoreDb([{
      id: "possible-venue",
      name: "テスト美術館",
      official_url: "https://different.example",
      prefecture: null,
      city: null,
    }]);

    const result = await importWikidataVenues({ mode: "count", count: 5, runtime: "hosted" }, db);

    expect(result.sourceSelectionRequired).toBe(1);
    expect(result.inventoryProcessed).toBe(1);
    expect(rpcCalls).toContainEqual({
      name: "process_venue_discovery_inventory_candidate",
      args: { p_inventory_id: "inventory-1", p_run_id: "run-1", p_linked_venue_id: null },
    });
  });

  it("links an existing high-confidence Venue and settles its canonical UUID", async () => {
    getWikidataEntities.mockResolvedValue([validVenueCandidate]);
    const { db, rpcCalls } = inventoryCoreDb([{
      id: "existing-venue",
      name: "テスト美術館",
      official_url: "https://museum.example",
      prefecture: null,
      city: null,
    }]);

    const result = await importWikidataVenues({ mode: "count", count: 5, runtime: "hosted" }, db);

    expect(result.linkedExisting).toBe(1);
    expect(result.inventoryProcessed).toBe(1);
    expect(rpcCalls).toContainEqual({
      name: "process_venue_discovery_inventory_candidate",
      args: { p_inventory_id: "inventory-1", p_run_id: "run-1", p_linked_venue_id: "existing-venue" },
    });
  });

  it("settles an unchanged linked QID without re-running identity matching", async () => {
    getWikidataEntities.mockResolvedValue([validVenueCandidate]);
    const normalized = mapWikidataVenue(validVenueCandidate, ["Q33506"]);
    if (!normalized) throw new Error("test fixture must normalize");
    const checksum = wikidataVenueChecksum({
      qid: normalized.qid,
      discoveryRootIds: normalized.discoveryRootIds,
      rawTypeIds: normalized.rawTypeIds,
      normalized,
      raw: normalized.raw,
    });
    const { db, rpcCalls } = inventoryCoreDb([], {
      id: "source-record", venue_id: "already-linked", checksum,
    });

    const result = await importWikidataVenues({ mode: "count", count: 5, runtime: "hosted" }, db);

    expect(result.unchanged).toBe(1);
    expect(result.inventoryProcessed).toBe(1);
    expect(rpcCalls).toContainEqual({
      name: "process_venue_discovery_inventory_candidate",
      args: { p_inventory_id: "inventory-1", p_run_id: "run-1", p_linked_venue_id: "already-linked" },
    });
  });

  it("keeps LOCAL count on legacy WDQS Discovery without Inventory claims", async () => {
    const { db, staleRecoveryReads, rpcCalls } = importDb();

    await importWikidataVenues({ mode: "count", count: 5, offset: 5, runtime: "local" }, db);

    expect(staleRecoveryReads()).toBe(0);
    expect(discoverWikidataVenues).toHaveBeenCalledWith(expect.objectContaining({ limit: 5, offset: 5 }));
    expect(rpcCalls).toHaveLength(0);
  });

  it("keeps explicit targeted QIDs off Inventory", async () => {
    getWikidataEntities.mockResolvedValue([]);
    const { db, rpcCalls } = importDb();

    await importWikidataVenues({ mode: "count", qids: ["Q42"], runtime: "hosted" }, db);

    expect(getWikidataEntities).toHaveBeenCalled();
    expect(discoverWikidataVenues).not.toHaveBeenCalled();
    expect(rpcCalls).toHaveLength(0);
  });
});
