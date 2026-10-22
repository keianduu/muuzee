import { describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { WikidataVenue } from "./venue-import-types";
import { buildVenueRefreshPlan, normalizeVenueRefreshLimit, runVenuePeriodicRefresh, selectBoundedVenueRefreshSources, type VenueRefreshTarget } from "./venue-periodic-refresh";

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

describe("Venue periodic refresh", () => {
  it("bounds the deterministic batch size to 1..50 with a default of 20", () => {
    expect(normalizeVenueRefreshLimit()).toBe(20);
    expect(normalizeVenueRefreshLimit(0)).toBe(1);
    expect(normalizeVenueRefreshLimit(80)).toBe(50);
  });

  it("selects only valid linked QIDs in deterministic Venue order without duplicate identities", () => {
    const source = target().sourceRecord;
    const rows = [
      { ...source, id: "4", external_id: "not-a-qid", venue_id: "venue-0" },
      { ...source, id: "3", external_id: "Q9", venue_id: "venue-2" },
      { ...source, id: "2", external_id: "Q2", venue_id: "venue-1" },
      { ...source, id: "1", external_id: "Q1", venue_id: "venue-1" },
      { ...source, id: "5", external_id: "Q5", venue_id: "" },
    ];
    expect(selectBoundedVenueRefreshSources(rows, 2).map((row) => [row.venue_id, row.external_id])).toEqual([
      ["venue-1", "Q1"], ["venue-2", "Q9"],
    ]);
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
      loadTargets: vi.fn().mockResolvedValue([value]),
      fetchVenues: vi.fn().mockResolvedValue({ venues: new Map([["Q123", venue()]]), errors: new Map() }),
      createRun, applyPlan, finishRun,
    });
    expect(result.runId).toBeNull();
    expect(result).toMatchObject({ requested: 20, scanned: 1, fetched: 1, changed: 1, errors: [] });
    expect(createRun).not.toHaveBeenCalled();
    expect(applyPlan).not.toHaveBeenCalled();
    expect(finishRun).not.toHaveBeenCalled();
  });

  it("creates exactly one run and applies only the selected existing targets", async () => {
    const values = [target(), { ...target({ id: "venue-2", name: "同一" }), sourceRecord: { ...target().sourceRecord, id: "source-2", external_id: "Q456", venue_id: "venue-2" } }];
    const createRun = vi.fn().mockResolvedValue("run-1");
    const applyPlan = vi.fn().mockResolvedValue(undefined);
    const finishRun = vi.fn().mockResolvedValue(undefined);
    const result = await runVenuePeriodicRefresh({ dryRun: false }, {} as SupabaseClient, {
      loadTargets: vi.fn().mockResolvedValue(values),
      fetchVenues: vi.fn().mockResolvedValue({ venues: new Map([["Q123", venue()], ["Q456", venue({ qid: "Q456", name: "同一", officialUrl: null, venueType: "other" })]]), errors: new Map() }),
      createRun, applyPlan, finishRun,
    });
    expect(createRun).toHaveBeenCalledTimes(1);
    expect(applyPlan).toHaveBeenCalledTimes(2);
    expect(finishRun).toHaveBeenCalledTimes(1);
    expect(result.runId).toBe("run-1");
    expect(result.scanned).toBe(2);
  });

  it("records a fetch failure without guessing or applying that Venue", async () => {
    const applyPlan = vi.fn();
    const result = await runVenuePeriodicRefresh({ dryRun: false }, {} as SupabaseClient, {
      loadTargets: vi.fn().mockResolvedValue([target()]),
      fetchVenues: vi.fn().mockResolvedValue({ venues: new Map(), errors: new Map([["Q123", "upstream failed"]]) }),
      createRun: vi.fn().mockResolvedValue("run-1"), applyPlan, finishRun: vi.fn(),
    });
    expect(result.errors).toEqual([{ qid: "Q123", venueId: "venue-1", message: "upstream failed" }]);
    expect(applyPlan).not.toHaveBeenCalled();
  });
});
