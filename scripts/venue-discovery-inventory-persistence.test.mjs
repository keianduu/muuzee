import { describe, expect, it, vi } from "vitest";
import { executeVenueDiscoveryInventoryGenerator } from "./generate-venue-discovery-inventory.mjs";
import {
  APPROVED_PROD_REMOTE_ARGUMENT,
  APPROVED_STG_REMOTE_ARGUMENT,
  assertQid,
  assertUuid,
  createRemoteVenueDiscoveryPersistence,
  createStgVenueDiscoveryPersistence,
  createSupabaseCliExecutor,
  parseSupabaseCliTargetProjectRef,
  sqlJsonLiteral,
  sqlStringLiteral,
} from "./lib/venue-discovery-inventory-persistence.mjs";

const DATA_SOURCE_ID = "20000000-0000-4000-8000-000000000002";
const GENERATION_ID = "10000000-0000-4000-8000-000000000001";

function querySql(call) {
  return call[0][2];
}

describe("Venue Discovery Inventory persistence adapters", () => {
  it("invokes the installed Supabase CLI with an argument array and shell disabled", () => {
    const spawn = vi.fn().mockReturnValue({
      status: 0,
      stdout: JSON.stringify({ rows: [{ ok: true }] }),
      stderr: "Target: project muuzee-stg (steibqgeoqcsfsafaqcv) · production\n",
    });
    const execute = createSupabaseCliExecutor({
      approvedProjectRef: "steibqgeoqcsfsafaqcv",
      executable: "/repo/node_modules/.bin/supabase",
      spawn,
    });
    const args = ["db", "query", "select true as ok", "--read-only", APPROVED_STG_REMOTE_ARGUMENT, "--output-format=json"];

    expect(execute(args)).toEqual({ rows: [{ ok: true }] });
    expect(spawn).toHaveBeenCalledWith(
      "/repo/node_modules/.bin/supabase",
      args,
      expect.objectContaining({ shell: false, timeout: 60_000, encoding: "utf8" }),
    );
  });

  it("fails closed with sanitized errors when the CLI is missing or authentication/query fails", () => {
    const missing = createSupabaseCliExecutor({
      approvedProjectRef: "steibqgeoqcsfsafaqcv",
      spawn: vi.fn().mockReturnValue({ error: { code: "ENOENT", message: "sensitive path" } }),
    });
    expect(() => missing(["db", "query", "select 1", APPROVED_STG_REMOTE_ARGUMENT])).toThrow("Supabase CLI is unavailable.");

    const failed = createSupabaseCliExecutor({
      approvedProjectRef: "steibqgeoqcsfsafaqcv",
      spawn: vi.fn().mockReturnValue({ status: 1, stdout: "secret", stderr: "access token rejected" }),
    });
    expect(() => failed(["db", "query", "select 1", APPROVED_STG_REMOTE_ARGUMENT])).toThrow("Supabase CLI query failed.");
    expect(() => failed(["db", "query", "select 1", APPROVED_STG_REMOTE_ARGUMENT])).not.toThrow(/secret|access token/i);

    const wrongTarget = createSupabaseCliExecutor({
      approvedProjectRef: "steibqgeoqcsfsafaqcv",
      spawn: vi.fn().mockReturnValue({
        status: 0,
        stdout: JSON.stringify({ rows: [{ ok: true }] }),
        stderr: "Target: project other (production-project-ref) · production\n",
      }),
    });
    expect(() => wrongTarget(["db", "query", "select 1", APPROVED_STG_REMOTE_ARGUMENT]))
      .toThrow("target could not be verified as the approved remote project");
  });

  it.each([
    [
      "Production explicit remote",
      "Target: project lqinmolonctddovltujy (not the linked project)\n",
      "lqinmolonctddovltujy",
    ],
    [
      "STG named production",
      "Target: project muuzee-stg (steibqgeoqcsfsafaqcv) · production\n",
      "steibqgeoqcsfsafaqcv",
    ],
    [
      "Production bare ref",
      "Target: project lqinmolonctddovltujy\n",
      "lqinmolonctddovltujy",
    ],
    [
      "Production named project",
      "Target: project muuzee-prod (lqinmolonctddovltujy)\n",
      "lqinmolonctddovltujy",
    ],
  ])("parses the Supabase CLI v3 %s target banner", (_label, stderr, expected) => {
    expect(parseSupabaseCliTargetProjectRef(stderr)).toBe(expected);
  });

  it.each([
    ["branch target", "Target: project muuzee-prod (lqinmolonctddovltujy) · branch feature (abcdefghijklmnopqrst)\n"],
    ["local target", "Target: local database\n"],
    ["custom target", "Target: custom postgresql://example.invalid/database\n"],
    ["missing target", "Supabase CLI lqinmolonctddovltujy query complete\n"],
    ["malformed target", "Target: project muuzee-prod (lqinmolonctddovltujy) · preview\n"],
    [
      "conflicting targets",
      "Target: project lqinmolonctddovltujy\nTarget: project steibqgeoqcsfsafaqcv\n",
    ],
  ])("rejects the Supabase CLI v3 %s without exposing output", (_label, stderr) => {
    expect(() => parseSupabaseCliTargetProjectRef(stderr))
      .toThrow("Supabase CLI target could not be verified as the approved remote project.");
  });

  it.each([
    ["lqinmolonctddovltujy", APPROVED_PROD_REMOTE_ARGUMENT, "Target: project steibqgeoqcsfsafaqcv\n"],
    ["steibqgeoqcsfsafaqcv", APPROVED_STG_REMOTE_ARGUMENT, "Target: project lqinmolonctddovltujy\n"],
  ])("rejects a valid banner for the wrong approved project %s", (approvedProjectRef, remoteArgument, stderr) => {
    const execute = createSupabaseCliExecutor({
      approvedProjectRef,
      spawn: vi.fn().mockReturnValue({
        status: 0,
        stdout: "not-json",
        stderr,
      }),
    });

    expect(() => execute(["db", "query", "select 1", remoteArgument]))
      .toThrow("Supabase CLI target could not be verified as the approved remote project.");
  });

  it("rejects bare, missing, duplicate, or different remote arguments before invoking the CLI", () => {
    const spawn = vi.fn();
    const execute = createSupabaseCliExecutor({
      approvedProjectRef: "lqinmolonctddovltujy",
      spawn,
    });
    for (const args of [
      ["db", "query", "select 1"],
      ["db", "query", "select 1", "--remote"],
      ["db", "query", "select 1", APPROVED_STG_REMOTE_ARGUMENT],
      ["db", "query", "select 1", APPROVED_PROD_REMOTE_ARGUMENT, APPROVED_PROD_REMOTE_ARGUMENT],
    ]) {
      expect(() => execute(args)).toThrow("exact approved remote project");
    }
    expect(spawn).not.toHaveBeenCalled();
  });

  it("fails closed when a remote target and project ref do not match", () => {
    expect(() => createRemoteVenueDiscoveryPersistence({
      target: "stg",
      projectRef: "lqinmolonctddovltujy",
      executeCli: vi.fn(),
      applyIntent: true,
    })).toThrow("target and approved project ref do not match");
    expect(() => createRemoteVenueDiscoveryPersistence({
      target: "prod",
      projectRef: "steibqgeoqcsfsafaqcv",
      executeCli: vi.fn(),
      applyIntent: true,
    })).toThrow("target and approved project ref do not match");
  });

  it.each([
    ["lqinmolonctddovltujy", APPROVED_PROD_REMOTE_ARGUMENT, "steibqgeoqcsfsafaqcv"],
    ["steibqgeoqcsfsafaqcv", APPROVED_STG_REMOTE_ARGUMENT, "lqinmolonctddovltujy"],
  ])("verifies requested target %s before parsing otherwise valid CLI output", (approvedProjectRef, remoteArgument, actualProjectRef) => {
    const executor = createSupabaseCliExecutor({
      approvedProjectRef,
      spawn: vi.fn().mockReturnValue({
        status: 0,
        stdout: JSON.stringify({ rows: [{ approved_project_ref: approvedProjectRef }] }),
        stderr: `Target: project unexpected (${actualProjectRef}) · production\n`,
      }),
    });
    expect(() => executor(["db", "query", "select 1", remoteArgument]))
      .toThrow("target could not be verified as the approved remote project");
  });

  it("uses the exact approved remote for every read and never adds bare --remote or --yes", async () => {
    const executeCli = vi.fn()
      .mockResolvedValueOnce({ rows: [{ approved_project_ref: "steibqgeoqcsfsafaqcv" }] })
      .mockResolvedValueOnce({ rows: [{ id: DATA_SOURCE_ID }] })
      .mockResolvedValueOnce({ rows: [] });
    const persistence = createStgVenueDiscoveryPersistence({ executeCli, applyIntent: true });

    await persistence.preflight();
    await expect(persistence.loadDataSource()).resolves.toBe(DATA_SOURCE_ID);
    await expect(persistence.findResumableGeneration(DATA_SOURCE_ID)).resolves.toBeNull();

    for (const [args] of executeCli.mock.calls) {
      expect(args).toContain(APPROVED_STG_REMOTE_ARGUMENT);
      expect(args).not.toContain("--remote");
      expect(args).toContain("--read-only");
      expect(args).not.toContain("--yes");
      expect(args).toContain("--output-format=json");
    }
  });

  it("requires explicit STG apply intent before any mutation command", async () => {
    const executeCli = vi.fn();
    const persistence = createStgVenueDiscoveryPersistence({ executeCli, applyIntent: false });

    await expect(persistence.createGeneration({ dataSourceId: DATA_SOURCE_ID, checkpoint: {} }))
      .rejects.toThrow("explicit --stg --apply intent");
    expect(executeCli).not.toHaveBeenCalled();
  });

  it("uses the exact Production remote for reads without mutation confirmation", async () => {
    const executeCli = vi.fn()
      .mockResolvedValueOnce({ rows: [{ approved_project_ref: "lqinmolonctddovltujy" }] })
      .mockResolvedValueOnce({ rows: [{ id: DATA_SOURCE_ID }] });
    const persistence = createRemoteVenueDiscoveryPersistence({
      target: "prod",
      projectRef: "lqinmolonctddovltujy",
      executeCli,
      applyIntent: true,
    });

    await persistence.preflight();
    await expect(persistence.loadDataSource()).resolves.toBe(DATA_SOURCE_ID);

    for (const [args] of executeCli.mock.calls) {
      expect(args).toContain(APPROVED_PROD_REMOTE_ARGUMENT);
      expect(args).not.toContain("--remote");
      expect(args).toContain("--read-only");
      expect(args).not.toContain("--yes");
    }
  });

  it("requires Production apply intent and uses its exact remote for mutations", async () => {
    const executeCli = vi.fn().mockResolvedValue({ rows: [{ id: GENERATION_ID }] });
    const withoutIntent = createRemoteVenueDiscoveryPersistence({
      target: "prod",
      projectRef: "lqinmolonctddovltujy",
      executeCli,
      applyIntent: false,
    });
    await expect(withoutIntent.createGeneration({ dataSourceId: DATA_SOURCE_ID, checkpoint: {} }))
      .rejects.toThrow("explicit --prod --apply intent");
    expect(executeCli).not.toHaveBeenCalled();

    const withIntent = createRemoteVenueDiscoveryPersistence({
      target: "prod",
      projectRef: "lqinmolonctddovltujy",
      executeCli,
      applyIntent: true,
    });
    await withIntent.createGeneration({ dataSourceId: DATA_SOURCE_ID, checkpoint: {} });
    expect(executeCli).toHaveBeenCalledOnce();
    expect(executeCli.mock.calls[0][0]).toContain(APPROVED_PROD_REMOTE_ARGUMENT);
    expect(executeCli.mock.calls[0][0]).toContain("--yes");
    expect(executeCli.mock.calls[0][0]).not.toContain("--read-only");
  });

  it("preserves generation create/update semantics and uses exact mutation arguments", async () => {
    const executeCli = vi.fn()
      .mockResolvedValueOnce({ rows: [{ id: GENERATION_ID }] })
      .mockResolvedValueOnce({ rows: [{ id: GENERATION_ID }] });
    const persistence = createStgVenueDiscoveryPersistence({ executeCli, applyIntent: true });
    const checkpoint = { attempts: [{ status: "running", note: "operator's retry" }] };

    await expect(persistence.createGeneration({ dataSourceId: DATA_SOURCE_ID, checkpoint }))
      .resolves.toEqual({ id: GENERATION_ID });
    await persistence.updateGeneration(GENERATION_ID, {
      status: "partial",
      errors: [{ message: "provider's timeout" }],
      metrics: checkpoint,
      finished_at: "2026-11-08T00:00:00.000Z",
    });

    for (const [args] of executeCli.mock.calls) {
      expect(args).toContain(APPROVED_STG_REMOTE_ARGUMENT);
      expect(args).toContain("--yes");
      expect(args).not.toContain("--read-only");
      expect(args).not.toContain("--remote");
    }
    expect(querySql(executeCli.mock.calls[0])).toContain("insert into public.import_runs");
    expect(querySql(executeCli.mock.calls[0])).toContain("wikidata_venue_discovery_inventory");
    expect(querySql(executeCli.mock.calls[1])).toContain("status = 'partial'");
    expect(querySql(executeCli.mock.calls[1])).toContain("provider''s timeout");
  });

  it("delegates page persistence and completion to the existing database functions", async () => {
    const executeCli = vi.fn()
      .mockResolvedValueOnce({ rows: [{ affected: 2 }] })
      .mockResolvedValueOnce({ rows: [{ result: { inactive: 0 } }] });
    const persistence = createStgVenueDiscoveryPersistence({ executeCli, applyIntent: true });

    await persistence.recordPage({
      dataSourceId: DATA_SOURCE_ID,
      generationId: GENERATION_ID,
      rootQid: "Q33506",
      externalIds: ["Q1", "Q2"],
    });
    await persistence.completeGeneration({
      generationId: GENERATION_ID,
      checkpoint: { inventoryComplete: true, roots: ["Q33506", "Q1007870"] },
    });

    expect(querySql(executeCli.mock.calls[0])).toContain("public.record_venue_discovery_inventory_page(");
    expect(querySql(executeCli.mock.calls[0])).toContain("array['Q1', 'Q2']::text[]");
    expect(querySql(executeCli.mock.calls[1])).toContain("public.complete_venue_discovery_inventory_generation(");
  });

  it("validates UUID/QID inputs and escapes SQL text and JSON literals", () => {
    expect(assertUuid(GENERATION_ID)).toBe(GENERATION_ID);
    expect(() => assertUuid("not-a-uuid")).toThrow("must be a UUID");
    expect(assertQid("Q123")).toBe("Q123");
    expect(() => assertQid("Q1; drop table")).toThrow("must be a QID");
    expect(sqlStringLiteral("operator's retry")).toBe("'operator''s retry'");
    expect(sqlJsonLiteral({ message: "provider's timeout" })).toContain("provider''s timeout");
  });

  it.each([
    ["stg", "steibqgeoqcsfsafaqcv"],
    ["prod", "lqinmolonctddovltujy"],
  ])("fails %s preflight before provider or persistence work", async (target, projectRef) => {
    const preflightError = new Error("Supabase CLI query failed.");
    const fetchPage = vi.fn();
    const persistence = {
      preflight: vi.fn().mockRejectedValue(preflightError),
      loadDataSource: vi.fn(),
      createGeneration: vi.fn(),
    };
    const createRemotePersistence = vi.fn(({ target: actualTarget, projectRef: actualProjectRef }) => {
      expect(actualTarget).toBe(target);
      expect(actualProjectRef).toBe(projectRef);
      return persistence;
    });

    await expect(executeVenueDiscoveryInventoryGenerator({
      argv: [`--${target}`, "--apply", "--max-pages", "1"],
      environment: { NODE_ENV: "development" },
      createCliExecutor: () => vi.fn(),
      createRemotePersistence,
      fetchPage,
      output: vi.fn(),
    })).rejects.toThrow(preflightError.message);

    expect(persistence.loadDataSource).not.toHaveBeenCalled();
    expect(persistence.createGeneration).not.toHaveBeenCalled();
    expect(fetchPage).not.toHaveBeenCalled();
  });

  it.each([
    new Error("Supabase CLI is unavailable."),
    new Error("Supabase CLI query failed."),
  ])("fails STG preflight before provider or persistence work: %s", async (preflightError) => {
    const fetchPage = vi.fn();
    const persistence = {
      preflight: vi.fn().mockRejectedValue(preflightError),
      loadDataSource: vi.fn(),
      createGeneration: vi.fn(),
    };

    await expect(executeVenueDiscoveryInventoryGenerator({
      argv: ["--stg", "--apply", "--max-pages", "1"],
      environment: { NODE_ENV: "development" },
      createCliExecutor: () => vi.fn(),
      createRemotePersistence: () => persistence,
      fetchPage,
      output: vi.fn(),
    })).rejects.toThrow(preflightError.message);

    expect(persistence.loadDataSource).not.toHaveBeenCalled();
    expect(persistence.createGeneration).not.toHaveBeenCalled();
    expect(fetchPage).not.toHaveBeenCalled();
  });

  it("keeps LOCAL on the Supabase client persistence adapter", async () => {
    const databaseClient = { local: true };
    const createDatabaseClient = vi.fn().mockReturnValue(databaseClient);
    const preflightError = new Error("stop after LOCAL adapter selection");
    const localPersistence = { preflight: vi.fn().mockRejectedValue(preflightError) };
    const createLocalPersistence = vi.fn().mockReturnValue(localPersistence);
    const createRemotePersistence = vi.fn();

    await expect(executeVenueDiscoveryInventoryGenerator({
      argv: ["--local", "--apply", "--max-pages", "1"],
      environment: {
        NEXT_PUBLIC_SUPABASE_URL: "http://127.0.0.1:54321",
        SUPABASE_SERVICE_ROLE_KEY: "local-test-only",
        NODE_ENV: "development",
      },
      createDatabaseClient,
      createLocalPersistence,
      createRemotePersistence,
      output: vi.fn(),
    })).rejects.toThrow(preflightError.message);

    expect(createLocalPersistence).toHaveBeenCalledWith(databaseClient);
    expect(createRemotePersistence).not.toHaveBeenCalled();
  });
});
