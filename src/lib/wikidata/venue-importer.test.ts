import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it, vi } from "vitest";
import type { WikidataVenueImportSummary } from "./venue-import-types";
import {
  classifyWikidataVenueMatch,
  collectVenueImageDiscovery,
  handleVenueImageDiscovery,
  interruptedWikidataImportRunStatus,
  isProtectedVenueField,
  recoverAbandonedHostedVenueImports,
  shouldSkipWikidataVenue,
  wikidataImportRunStatus,
  wikidataVenueImportRunUpdate,
  wikidataVenueChecksum,
} from "./venue-importer";

describe("Wikidata Venue importer decisions", () => {
  it("uses the QID source checksum for external-ID dedup and unchanged skip", () => {
    const checksum = wikidataVenueChecksum({ qid: "Q1", raw: { a: 1 } });
    expect(shouldSkipWikidataVenue({ id: "source", venue_id: "venue", checksum }, checksum)).toBe(true);
    expect(shouldSkipWikidataVenue({ id: "source", venue_id: null, checksum }, checksum)).toBe(false);
    expect(shouldSkipWikidataVenue({ id: "source", venue_id: "venue", checksum: "old" }, checksum)).toBe(false);
  });

  it("marks a partially processed run with errors as partial", () => {
    expect(wikidataImportRunStatus(10, 1)).toBe("partial");
    expect(wikidataImportRunStatus(0, 1)).toBe("failed");
    expect(wikidataImportRunStatus(10, 0)).toBe("completed");
  });

  it("separates high, possible, and no-existing-match creation paths", () => {
    expect(classifyWikidataVenueMatch(0.9)).toBe("high");
    expect(classifyWikidataVenueMatch(0.7)).toBe("possible");
    expect(classifyWikidataVenueMatch(0.4)).toBe("none");
  });

  it("uses source priority instead of treating every populated field as protected", () => {
    expect(isProtectedVenueField("unattributed value", null)).toBe(false);
    expect(isProtectedVenueField(null, { source: "manual", review_status: "unreviewed" })).toBe(true);
    expect(isProtectedVenueField(null, { source: "official_website", review_status: "applied" })).toBe(true);
    expect(isProtectedVenueField(null, { source: "wikidata", review_status: "unreviewed" })).toBe(false);
  });

  it("marks partial failures without reporting completion", () => {
    expect(wikidataImportRunStatus(20, 1)).toBe("partial");
    expect(wikidataImportRunStatus(0, 1)).toBe("failed");
    expect(wikidataImportRunStatus(20, 0)).toBe("completed");
  });

  it("finalizes an interrupted run as failed before Core progress and partial after progress", () => {
    expect(interruptedWikidataImportRunStatus(0)).toBe("failed");
    expect(interruptedWikidataImportRunStatus(1)).toBe("partial");
  });

  it("builds a finished failed/partial update instead of leaving a controlled stop running", () => {
    const result = {
      runId: "run", mode: "count", requested: 5, discoveryOffset: 5, discovered: 0, fetched: 0,
      processed: 0, discoveryPages: 1, retryCount: 1, currentOffset: 5, currentCursor: null,
      currentRoot: null, newVenues: 0, linkedExisting: 0, updated: 0, unchanged: 0,
      sourceSelectionRequired: 0, imageCandidatesAdded: 0, imageDiscoveryDeferred: 0,
      imageDiscoveryErrors: [], runtimeBudgetExhausted: false, recoveredAbandonedRuns: 0,
      errors: [{ message: "External request timed out" }],
      before: { total: 1, averageCompleteness: 50 }, after: { total: 1, averageCompleteness: 50 },
    } satisfies WikidataVenueImportSummary;

    const failed = wikidataVenueImportRunUpdate(result, { mode: "count", count: 5 }, "failed", "2026-10-29T12:00:00.000Z");
    const partial = wikidataVenueImportRunUpdate({ ...result, processed: 1, fetched: 1 }, { mode: "count", count: 5 }, "partial", "2026-10-29T12:00:00.000Z");

    expect(failed).toMatchObject({ status: "failed", finished_at: "2026-10-29T12:00:00.000Z", error_count: 1 });
    expect(partial).toMatchObject({ status: "partial", finished_at: "2026-10-29T12:00:00.000Z", fetched_count: 1 });
  });

  it("keeps a core-success run completed when optional image discovery reports an error", async () => {
    const result = { imageCandidatesAdded: 0, imageDiscoveryErrors: [] as Array<{ qid: string; fileTitle?: string; stage: string; message: string }> };
    const discover = vi.fn(async () => ({
      qid: "Q1",
      files: [],
      trace: [],
      saved: [],
      added: 2,
      errors: [{ fileTitle: "File:Later.jpg", stage: "metadata", message: "Commons unavailable" }],
    }));

    await collectVenueImageDiscovery({} as SupabaseClient, result, {
      venueId: "venue-1", qid: "Q1", venueName: "Venue",
    }, discover);

    expect(result.imageCandidatesAdded).toBe(2);
    expect(result.imageDiscoveryErrors).toEqual([expect.objectContaining({ qid: "Q1", stage: "metadata" })]);
    expect(wikidataImportRunStatus(1, 0)).toBe("completed");
  });

  it("isolates an unexpected image discovery exception from core import status", async () => {
    const result = { imageCandidatesAdded: 0, imageDiscoveryErrors: [] as Array<{ qid: string; fileTitle?: string; stage: string; message: string }> };
    const discover = vi.fn(async () => { throw new Error("unexpected image failure"); });

    await collectVenueImageDiscovery({} as SupabaseClient, result, {
      venueId: "venue-1", qid: "Q1", venueName: "Venue",
    }, discover);

    expect(result.imageCandidatesAdded).toBe(0);
    expect(result.imageDiscoveryErrors).toEqual([expect.objectContaining({ qid: "Q1", stage: "unexpected" })]);
    expect(wikidataImportRunStatus(1, 0)).toBe("completed");
  });

  it("records hosted image discovery as deferred without making the optional call", async () => {
    const result = { imageCandidatesAdded: 0, imageDiscoveryDeferred: 0, imageDiscoveryErrors: [] as Array<{ qid: string; fileTitle?: string; stage: string; message: string }> };
    const discover = vi.fn();

    await handleVenueImageDiscovery("hosted", "count", {} as SupabaseClient, result, {
      venueId: "venue-1", qid: "Q1", venueName: "Venue",
    }, discover);

    expect(result.imageDiscoveryDeferred).toBe(1);
    expect(discover).not.toHaveBeenCalled();
  });

  it("keeps LOCAL image discovery inline", async () => {
    const result = { imageCandidatesAdded: 0, imageDiscoveryDeferred: 0, imageDiscoveryErrors: [] as Array<{ qid: string; fileTitle?: string; stage: string; message: string }> };
    const discover = vi.fn().mockResolvedValue({ added: 1, errors: [] });

    await handleVenueImageDiscovery("local", "count", {} as SupabaseClient, result, {
      venueId: "venue-1", qid: "Q1", venueName: "Venue",
    }, discover);

    expect(result.imageCandidatesAdded).toBe(1);
    expect(result.imageDiscoveryDeferred).toBe(0);
    expect(discover).toHaveBeenCalledOnce();
  });

  it("recovers only stale running hosted Venue import rows with a sanitized failure", async () => {
    const lt = vi.fn().mockResolvedValue({ data: [{ id: "stale-run" }], error: null });
    const eq = vi.fn(() => ({ eq, lt }));
    const select = vi.fn(() => ({ eq }));
    const inFilter = vi.fn().mockResolvedValue({ error: null });
    const update = vi.fn(() => ({ in: inFilter }));
    const db = { from: vi.fn(() => ({ select, update })) } as unknown as SupabaseClient;
    const now = new Date("2026-10-29T12:00:00.000Z");

    await expect(recoverAbandonedHostedVenueImports(db, now)).resolves.toBe(1);

    expect(lt).toHaveBeenCalledWith("started_at", "2026-10-29T11:54:00.000Z");
    expect(update).toHaveBeenCalledWith(expect.objectContaining({
      status: "failed",
      error_count: 1,
      finished_at: now.toISOString(),
      errors: [{ message: expect.not.stringContaining("b4d618f8") }],
    }));
    expect(inFilter).toHaveBeenCalledWith("id", ["stale-run"]);
  });

  it("leaves recent or completed runs untouched when no stale running row matches", async () => {
    const lt = vi.fn().mockResolvedValue({ data: [], error: null });
    const eq = vi.fn(() => ({ eq, lt }));
    const select = vi.fn(() => ({ eq }));
    const update = vi.fn();
    const db = { from: vi.fn(() => ({ select, update })) } as unknown as SupabaseClient;

    await expect(recoverAbandonedHostedVenueImports(db, new Date("2026-10-29T12:00:00.000Z"))).resolves.toBe(0);
    expect(update).not.toHaveBeenCalled();
  });
});
