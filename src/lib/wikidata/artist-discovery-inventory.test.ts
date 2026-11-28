import { describe, expect, it, vi } from "vitest";
import {
  ARTIST_INVENTORY_BATCH_SIZES,
  ARTIST_INVENTORY_SETTLEMENT_CHUNK_SIZE,
  buildArtistInventorySettlement,
  consumeArtistDiscoveryInventoryBatch,
  RECOMMENDED_ARTIST_INVENTORY_BATCH_SIZE,
} from "./artist-discovery-inventory";
import type { WikidataArtist } from "./artist-types";

const artist = (qid: string, name = qid): WikidataArtist => ({
  qid, name, nameEn: name, nameNative: null, aliases: [], birthDate: null, birthYear: null,
  deathDate: null, deathYear: null, nationalityCountryCode: null, nationalityQids: [],
  birthCountryCode: null, birthPlace: null, occupation: [], fieldOfWork: [], movement: [],
  imageFileTitle: "Portrait.jpg", commonsCategory: "Portraits", wikipediaArticleTitle: name,
  wikipediaLanguage: "en", officialUrl: null, raw: { id: qid },
});

function dbWithRpc(responses: Array<{ data: unknown; error: unknown }>) {
  return { rpc: vi.fn().mockImplementation(() => Promise.resolve(responses.shift())) } as never;
}

describe("Artist Discovery Inventory consumer", () => {
  it("benchmarks only the approved bounded batch sizes and recommends 50", () => {
    expect(ARTIST_INVENTORY_BATCH_SIZES).toEqual([5, 20, 50, 100]);
    expect(RECOMMENDED_ARTIST_INVENTORY_BATCH_SIZE).toBe(50);
    expect(ARTIST_INVENTORY_SETTLEMENT_CHUNK_SIZE).toBe(5);
  });

  it("builds a QID-bound settlement while retaining image hints in source payload only", () => {
    const item = buildArtistInventorySettlement({ id: "inventory", external_id: "Q1", attempt_count: 1 }, artist("Q1"));
    expect(item).toMatchObject({ inventoryId: "inventory", externalId: "Q1" });
    expect(item.checksum).toMatch(/^[0-9a-f]{64}$/);
    expect(item.payload.imageDiscoveryHints).toMatchObject({ p18: "Portrait.jpg", commonsCategory: "Portraits" });
    expect(() => buildArtistInventorySettlement({ id: "inventory", external_id: "Q2", attempt_count: 1 }, artist("Q1")))
      .toThrow("QID do not match");
  });

  it("claims, batch-fetches, and settles with two DB RPCs", async () => {
    const db = dbWithRpc([
      { data: [{ id: "i1", external_id: "Q1", attempt_count: 1 }, { id: "i2", external_id: "Q2", attempt_count: 1 }], error: null },
      { data: { created: 2, exactSource: 0, review: 0, processed: 2, imageDiscoveryExecuted: false }, error: null },
    ]);
    const fetchArtists = vi.fn().mockResolvedValue({ artists: [artist("Q1"), artist("Q2")], errors: [], cache: new Map() });
    const result = await consumeArtistDiscoveryInventoryBatch(db, { dataSourceId: "source", runId: "run", limit: 50, fetchArtists });
    expect(result).toMatchObject({ claimed: 2, settled: { created: 2, imageDiscoveryExecuted: false } });
    const rpc = (db as never as { rpc: ReturnType<typeof vi.fn> }).rpc;
    expect(rpc).toHaveBeenCalledTimes(2);
    expect(rpc.mock.calls[1][0]).toBe("settle_wikidata_artist_inventory_batch");
  });

  it("rolls incomplete provider batches back to pending without applying partial settlement", async () => {
    const db = dbWithRpc([
      { data: [{ id: "i1", external_id: "Q1", attempt_count: 1 }, { id: "i2", external_id: "Q2", attempt_count: 1 }], error: null },
      { data: 2, error: null },
    ]);
    const fetchArtists = vi.fn().mockResolvedValue({
      artists: [artist("Q1")],
      errors: [{ qid: "Q2", message: "unknown provider response" }],
      cache: new Map(),
    });
    await expect(consumeArtistDiscoveryInventoryBatch(db, { dataSourceId: "source", runId: "run", fetchArtists }))
      .rejects.toThrow("incomplete");
    const rpc = (db as never as { rpc: ReturnType<typeof vi.fn> }).rpc;
    expect(rpc).toHaveBeenCalledTimes(2);
    expect(rpc.mock.calls[1][0]).toBe("release_artist_discovery_inventory_claims");
    expect(rpc.mock.calls.some(([name]) => name === "settle_wikidata_artist_inventory_batch")).toBe(false);
  });

  it("preserves the provider failure when claim release also fails", async () => {
    const db = dbWithRpc([
      { data: [{ id: "i1", external_id: "Q1", attempt_count: 1 }], error: null },
      { data: null, error: { message: "release unavailable" } },
    ]);
    const fetchArtists = vi.fn().mockResolvedValue({
      artists: [],
      errors: [{ qid: "Q1", message: "provider unavailable" }],
      cache: new Map(),
    });

    await expect(consumeArtistDiscoveryInventoryBatch(db, { dataSourceId: "source", runId: "run", fetchArtists }))
      .rejects.toThrow("Artist provider batch was incomplete; no settlement was applied; claim release failed: release unavailable");
  });

  it("claims and fetches 50 records once while settling in bounded atomic chunks", async () => {
    const candidates = Array.from({ length: 50 }, (_, index) => ({
      id: `i${index + 1}`,
      external_id: `Q${index + 1}`,
      attempt_count: 1,
    }));
    const db = dbWithRpc([
      { data: candidates, error: null },
      ...Array.from({ length: 10 }, () => ({
        data: { created: 5, exactSource: 0, review: 0, invalid: 0, processed: 5, imageDiscoveryExecuted: false },
        error: null,
      })),
    ]);
    const fetchArtists = vi.fn().mockResolvedValue({
      artists: candidates.map((candidate) => artist(candidate.external_id)),
      errors: [],
      cache: new Map(),
    });

    const result = await consumeArtistDiscoveryInventoryBatch(db, {
      dataSourceId: "source",
      runId: "run",
      limit: 50,
      fetchArtists,
    });

    expect(fetchArtists).toHaveBeenCalledTimes(1);
    expect(result).toMatchObject({ claimed: 50, settled: { created: 50, processed: 50 } });
    const rpc = (db as never as { rpc: ReturnType<typeof vi.fn> }).rpc;
    expect(rpc.mock.calls.map(([name]) => name)).toEqual([
      "claim_artist_discovery_inventory",
      "settle_wikidata_artist_inventory_batch",
      "settle_wikidata_artist_inventory_batch",
      "settle_wikidata_artist_inventory_batch",
      "settle_wikidata_artist_inventory_batch",
      "settle_wikidata_artist_inventory_batch",
      "settle_wikidata_artist_inventory_batch",
      "settle_wikidata_artist_inventory_batch",
      "settle_wikidata_artist_inventory_batch",
      "settle_wikidata_artist_inventory_batch",
      "settle_wikidata_artist_inventory_batch",
    ]);
    expect(rpc.mock.calls.slice(1).map(([, args]) => args.p_items.length)).toEqual(Array(10).fill(5));
  });

  it("atomically settles valid records and terminal invalid records without retrying the batch", async () => {
    const db = dbWithRpc([
      { data: [{ id: "i1", external_id: "Q1", attempt_count: 1 }, { id: "i2", external_id: "Q2", attempt_count: 1 }], error: null },
      { data: { created: 1, exactSource: 0, review: 0, invalid: 1, processed: 2, imageDiscoveryExecuted: false }, error: null },
    ]);
    const fetchArtists = vi.fn().mockResolvedValue({
      artists: [artist("Q1")],
      errors: [{ qid: "Q2", message: "Artist has no usable label", terminal: true }],
      cache: new Map(),
    });
    const result = await consumeArtistDiscoveryInventoryBatch(db, { dataSourceId: "source", runId: "run", fetchArtists });
    expect(result.settled).toMatchObject({ created: 1, invalid: 1, processed: 2 });
    const rpc = (db as never as { rpc: ReturnType<typeof vi.fn> }).rpc;
    expect(rpc).toHaveBeenNthCalledWith(2, "settle_wikidata_artist_inventory_batch", expect.objectContaining({
      p_items: [expect.objectContaining({ externalId: "Q1" })],
      p_invalid: [{ inventoryId: "i2", externalId: "Q2", reason: "Artist has no usable label" }],
    }));
  });
});
