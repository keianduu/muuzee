import { describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { WikidataVenue } from "./venue-import-types";
import {
  buildVenueRefreshPlan,
  normalizeVenueRefreshLimit,
  runVenuePeriodicRefresh,
  scanBoundedVenueRefreshSources,
  selectBoundedVenueRefreshSources,
  venueRefreshCursorFromMetrics,
  type VenueIdentityAmbiguity,
  type VenueRefreshCursor,
  type VenueRefreshTarget,
} from "./venue-periodic-refresh";

function target(overrides: Partial<VenueRefreshTarget["venue"]> = {}, sources: VenueRefreshTarget["sources"] = []): VenueRefreshTarget {
  return {
    sourceRecord: { id: "source-1", external_id: "Q123", venue_id: "venue-1", source_url: "https://www.wikidata.org/wiki/Q123", raw_payload: {}, checksum: "old" },
    venue: { id: "venue-1", name: "旧名称", official_url: "https://manual.example", publication_status: "published", ...overrides },
    sources,
  };
}

function venue(overrides: Partial<WikidataVenue> = {}): WikidataVenue {
  return {
    qid: "Q123", name: "新名称", nameEn: null, aliases: [], venueType: "museum", rawTypeIds: [], discoveryRootIds: [], countryCode: "JP",
    administrativeAreaId: null, region: null, city: null, address: null, postalCode: null, latitude: null, longitude: null,
    officialUrl: "https://wikidata.example", imageFileTitle: null, commonsCategory: null, inceptionYear: null, openingHours: null,
    description: null, raw: {}, ...overrides,
  };
}

function batch(
  targets: VenueRefreshTarget[],
  identityAmbiguities: VenueIdentityAmbiguity[] = [],
  coverage: {
    start?: VenueRefreshCursor | null;
    end?: VenueRefreshCursor | null;
    reachedCorpusEnd?: boolean;
    sourceRowsScanned?: number;
    scanTruncated?: boolean;
  } = {},
) {
  const defaultEnd = targets.at(-1)
    ? { venueId: targets.at(-1)!.venue.id }
    : identityAmbiguities.at(-1)
      ? { venueId: identityAmbiguities.at(-1)!.venueId }
      : coverage.start ?? null;
  return {
    targets,
    sourceRowsScanned: coverage.sourceRowsScanned ?? targets.length,
    scanTruncated: coverage.scanTruncated ?? false,
    ambiguousIdentities: identityAmbiguities.length,
    identityAmbiguities,
    scanStartCursor: coverage.start ?? null,
    scanEndCursor: coverage.end ?? defaultEnd,
    reachedCorpusEnd: coverage.reachedCorpusEnd ?? false,
  };
}

function sourceRows(count: number, start = 1) {
  return Array.from({ length: count }, (_, index) => ({
    ...target().sourceRecord,
    id: `source-${start + index}`,
    external_id: `Q${start + index}`,
    venue_id: `venue-${String(start + index).padStart(3, "0")}`,
  }));
}

function refreshTarget(index: number): VenueRefreshTarget {
  const venueId = `venue-${String(index).padStart(3, "0")}`;
  const value = target({ id: venueId, name: `Venue ${index}` });
  return {
    ...value,
    sourceRecord: { ...value.sourceRecord, id: `source-${index}`, external_id: `Q${index}`, venue_id: venueId },
  };
}

function paged(rows: VenueRefreshTarget["sourceRecord"][]) {
  return vi.fn(async (offset: number, pageSize: number) => rows.slice(offset, offset + pageSize));
}

function noCoverageCursor() {
  return vi.fn().mockResolvedValue(null);
}

describe("Venue periodic refresh", () => {
  it("bounds the deterministic batch size to 1..50 with a default of 20", () => {
    expect(normalizeVenueRefreshLimit()).toBe(20);
    expect(normalizeVenueRefreshLimit(0)).toBe(1);
    expect(normalizeVenueRefreshLimit(80)).toBe(50);
  });

  it("selects a Venue with exactly one valid linked QID", () => {
    const source = target().sourceRecord;
    const selection = selectBoundedVenueRefreshSources([{ ...source, external_id: "Q9", venue_id: "venue-2" }], 2);
    expect(selection.selected.map((row) => [row.venue_id, row.external_id])).toEqual([["venue-2", "Q9"]]);
    expect(selection.ambiguousIdentities).toBe(0);
  });

  it("keeps multiple distinct QIDs behind an identity ambiguity gate", () => {
    const source = target().sourceRecord;
    const selection = selectBoundedVenueRefreshSources([
      { ...source, id: "2", external_id: "Q2", venue_id: "venue-1" },
      { ...source, id: "1", external_id: "Q1", venue_id: "venue-1" },
    ], 2);
    expect(selection.selected).toEqual([]);
    expect(selection).toMatchObject({
      ambiguousIdentities: 1,
      ambiguities: [{ venueId: "venue-1", qids: ["Q1", "Q2"], qidCount: 2 }],
    });
  });

  it("ignores invalid QIDs when one valid identity remains", () => {
    const source = target().sourceRecord;
    const selection = selectBoundedVenueRefreshSources([
      { ...source, id: "1", external_id: "not-a-qid", venue_id: "venue-1" },
      { ...source, id: "2", external_id: "Q2", venue_id: "venue-1" },
    ], 2);
    expect(selection.selected.map((row) => row.external_id)).toEqual(["Q2"]);
    expect(selection.ambiguousIdentities).toBe(0);
  });

  it("advances the stable cursor past an invalid-only Venue group", () => {
    const source = target().sourceRecord;
    const selection = selectBoundedVenueRefreshSources([
      { ...source, id: "1", external_id: "not-a-qid", venue_id: "venue-1" },
    ], 2);
    expect(selection.selected).toEqual([]);
    expect(selection.scanEndCursor).toEqual({ venueId: "venue-1" });
    expect(selection.reachedCorpusEnd).toBe(true);
  });

  it("reads a valid stored cursor and wraps only after a completed corpus pass", () => {
    expect(venueRefreshCursorFromMetrics(null)).toBeNull();
    expect(venueRefreshCursorFromMetrics({ scanEndCursor: { venueId: "venue-020" }, reachedCorpusEnd: false }))
      .toEqual({ venueId: "venue-020" });
    expect(venueRefreshCursorFromMetrics({ scanEndCursor: { venueId: "venue-040" }, reachedCorpusEnd: true }))
      .toBeNull();
    expect(venueRefreshCursorFromMetrics({ scanEndCursor: { venueId: 20 }, reachedCorpusEnd: false })).toBeNull();
  });

  it("does not treat duplicate rows for the same valid QID as distinct identities", () => {
    const source = target().sourceRecord;
    const selection = selectBoundedVenueRefreshSources([
      { ...source, id: "2", external_id: "Q2", venue_id: "venue-1" },
      { ...source, id: "1", external_id: "Q2", venue_id: "venue-1" },
    ], 2);
    expect(selection.selected).toHaveLength(1);
    expect(selection.selected[0].id).toBe("1");
    expect(selection.ambiguousIdentities).toBe(0);
  });

  it("applies the eligible limit after filtering ambiguous identities", () => {
    const source = target().sourceRecord;
    const selection = selectBoundedVenueRefreshSources([
      { ...source, id: "a1", external_id: "Q1", venue_id: "venue-a" },
      { ...source, id: "a2", external_id: "Q2", venue_id: "venue-a" },
      { ...source, id: "b", external_id: "Q3", venue_id: "venue-b" },
      { ...source, id: "c", external_id: "Q4", venue_id: "venue-c" },
    ], 2);
    expect(selection.selected.map((row) => [row.venue_id, row.external_id])).toEqual([
      ["venue-b", "Q3"], ["venue-c", "Q4"],
    ]);
    expect(selection.ambiguousIdentities).toBe(1);
  });

  it("fills a 20-target batch from one page without reading a later page", async () => {
    const loadPage = paged(sourceRows(20));
    const selection = await scanBoundedVenueRefreshSources(loadPage, 20, { pageSize: 50, maxSourceRows: 100 });
    expect(selection).toMatchObject({ selected: expect.any(Array), sourceRowsScanned: 20, scanTruncated: false });
    expect(selection.selected).toHaveLength(20);
    expect(loadPage).toHaveBeenCalledTimes(1);
  });

  it("keeps a Venue group intact when it crosses a source page boundary", async () => {
    const source = target().sourceRecord;
    const rows = [
      { ...source, id: "a-1", external_id: "Q1", venue_id: "venue-a" },
      { ...source, id: "a-2", external_id: "Q1", venue_id: "venue-a" },
      { ...source, id: "a-3", external_id: "Q2", venue_id: "venue-a" },
      { ...source, id: "b-1", external_id: "Q3", venue_id: "venue-b" },
    ];
    const selection = await scanBoundedVenueRefreshSources(paged(rows), 1, { pageSize: 2, maxSourceRows: 10 });
    expect(selection.selected.map((row) => row.venue_id)).toEqual(["venue-b"]);
    expect(selection).toMatchObject({ ambiguousIdentities: 1, sourceRowsScanned: 4, scanTruncated: false });
    expect(selection.scanEndCursor).toEqual({ venueId: "venue-b" });
  });

  it("starts after the previous stable cursor and selects the next deterministic batch", async () => {
    const rows = sourceRows(40);
    const startCursor = { venueId: "venue-020" };
    const remaining = rows.filter((row) => row.venue_id > startCursor.venueId);
    const selection = await scanBoundedVenueRefreshSources(paged(remaining), 20, {
      pageSize: 50,
      maxSourceRows: 100,
      startCursor,
    });
    expect(selection.selected.map((row) => row.external_id)).toEqual(
      Array.from({ length: 20 }, (_, index) => `Q${index + 21}`),
    );
    expect(selection.scanStartCursor).toEqual(startCursor);
    expect(selection.scanEndCursor).toEqual({ venueId: "venue-040" });
    expect(selection.reachedCorpusEnd).toBe(true);
  });

  it("does not let an ambiguous group consume the eligible target limit", async () => {
    const source = target().sourceRecord;
    const rows = [
      { ...source, id: "a-1", external_id: "Q1", venue_id: "venue-a" },
      { ...source, id: "a-2", external_id: "Q2", venue_id: "venue-a" },
      ...sourceRows(2, 3),
    ];
    const selection = await scanBoundedVenueRefreshSources(paged(rows), 2, { pageSize: 10, maxSourceRows: 10 });
    expect(selection.selected.map((row) => row.external_id)).toEqual(["Q3", "Q4"]);
    expect(selection.ambiguousIdentities).toBe(1);
  });

  it("advances coverage through ambiguous and invalid-only groups", async () => {
    const source = target().sourceRecord;
    const rows = [
      { ...source, id: "a-1", external_id: "Q1", venue_id: "venue-a" },
      { ...source, id: "a-2", external_id: "Q2", venue_id: "venue-a" },
      { ...source, id: "b-1", external_id: "invalid", venue_id: "venue-b" },
      { ...source, id: "c-1", external_id: "Q3", venue_id: "venue-c" },
      { ...source, id: "d-1", external_id: "Q4", venue_id: "venue-d" },
    ];
    const selection = await scanBoundedVenueRefreshSources(paged(rows), 1, { pageSize: 5, maxSourceRows: 10 });
    expect(selection.selected.map((row) => row.venue_id)).toEqual(["venue-c"]);
    expect(selection.ambiguousIdentities).toBe(1);
    expect(selection.scanEndCursor).toEqual({ venueId: "venue-c" });
    expect(selection.reachedCorpusEnd).toBe(false);
  });

  it("stops paging after the requested eligible targets are finalized", async () => {
    const loadPage = paged(sourceRows(12));
    const selection = await scanBoundedVenueRefreshSources(loadPage, 2, { pageSize: 3, maxSourceRows: 12 });
    expect(selection.selected.map((row) => row.external_id)).toEqual(["Q1", "Q2"]);
    expect(loadPage).toHaveBeenCalledTimes(1);
    expect(selection.sourceRowsScanned).toBe(2);
    expect(selection.scanTruncated).toBe(false);
  });

  it("stops at the hard source-row ceiling and reports a truncated scan", async () => {
    const source = target().sourceRecord;
    const rows = Array.from({ length: 12 }, (_, index) => ({
      ...source,
      id: `source-${index}`,
      external_id: index < 2 ? "invalid" : index % 2 === 0 ? `Q${index + 1}` : `Q${index + 2}`,
      venue_id: `venue-${Math.floor(index / 2)}`,
    }));
    const loadPage = paged(rows);
    const selection = await scanBoundedVenueRefreshSources(loadPage, 2, { pageSize: 4, maxSourceRows: 8 });
    expect(selection).toMatchObject({ selected: [], sourceRowsScanned: 8, scanTruncated: true });
    expect(loadPage).toHaveBeenCalledTimes(2);
  });

  it("retains the preceding stable cursor when the source ceiling splits a Venue group", async () => {
    const source = target().sourceRecord;
    const rows = [
      { ...source, id: "a-1", external_id: "Q1", venue_id: "venue-a" },
      { ...source, id: "b-1", external_id: "Q2", venue_id: "venue-b" },
      { ...source, id: "b-2", external_id: "Q2", venue_id: "venue-b" },
    ];
    const first = await scanBoundedVenueRefreshSources(paged(rows), 2, {
      pageSize: 3,
      maxSourceRows: 3,
      startCursor: { venueId: "venue-before" },
    });
    expect(first.selected.map((row) => row.venue_id)).toEqual(["venue-a"]);
    expect(first).toMatchObject({ scanTruncated: true, reachedCorpusEnd: false });
    expect(first.scanEndCursor).toEqual({ venueId: "venue-a" });

    const resumed = await scanBoundedVenueRefreshSources(paged([
      rows[1], rows[2],
      { ...source, id: "c-1", external_id: "Q3", venue_id: "venue-c" },
    ]), 1, {
      pageSize: 3,
      maxSourceRows: 3,
      startCursor: first.scanEndCursor,
    });
    expect(resumed.selected.map((row) => row.venue_id)).toEqual(["venue-b"]);
    expect(resumed.scanEndCursor).toEqual({ venueId: "venue-b" });
  });

  it("does not wrap within the request when the remaining corpus is smaller than the limit", async () => {
    const startCursor = { venueId: "venue-020" };
    const selection = await scanBoundedVenueRefreshSources(paged(sourceRows(5, 21)), 20, {
      pageSize: 50,
      maxSourceRows: 100,
      startCursor,
    });
    expect(selection.selected.map((row) => row.external_id)).toEqual(["Q21", "Q22", "Q23", "Q24", "Q25"]);
    expect(selection.scanStartCursor).toEqual(startCursor);
    expect(selection.scanEndCursor).toEqual({ venueId: "venue-025" });
    expect(selection.reachedCorpusEnd).toBe(true);
  });

  it("keeps duplicate rows for one QID eligible during incremental scanning", async () => {
    const source = target().sourceRecord;
    const rows = [
      { ...source, id: "a-1", external_id: "Q1", venue_id: "venue-a" },
      { ...source, id: "a-2", external_id: "Q1", venue_id: "venue-a" },
    ];
    const selection = await scanBoundedVenueRefreshSources(paged(rows), 1, { pageSize: 10, maxSourceRows: 10 });
    expect(selection.selected).toHaveLength(1);
    expect(selection.ambiguousIdentities).toBe(0);
  });

  it("refreshes Wikidata-owned fields while protecting higher-priority provenance", () => {
    const plan = buildVenueRefreshPlan(target({ address: "公式住所" }, [
      { field_name: "name", source: "wikidata", is_current: true },
      { field_name: "official_url", source: "manual", is_current: true },
      { field_name: "address", source: "official_website", is_current: true },
    ]), venue({ address: "Wikidata住所" }));
    expect(plan.changes).toEqual([{ field: "name", value: "新名称" }, { field: "venue_type", value: "museum" }, { field: "country_code", value: "JP" }]);
    expect(plan.protectedChanges).toEqual([
      { field: "address", value: "Wikidata住所" },
      { field: "official_url", value: "https://wikidata.example" },
    ]);
    expect(plan.changes.map((change) => change.field)).not.toContain("publication_status");
  });

  it("is a true dry run with no run or apply writes", async () => {
    const createRun = vi.fn();
    const applyPlan = vi.fn();
    const finishRun = vi.fn();
    const value = target();
    const result = await runVenuePeriodicRefresh({ dryRun: true, limit: 20 }, {} as SupabaseClient, {
      loadCoverageCursor: noCoverageCursor(),
      loadTargets: vi.fn().mockResolvedValue(batch([value])),
      fetchVenues: vi.fn().mockResolvedValue({ venues: new Map([["Q123", venue()]]), errors: new Map() }),
      createRun, applyPlan, finishRun,
    });
    expect(result.runId).toBeNull();
    expect(result).toMatchObject({ requested: 20, scanned: 1, sourceRowsScanned: 1, scanTruncated: false, fetched: 1, changed: 1, errors: [] });
    expect(createRun).not.toHaveBeenCalled();
    expect(applyPlan).not.toHaveBeenCalled();
    expect(finishRun).not.toHaveBeenCalled();
  });

  it("uses the same next batch for Dry Run and Apply without advancing during Dry Run", async () => {
    const cursor = { venueId: "venue-020" };
    const values = [refreshTarget(21), refreshTarget(22)];
    const loadCoverageCursor = vi.fn().mockResolvedValue(cursor);
    const loadTargets = vi.fn().mockResolvedValue(batch(values, [], {
      start: cursor,
      end: { venueId: "venue-022" },
      reachedCorpusEnd: false,
    }));
    const finishRun = vi.fn();
    const dependencies = {
      loadCoverageCursor,
      loadTargets,
      fetchVenues: vi.fn().mockResolvedValue({
        venues: new Map(values.map((value, index) => [value.sourceRecord.external_id, venue({ qid: value.sourceRecord.external_id, name: `更新 ${index}` })])),
        errors: new Map(),
      }),
      createRun: vi.fn().mockResolvedValue("run-1"),
      applyPlan: vi.fn(),
      finishRun,
    };
    const dryResult = await runVenuePeriodicRefresh({ dryRun: true, limit: 2 }, {} as SupabaseClient, dependencies);
    const applyResult = await runVenuePeriodicRefresh({ dryRun: false, limit: 2 }, {} as SupabaseClient, dependencies);

    expect(dryResult.records.map((record) => record.venueId)).toEqual(applyResult.records.map((record) => record.venueId));
    expect(loadTargets).toHaveBeenNthCalledWith(1, expect.anything(), 2, cursor);
    expect(loadTargets).toHaveBeenNthCalledWith(2, expect.anything(), 2, cursor);
    expect(dependencies.createRun).toHaveBeenCalledTimes(1);
    expect(finishRun).toHaveBeenCalledTimes(1);
  });

  it("persists one stable cursor per Apply and the next Apply continues from it", async () => {
    const values = [refreshTarget(1), refreshTarget(2), refreshTarget(3), refreshTarget(4)];
    let storedMetrics: unknown = null;
    let runCount = 0;
    const loadCoverageCursor = vi.fn(async () => venueRefreshCursorFromMetrics(storedMetrics));
    const loadTargets = vi.fn(async (_db: SupabaseClient, limit: number, cursor: VenueRefreshCursor | null) => {
      const remaining = values.filter((value) => !cursor || value.venue.id > cursor.venueId);
      const selected = remaining.slice(0, limit);
      return batch(selected, [], {
        start: cursor,
        end: selected.at(-1) ? { venueId: selected.at(-1)!.venue.id } : cursor,
        reachedCorpusEnd: remaining.length <= limit,
      });
    });
    const finishRun = vi.fn(async (_db: SupabaseClient, _result: unknown, coverage: unknown) => {
      storedMetrics = coverage;
    });
    const dependencies = {
      loadCoverageCursor,
      loadTargets,
      fetchVenues: vi.fn(async (targets: VenueRefreshTarget[]) => ({
        venues: new Map(targets.map((value) => [value.sourceRecord.external_id, venue({ qid: value.sourceRecord.external_id, name: value.venue.name })])),
        errors: new Map<string, string>(),
      })),
      createRun: vi.fn(async () => `run-${++runCount}`),
      applyPlan: vi.fn(),
      finishRun,
    };

    const first = await runVenuePeriodicRefresh({ dryRun: false, limit: 2 }, {} as SupabaseClient, dependencies);
    const second = await runVenuePeriodicRefresh({ dryRun: false, limit: 2 }, {} as SupabaseClient, dependencies);

    expect(first.records.map((record) => record.venueId)).toEqual(["venue-001", "venue-002"]);
    expect(second.records.map((record) => record.venueId)).toEqual(["venue-003", "venue-004"]);
    expect(loadTargets).toHaveBeenNthCalledWith(1, expect.anything(), 2, null);
    expect(loadTargets).toHaveBeenNthCalledWith(2, expect.anything(), 2, { venueId: "venue-002" });
    expect(first).toMatchObject({ reachedCorpusEnd: false, coverageContinues: true });
    expect(second).toMatchObject({ reachedCorpusEnd: true, coverageContinues: false });
    expect(first).not.toHaveProperty("scanEndCursor");
    expect(dependencies.createRun).toHaveBeenCalledTimes(2);
    expect(finishRun).toHaveBeenCalledTimes(2);
  });

  it("wraps on the next Apply only after the previous Apply reached the corpus end", async () => {
    const values = [refreshTarget(1), refreshTarget(2)];
    let storedMetrics: unknown = { scanEndCursor: { venueId: "venue-001" }, reachedCorpusEnd: false };
    const loadCoverageCursor = vi.fn(async () => venueRefreshCursorFromMetrics(storedMetrics));
    const loadTargets = vi.fn(async (_db: SupabaseClient, _limit: number, cursor: VenueRefreshCursor | null) => {
      const selected = cursor ? [values[1]] : [values[0]];
      return batch(selected, [], {
        start: cursor,
        end: { venueId: selected[0].venue.id },
        reachedCorpusEnd: true,
      });
    });
    const dependencies = {
      loadCoverageCursor,
      loadTargets,
      fetchVenues: vi.fn(async (targets: VenueRefreshTarget[]) => ({
        venues: new Map(targets.map((value) => [value.sourceRecord.external_id, venue({ qid: value.sourceRecord.external_id, name: value.venue.name })])),
        errors: new Map<string, string>(),
      })),
      createRun: vi.fn().mockResolvedValue("run-1"),
      applyPlan: vi.fn(),
      finishRun: vi.fn(async (_db: SupabaseClient, _result: unknown, coverage: unknown) => { storedMetrics = coverage; }),
    };

    const endRun = await runVenuePeriodicRefresh({ dryRun: false, limit: 20 }, {} as SupabaseClient, dependencies);
    const wrappedRun = await runVenuePeriodicRefresh({ dryRun: false, limit: 20 }, {} as SupabaseClient, dependencies);
    expect(endRun.records.map((record) => record.venueId)).toEqual(["venue-002"]);
    expect(wrappedRun.records.map((record) => record.venueId)).toEqual(["venue-001"]);
    expect(loadTargets).toHaveBeenNthCalledWith(1, expect.anything(), 20, { venueId: "venue-001" });
    expect(loadTargets).toHaveBeenNthCalledWith(2, expect.anything(), 20, null);
  });

  it("reports an ambiguous identity during dry run without any write or fetch dependency", async () => {
    const createRun = vi.fn();
    const applyPlan = vi.fn();
    const finishRun = vi.fn();
    const fetchVenues = vi.fn();
    const ambiguity: VenueIdentityAmbiguity = {
      venueId: "venue-1", venueName: "曖昧Venue", qids: ["Q1", "Q2"], qidCount: 2, status: "identity_ambiguous",
    };
    const result = await runVenuePeriodicRefresh({ dryRun: true, limit: 20 }, {} as SupabaseClient, {
      loadCoverageCursor: noCoverageCursor(),
      loadTargets: vi.fn().mockResolvedValue(batch([], [ambiguity])),
      fetchVenues, createRun, applyPlan, finishRun,
    });
    expect(result).toMatchObject({
      runId: null, scanned: 0, fetched: 0, changed: 0, unchanged: 0,
      ambiguousIdentities: 1, identityAmbiguities: [ambiguity],
    });
    expect(fetchVenues).not.toHaveBeenCalled();
    expect(createRun).not.toHaveBeenCalled();
    expect(applyPlan).not.toHaveBeenCalled();
    expect(finishRun).not.toHaveBeenCalled();
  });

  it("records one Apply run but never fetches or applies an ambiguous Venue", async () => {
    const createRun = vi.fn().mockResolvedValue("run-1");
    const applyPlan = vi.fn();
    const finishRun = vi.fn().mockResolvedValue(undefined);
    const fetchVenues = vi.fn();
    const ambiguity: VenueIdentityAmbiguity = {
      venueId: "venue-1", venueName: "曖昧Venue", qids: ["Q1", "Q2"], qidCount: 2, status: "identity_ambiguous",
    };
    const result = await runVenuePeriodicRefresh({ dryRun: false }, {} as SupabaseClient, {
      loadCoverageCursor: noCoverageCursor(),
      loadTargets: vi.fn().mockResolvedValue(batch([], [ambiguity])),
      fetchVenues, createRun, applyPlan, finishRun,
    });
    expect(result).toMatchObject({ runId: "run-1", scanned: 0, fetched: 0, ambiguousIdentities: 1 });
    expect(createRun).toHaveBeenCalledTimes(1);
    expect(fetchVenues).not.toHaveBeenCalled();
    expect(applyPlan).not.toHaveBeenCalled();
    expect(finishRun).toHaveBeenCalledTimes(1);
  });

  it("creates exactly one run and applies only the selected existing targets", async () => {
    const values = [target(), { ...target({ id: "venue-2", name: "同一" }), sourceRecord: { ...target().sourceRecord, id: "source-2", external_id: "Q456", venue_id: "venue-2" } }];
    const createRun = vi.fn().mockResolvedValue("run-1");
    const applyPlan = vi.fn().mockResolvedValue(undefined);
    const finishRun = vi.fn().mockResolvedValue(undefined);
    const result = await runVenuePeriodicRefresh({ dryRun: false }, {} as SupabaseClient, {
      loadCoverageCursor: noCoverageCursor(),
      loadTargets: vi.fn().mockResolvedValue(batch(values)),
      fetchVenues: vi.fn().mockResolvedValue({ venues: new Map([["Q123", venue()], ["Q456", venue({ qid: "Q456", name: "同一", officialUrl: null, venueType: "other" })]]), errors: new Map() }),
      createRun, applyPlan, finishRun,
    });
    expect(createRun).toHaveBeenCalledTimes(1);
    expect(applyPlan).toHaveBeenCalledTimes(2);
    expect(finishRun).toHaveBeenCalledTimes(1);
    expect(result.runId).toBe("run-1");
    expect(result.scanned).toBe(2);
    expect(result.sourceRowsScanned).toBe(2);
    expect(result.scanTruncated).toBe(false);
  });

  it("records a fetch failure without guessing or applying that Venue", async () => {
    const applyPlan = vi.fn();
    const result = await runVenuePeriodicRefresh({ dryRun: false }, {} as SupabaseClient, {
      loadCoverageCursor: noCoverageCursor(),
      loadTargets: vi.fn().mockResolvedValue(batch([target()])),
      fetchVenues: vi.fn().mockResolvedValue({ venues: new Map(), errors: new Map([["Q123", "upstream failed"]]) }),
      createRun: vi.fn().mockResolvedValue("run-1"), applyPlan, finishRun: vi.fn(),
    });
    expect(result.errors).toEqual([{ qid: "Q123", venueId: "venue-1", message: "upstream failed" }]);
    expect(applyPlan).not.toHaveBeenCalled();
  });
});
