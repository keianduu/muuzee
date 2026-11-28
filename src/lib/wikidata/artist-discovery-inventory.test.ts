import { describe, expect, it, vi } from "vitest";
import {
  ARTIST_INVENTORY_BATCH_SIZES,
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
    expect((db as never as { rpc: ReturnType<typeof vi.fn> }).rpc).toHaveBeenCalledTimes(2);
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
    expect(rpc.mock.calls.some(([name]) => name === "apply_wikidata_artist_inventory_batch")).toBe(false);
  });
});
