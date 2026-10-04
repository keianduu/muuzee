import { describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { buildVenueFieldReviewRows, eligibleSelectedVenueFields, venueSourceLabel } from "./venue-data-review";
import { applyOfficialVenueFields, previewOfficialVenueFields } from "./venue-field-review-service";

function officialReviewDb() {
  const state = {
    venue: { address: "", postal_code: "", description: "Manual copy" } as Record<string, unknown>,
    sources: [{ field_name: "description", source: "manual", source_url: null, is_current: true }] as Array<Record<string, unknown>>,
    updates: [] as Array<Record<string, unknown>>,
    inserted: [] as Array<Record<string, unknown>>,
  };
  const crawl = {
    import_run_id: "run-1",
    crawl_status: "partial",
    notes: null,
    extracted_values: { address: "Official address", postal_code: "100-0001", description: "Official copy" },
    field_source_urls: { address: "https://museum.example/access", postal_code: "https://museum.example/access", description: "https://museum.example/about" },
    description_source_url: "https://museum.example/about",
  };
  const db = { from: (table: string) => {
    const filters: Array<[string, unknown]> = [];
    let operation: "select" | "update" | "insert" = "select";
    let payload: Record<string, unknown> = {};
    const query: Record<string, unknown> = {};
    query.select = () => { operation = "select"; return query; };
    query.eq = (key: string, value: unknown) => { filters.push([key, value]); return query; };
    query.order = () => query;
    query.limit = () => query;
    query.update = (value: Record<string, unknown>) => { operation = "update"; payload = value; return query; };
    query.insert = (value: Record<string, unknown>) => { operation = "insert"; payload = value; return query; };
    query.maybeSingle = async () => ({ data: table === "official_venue_crawl_results" ? crawl : null, error: null });
    query.single = async () => ({ data: table === "venues" ? state.venue : null, error: null });
    query.then = (resolve: (result: { data?: unknown; error: null }) => unknown) => {
      if (operation === "select" && table === "venue_field_sources") return Promise.resolve({ data: state.sources, error: null }).then(resolve);
      if (operation === "update" && table === "venues") { Object.assign(state.venue, payload); state.updates.push(payload); }
      if (operation === "update" && table === "venue_field_sources" && payload.is_current === false) {
        const field = filters.find(([key]) => key === "field_name")?.[1];
        state.sources.forEach((source) => { if (source.field_name === field) source.is_current = false; });
      }
      if (operation === "insert" && table === "venue_field_sources") { state.inserted.push(payload); state.sources.push(payload); }
      return Promise.resolve({ error: null }).then(resolve);
    };
    return query;
  } } as unknown as SupabaseClient;
  return { db, state };
}

describe("Venue field review policy", () => {
  it("defaults blank candidates on, disables unchanged values, and protects higher-priority sources", () => {
    const rows = buildVenueFieldReviewRows(
      { name: "Manual name", name_en: "", address: "Same address", official_url: "https://current.example" },
      [
        { field_name: "name", source: "manual", is_current: true },
        { field_name: "address", source: "wikidata", is_current: true },
        { field_name: "official_url", source: "official_website", is_current: true },
      ],
      { name: "Wikidata name", name_en: "Candidate EN", address: "Same address", official_url: "https://candidate.example" },
      "wikidata",
      { name_en: "https://www.wikidata.org/wiki/Q1" },
    );
    expect(rows.find((row) => row.key === "name")).toMatchObject({ protected: true, defaultSelected: false });
    expect(rows.find((row) => row.key === "name_en")).toMatchObject({ protected: false, unchanged: false, defaultSelected: true, candidateSourceUrl: "https://www.wikidata.org/wiki/Q1" });
    expect(rows.find((row) => row.key === "address")).toMatchObject({ unchanged: true, defaultSelected: false });
    expect(rows.find((row) => row.key === "official_url")).toMatchObject({ protected: true, defaultSelected: false });
  });

  it("uses current provenance only and reports unknown or missing provenance explicitly", () => {
    const [row] = buildVenueFieldReviewRows(
      { address: "Current" },
      [
        { field_name: "address", source: "manual", is_current: false },
        { field_name: "address", source: "official_website", source_url: "https://museum.example/access", is_current: true },
      ],
      { address: "Candidate" },
      "official_website",
      { address: "https://museum.example/access" },
      [["address", "住所"]],
    );
    expect(row).toMatchObject({ currentSource: "official_website", currentSourceLabel: "公式サイト", candidateSourceUrl: "https://museum.example/access" });
    expect(venueSourceLabel("legacy")).toBe("不明");
    expect(venueSourceLabel(null)).toBe("不明");
  });

  it("reports field coverage for fetched, missing, unchanged, and protected values", () => {
    const rows = buildVenueFieldReviewRows(
      { name: "Manual", name_en: "Same", city: "" },
      [{ field_name: "name", source: "manual", is_current: true }],
      { name: "Candidate", name_en: "Same", city: "Tokyo", address: null },
      "wikidata",
      {},
      [["name", "名称"], ["name_en", "英語名"], ["city", "City"], ["address", "住所"]],
    );
    expect(rows.map((row) => row.resultState)).toEqual(["protected", "unchanged", "fetched", "missing"]);
  });

  it("applies only selected, changed, non-protected fields", () => {
    const rows = buildVenueFieldReviewRows(
      { name: "Manual", name_en: "", city: "Tokyo" },
      [{ field_name: "name", source: "manual", is_current: true }],
      { name: "Candidate", name_en: "Candidate EN", city: "Tokyo" },
      "wikidata",
    );
    expect(eligibleSelectedVenueFields(rows, ["name", "name_en", "city"]).map((row) => row.key)).toEqual(["name_en"]);
  });

  it("lets Official Website replace lower-priority Wikidata but not Manual", () => {
    const rows = buildVenueFieldReviewRows(
      { address: "Wikidata address", description: "Manual copy" },
      [{ field_name: "address", source: "wikidata", is_current: true }, { field_name: "description", source: "manual", is_current: true }],
      { address: "Official address", description: "Official copy" },
      "official_website",
    );
    expect(rows.find((row) => row.key === "address")?.protected).toBe(false);
    expect(rows.find((row) => row.key === "description")?.protected).toBe(true);
  });

  it("previews the saved official crawl without mutating the Master", async () => {
    const { db, state } = officialReviewDb();
    const before = structuredClone(state.venue);
    const preview = await previewOfficialVenueFields(db, "venue-1", "run-1");
    expect(preview.crawlStatus).toBe("partial");
    expect(preview.rows.find((row) => row.key === "address")).toMatchObject({ candidateValue: "Official address", candidateSourceUrl: "https://museum.example/access", defaultSelected: true });
    expect(state.venue).toEqual(before);
    expect(state.updates).toHaveLength(0);
  });

  it("applies only selected eligible official fields and records their exact source URLs", async () => {
    const { db, state } = officialReviewDb();
    const result = await applyOfficialVenueFields(db, "venue-1", "run-1", ["address", "postal_code", "description"]);
    expect(result.applied).toEqual(["address", "postal_code"]);
    expect(state.venue).toMatchObject({ address: "Official address", postal_code: "100-0001", description: "Manual copy" });
    expect(state.inserted).toEqual(expect.arrayContaining([
      expect.objectContaining({ field_name: "address", source: "official_website", source_url: "https://museum.example/access", is_current: true }),
      expect.objectContaining({ field_name: "postal_code", source: "official_website", source_url: "https://museum.example/access", is_current: true }),
    ]));
  });
});
