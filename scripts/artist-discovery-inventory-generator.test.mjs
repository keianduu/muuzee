import { describe, expect, it, vi } from "vitest";
import {
  buildArtistDiscoveryInventoryQuery,
  createArtistInitialCheckpoint,
  normalizeArtistDiscoveryBindings,
  parseArtistGeneratorArgs,
  runArtistDiscoveryInventoryGeneration,
  validateArtistLocalConfiguration,
} from "./lib/artist-discovery-inventory-generator.mjs";

describe("Artist Discovery Inventory generator", () => {
  it("permits only explicit, bounded LOCAL execution in Phase A", () => {
    expect(() => parseArtistGeneratorArgs([])).toThrow("explicit --local");
    expect(() => parseArtistGeneratorArgs(["--stg", "--apply", "--max-pages", "1"])).toThrow("Unknown argument");
    expect(() => parseArtistGeneratorArgs(["--local", "--apply"])).toThrow("--max-pages");
    expect(parseArtistGeneratorArgs(["--local", "--apply", "--max-pages", "2", "--page-size", "50"]))
      .toMatchObject({ target: "local", apply: true, maxPages: 2, pageSize: 50 });
  });

  it("rejects remote URLs and Vercel/Production runtimes", () => {
    expect(() => validateArtistLocalConfiguration({ supabaseUrl: "https://example.supabase.co", serviceRoleKey: "x" }))
      .toThrow("non-LOCAL");
    expect(() => validateArtistLocalConfiguration({ supabaseUrl: "http://127.0.0.1:54321", serviceRoleKey: "x", vercel: "1" }))
      .toThrow("non-LOCAL");
    expect(validateArtistLocalConfiguration({ supabaseUrl: "http://127.0.0.1:54321", serviceRoleKey: "x" }).hostname)
      .toBe("127.0.0.1");
  });

  it("uses the approved global Visual Artist tree without a nationality filter", () => {
    const query = buildArtistDiscoveryInventoryQuery({ afterQid: "Q100", limit: 50 });
    expect(query).toContain("P106/wdt:P279* wd:Q3391743");
    expect(query).toContain("Q100");
    expect(query).not.toContain("wdt:P27 ");
  });

  it("fails closed for unknown WDQS schemas", () => {
    expect(() => normalizeArtistDiscoveryBindings({})).toThrow("schema is invalid");
    expect(() => normalizeArtistDiscoveryBindings({ results: { bindings: [{}] } })).toThrow("invalid item");
  });

  it("persists and resumes the QID cursor idempotently", async () => {
    const first = await runArtistDiscoveryInventoryGeneration({
      checkpoint: createArtistInitialCheckpoint(), pageSize: 2, maxPages: 1,
      fetchPage: vi.fn().mockResolvedValue(["Q1", "Q2"]), recordPage: vi.fn(), saveCheckpoint: vi.fn(), completeGeneration: vi.fn(),
    });
    expect(first).toMatchObject({ complete: false, checkpoint: { afterQid: "Q2", pages: 1 } });
    const completeGeneration = vi.fn();
    const second = await runArtistDiscoveryInventoryGeneration({
      checkpoint: first.checkpoint, pageSize: 2, maxPages: 1,
      fetchPage: vi.fn().mockResolvedValue(["Q3"]), recordPage: vi.fn(), saveCheckpoint: vi.fn(), completeGeneration,
    });
    expect(second.complete).toBe(true);
    expect(completeGeneration).toHaveBeenCalledWith(expect.objectContaining({ inventoryComplete: true, completedRoots: ["Q3391743"] }));
  });
});
