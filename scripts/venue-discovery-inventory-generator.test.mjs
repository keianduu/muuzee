import { describe, expect, it, vi } from "vitest";
import {
  APPROVED_STG_PROJECT_REF,
  buildVenueDiscoveryInventoryQuery,
  createInitialCheckpoint,
  parseGeneratorArgs,
  prepareGeneratorExecution,
  resumeVenueDiscoveryGeneration,
  runVenueDiscoveryInventoryGeneration,
  validateLocalConfiguration,
  validateStgConfiguration,
} from "./lib/venue-discovery-inventory-generator.mjs";

describe("Venue Discovery Inventory generator", () => {
  it("requires exactly one explicit, bounded target", () => {
    expect(() => parseGeneratorArgs([])).toThrow("Exactly one explicit target");
    expect(() => parseGeneratorArgs(["--local", "--stg", "--apply", "--max-pages", "1"]))
      .toThrow("Exactly one explicit target");
    expect(() => parseGeneratorArgs(["--stg", "--project-ref", "other", "--apply", "--max-pages", "1"]))
      .toThrow("Unknown argument: --project-ref");
    expect(() => parseGeneratorArgs(["--local", "--apply"])).toThrow("--max-pages");
    expect(() => parseGeneratorArgs(["--local", "--apply", "--max-pages", "1", "--resume"])).toThrow("--resume requires");
    expect(parseGeneratorArgs(["--local", "--apply", "--max-pages", "2", "--page-size", "20"]))
      .toMatchObject({ target: "local", apply: true, maxPages: 2, pageSize: 20 });
    expect(parseGeneratorArgs(["--stg", "--apply", "--max-pages", "1"]))
      .toMatchObject({ target: "stg", apply: true, maxPages: 1 });
  });

  it("preserves LOCAL-only runtime and URL safeguards", () => {
    expect(() => validateLocalConfiguration({ supabaseUrl: "https://example.supabase.co", nodeEnv: "development" }))
      .toThrow("non-LOCAL");
    expect(validateLocalConfiguration({ supabaseUrl: "http://127.0.0.1:54321", nodeEnv: "development" }).hostname)
      .toBe("127.0.0.1");
    expect(validateLocalConfiguration({ supabaseUrl: "http://localhost:54321", nodeEnv: "development" }).hostname)
      .toBe("localhost");
    expect(() => validateLocalConfiguration({ supabaseUrl: "http://127.0.0.1:54321", vercel: "1", nodeEnv: "development" }))
      .toThrow("non-LOCAL");
  });

  it("accepts only the exact approved STG identity from a LOCAL process", () => {
    const exactUrl = `https://${APPROVED_STG_PROJECT_REF}.supabase.co`;
    expect(validateStgConfiguration({
      supabaseUrl: exactUrl,
      projectRef: APPROVED_STG_PROJECT_REF,
      nodeEnv: "development",
    }).hostname).toBe(`${APPROVED_STG_PROJECT_REF}.supabase.co`);
    expect(() => validateStgConfiguration({
      supabaseUrl: exactUrl,
      projectRef: "wrong-project",
      nodeEnv: "development",
    })).toThrow("MUUZEE_STG_PROJECT_REF");
    expect(() => validateStgConfiguration({
      supabaseUrl: "https://wrong-project.supabase.co",
      projectRef: APPROVED_STG_PROJECT_REF,
      nodeEnv: "development",
    })).toThrow("approved Muuzee STG project");
    expect(() => validateStgConfiguration({
      supabaseUrl: "https://production-project.supabase.co",
      projectRef: APPROVED_STG_PROJECT_REF,
      nodeEnv: "development",
    })).toThrow("approved Muuzee STG project");
    expect(() => validateStgConfiguration({
      supabaseUrl: exactUrl,
      projectRef: APPROVED_STG_PROJECT_REF,
      vercel: "1",
      nodeEnv: "development",
    })).toThrow("Production/Vercel runtime");
    expect(() => validateStgConfiguration({
      supabaseUrl: exactUrl,
      projectRef: APPROVED_STG_PROJECT_REF,
      nodeEnv: "production",
    })).toThrow("Production/Vercel runtime");
  });

  it("fails target and credential preflight before creating a database client", () => {
    const createDatabaseClient = vi.fn();
    expect(() => prepareGeneratorExecution({
      argv: ["--stg", "--apply", "--max-pages", "1"],
      environment: {
        NEXT_PUBLIC_SUPABASE_URL: "https://production-project.supabase.co",
        MUUZEE_STG_PROJECT_REF: APPROVED_STG_PROJECT_REF,
        SUPABASE_SERVICE_ROLE_KEY: "not-read-by-failed-preflight",
        NODE_ENV: "development",
      },
      createDatabaseClient,
    })).toThrow("approved Muuzee STG project");
    expect(createDatabaseClient).not.toHaveBeenCalled();

    expect(() => prepareGeneratorExecution({
      argv: ["--stg", "--apply", "--max-pages", "1"],
      environment: {
        NEXT_PUBLIC_SUPABASE_URL: `https://${APPROVED_STG_PROJECT_REF}.supabase.co`,
        MUUZEE_STG_PROJECT_REF: APPROVED_STG_PROJECT_REF,
        NODE_ENV: "development",
      },
      createDatabaseClient,
    })).toThrow("SUPABASE_SERVICE_ROLE_KEY is required.");
    expect(createDatabaseClient).not.toHaveBeenCalled();

    prepareGeneratorExecution({
      argv: ["--local", "--apply", "--max-pages", "1"],
      environment: {
        NEXT_PUBLIC_SUPABASE_URL: "http://127.0.0.1:54321",
        SUPABASE_SERVICE_ROLE_KEY: "local-test-only",
        NODE_ENV: "development",
      },
      createDatabaseClient,
    });
    expect(createDatabaseClient).toHaveBeenCalledOnce();

    prepareGeneratorExecution({
      argv: ["--stg", "--apply", "--max-pages", "1"],
      environment: {
        NEXT_PUBLIC_SUPABASE_URL: `https://${APPROVED_STG_PROJECT_REF}.supabase.co`,
        MUUZEE_STG_PROJECT_REF: APPROVED_STG_PROJECT_REF,
        SUPABASE_SERVICE_ROLE_KEY: "stg-test-only",
        NODE_ENV: "development",
      },
      createDatabaseClient,
    });
    expect(createDatabaseClient).toHaveBeenCalledTimes(2);
  });

  it("keeps the approved Japan, museum/gallery hierarchy, dissolved exclusion, and QID cursor contract", () => {
    const query = buildVenueDiscoveryInventoryQuery({ rootQid: "Q33506", afterQid: "Q100", limit: 50 });
    expect(query).toContain("wdt:P31/wdt:P279*");
    expect(query).toContain("wdt:P17 wd:Q17");
    expect(query).toContain("FILTER NOT EXISTS { ?item wdt:P576 ?dissolved }");
    expect(query).toContain('FILTER(STR(?item) > "http://www.wikidata.org/entity/Q100")');
    expect(query).toContain("ORDER BY STR(?item)");
  });

  it("persists a checkpoint after each page and resumes at the exact root/QID cursor", async () => {
    const checkpoints = [];
    const first = await runVenueDiscoveryInventoryGeneration({
      checkpoint: createInitialCheckpoint(),
      pageSize: 2,
      maxPages: 1,
      fetchPage: vi.fn().mockResolvedValue(["Q1", "Q2"]),
      recordPage: vi.fn(),
      saveCheckpoint: async (checkpoint) => checkpoints.push(checkpoint),
      completeGeneration: vi.fn(),
    });
    expect(first).toMatchObject({ complete: false, pagesThisAttempt: 1 });
    expect(first.checkpoint).toMatchObject({ rootIndex: 0, afterQid: "Q2", pages: 1 });
    expect(checkpoints).toHaveLength(1);

    const fetchPage = vi.fn()
      .mockResolvedValueOnce(["Q3"])
      .mockResolvedValueOnce([]);
    const completeGeneration = vi.fn();
    const resumed = await runVenueDiscoveryInventoryGeneration({
      checkpoint: first.checkpoint,
      pageSize: 2,
      maxPages: 2,
      fetchPage,
      recordPage: vi.fn(),
      saveCheckpoint: vi.fn(),
      completeGeneration,
    });
    expect(fetchPage).toHaveBeenNthCalledWith(1, { rootQid: "Q33506", afterQid: "Q2", limit: 2 });
    expect(fetchPage).toHaveBeenNthCalledWith(2, { rootQid: "Q1007870", afterQid: null, limit: 2 });
    expect(resumed.complete).toBe(true);
    expect(completeGeneration).toHaveBeenCalledOnce();
  });

  it("does not finalize an interrupted logical generation", async () => {
    const completeGeneration = vi.fn();
    await expect(runVenueDiscoveryInventoryGeneration({
      checkpoint: createInitialCheckpoint(),
      pageSize: 2,
      maxPages: 2,
      fetchPage: vi.fn().mockRejectedValue(new Error("provider unavailable")),
      recordPage: vi.fn(),
      saveCheckpoint: vi.fn(),
      completeGeneration,
    })).rejects.toThrow("provider unavailable");
    expect(completeGeneration).not.toHaveBeenCalled();
  });

  it.each(["running", "partial"])("resumes a %s generation and records the next attempt", async (status) => {
    const updateGeneration = vi.fn();
    const generation = {
      id: "10000000-0000-4000-8000-000000000001",
      data_source_id: "20000000-0000-4000-8000-000000000002",
      operation_type: "wikidata_venue_discovery_inventory",
      status,
      metrics: { ...createInitialCheckpoint(), rootIndex: 1, completedRoots: ["Q33506"] },
    };

    const resumed = await resumeVenueDiscoveryGeneration({
      generation,
      dataSourceId: generation.data_source_id,
      startedAt: "2026-11-02T00:00:00.000Z",
      updateGeneration,
    });

    expect(resumed).toMatchObject({ id: generation.id, checkpoint: { rootIndex: 1, inventoryComplete: false } });
    expect(updateGeneration).toHaveBeenCalledOnce();
    expect(updateGeneration).toHaveBeenCalledWith(expect.objectContaining({
      status: "running",
      errors: null,
      finished_at: null,
      metrics: expect.objectContaining({
        attempts: [expect.objectContaining({ startedAt: "2026-11-02T00:00:00.000Z", status: "running" })],
      }),
    }));
  });

  it.each(["completed", "failed"])("rejects a %s generation before any mutation", async (status) => {
    const updateGeneration = vi.fn();
    const generation = {
      id: "10000000-0000-4000-8000-000000000001",
      data_source_id: "20000000-0000-4000-8000-000000000002",
      operation_type: "wikidata_venue_discovery_inventory",
      status,
      metrics: { ...createInitialCheckpoint(), rootIndex: 2, inventoryComplete: true },
    };

    await expect(resumeVenueDiscoveryGeneration({
      generation,
      dataSourceId: generation.data_source_id,
      startedAt: "2026-11-02T00:00:00.000Z",
      updateGeneration,
    })).rejects.toThrow(`Discovery generation is not resumable from status: ${status}`);
    expect(updateGeneration).not.toHaveBeenCalled();
    expect(generation).toMatchObject({ status, metrics: { rootIndex: 2, inventoryComplete: true } });
  });
});
