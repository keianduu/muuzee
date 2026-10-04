import { describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { mediaAssetMetadataFromCandidate, chooseAutoPrimaryCandidate } from "./primary-image-policy";
import { autoSetPreferredMasterCandidatePrimary, setMasterPrimaryFromCandidate, type ImageOwnerEntity } from "./master-primary-image";

function imageSelectionDb(ownerKey = "venue_id") {
  const state = {
    sourceRecords: [{ id: "source-1", [ownerKey]: "venue-1" }] as Array<Record<string, unknown>>,
    candidates: [
      { id: "candidate-a", source_record_id: "source-1", source_url: "https://source.example/a", image_url: "https://image.example/a.jpg", is_active: true, review_status: "unreviewed", rights_status: "approved" },
      { id: "candidate-b", source_record_id: "source-1", source_url: "https://source.example/b", image_url: "https://image.example/b.jpg", is_active: true, review_status: "unreviewed", rights_status: "needs_review" },
      { id: "candidate-c", source_record_id: "source-1", source_url: "https://source.example/c", image_url: "https://image.example/c.jpg", is_active: true, review_status: "unreviewed", rights_status: "approved" },
    ],
    media: [
      { id: "asset-a", [ownerKey]: "venue-1", source_url: "https://source.example/a", is_primary: true },
      { id: "asset-b", [ownerKey]: "venue-1", source_url: "https://source.example/b", is_primary: false },
    ] as Array<Record<string, unknown>>,
  };
  const db = { from(table: string) {
    let operation: "select" | "update" = "select";
    let payload: Record<string, unknown> = {};
    const filters: Array<["eq" | "neq" | "in", string, unknown]> = [];
    const rows = () => table === "source_records" ? state.sourceRecords : table === "source_image_candidates" ? state.candidates : state.media;
    const matches = (row: Record<string, unknown>) => filters.every(([kind, key, value]) => kind === "eq" ? row[key] === value : kind === "neq" ? row[key] !== value : (value as unknown[]).includes(row[key]));
    const query: Record<string, unknown> = {};
    query.select = () => { operation = "select"; return query; };
    query.update = (value: Record<string, unknown>) => { operation = "update"; payload = value; return query; };
    query.eq = (key: string, value: unknown) => { filters.push(["eq", key, value]); return query; };
    query.neq = (key: string, value: unknown) => { filters.push(["neq", key, value]); return query; };
    query.in = (key: string, value: unknown[]) => { filters.push(["in", key, value]); return query; };
    query.limit = () => query;
    query.order = () => query;
    query.maybeSingle = async () => ({ data: rows().find((row) => matches(row as Record<string, unknown>)) || null, error: null });
    query.single = async () => ({ data: rows().find((row) => matches(row as Record<string, unknown>)) || null, error: null });
    query.then = (resolve: (value: { data?: unknown; error: null }) => unknown) => {
      if (operation === "update") rows().filter((row) => matches(row as Record<string, unknown>)).forEach((row) => Object.assign(row, payload));
      return Promise.resolve({ data: operation === "select" ? rows().filter((row) => matches(row as Record<string, unknown>)) : undefined, error: null }).then(resolve);
    };
    return query;
  } } as unknown as SupabaseClient;
  return { db, state };
}

describe("shared Venue / Artist primary image policy", () => {
  const candidate = (id: string, source: string, extra = {}) => ({ id, discovery_source: source, is_active: true, rights_status: "needs_review", ...extra });

  it("protects an existing primary", () => {
    expect(chooseAutoPrimaryCandidate({ primaryCount: 1, candidates: [candidate("p18", "wikidata_p18")] }).reason).toBe("primary_exists");
  });

  it("auto-selects exactly one usable candidate", () => {
    expect(chooseAutoPrimaryCandidate({ primaryCount: 0, candidates: [candidate("p18", "wikidata_p18")] })).toMatchObject({ candidateId: "p18", reason: "single_candidate" });
  });

  it("excludes rejected or inactive P18 candidates", () => {
    expect(chooseAutoPrimaryCandidate({ primaryCount: 0, candidates: [candidate("p18", "wikidata_p18", { rights_status: "rejected" })] }).candidateId).toBeNull();
    expect(chooseAutoPrimaryCandidate({ primaryCount: 0, candidates: [candidate("p18", "wikidata_p18", { review_status: "rejected" })] }).candidateId).toBeNull();
    expect(chooseAutoPrimaryCandidate({ primaryCount: 0, candidates: [candidate("p18", "wikidata_p18", { is_active: false })] }).candidateId).toBeNull();
  });

  it("leaves every multiple-candidate set to a human, even when P18 exists", () => {
    expect(chooseAutoPrimaryCandidate({ primaryCount: 0, candidates: [candidate("one", "wikipedia_article")] })).toMatchObject({ candidateId: "one", reason: "single_candidate" });
    expect(chooseAutoPrimaryCandidate({ primaryCount: 0, candidates: [candidate("one", "wikipedia_article"), candidate("p18", "wikidata_p18"), candidate("two", "commons_category")] })).toMatchObject({ candidateId: null, reason: "multiple_candidates" });
  });

  it("preserves candidate rights and attribution metadata without approving rights", () => {
    const metadata = mediaAssetMetadataFromCandidate({ provider: "wikimedia_commons", source_url: "https://commons.test/file", credit: "Credit", usage_terms: "Attribution", license_short_name: "CC BY 4.0", license_url: "https://license.test", author: "Author", rights_status: "needs_review" });
    expect(metadata).toEqual({ source_type: "wikimedia", source_url: "https://commons.test/file", credit: "Credit", usage_note: "Attribution", reported_license: "CC BY 4.0", reported_license_url: "https://license.test", reported_author: "Author", reported_usage_terms: "Attribution", rights_status: "needs_review" });
  });

  it("explicit selection replaces Primary, excludes other candidates, and preserves every rights status", async () => {
    const { db, state } = imageSelectionDb();
    const beforeRights = state.candidates.map(({ id, rights_status }) => [id, rights_status]);
    await setMasterPrimaryFromCandidate("venues", "venue-1", "candidate-b", { replaceExisting: true }, db);
    expect(state.media.filter((asset) => asset.is_primary)).toEqual([expect.objectContaining({ id: "asset-b" })]);
    expect(state.candidates.map(({ id, review_status, is_active }) => [id, review_status, is_active])).toEqual([
      ["candidate-a", "rejected", false], ["candidate-b", "accepted", true], ["candidate-c", "rejected", false],
    ]);
    expect(state.candidates.map(({ id, rights_status }) => [id, rights_status])).toEqual(beforeRights);
  });

  it("auto-selects and persists the exactly-one usable candidate when no Primary exists", async () => {
    const { db, state } = imageSelectionDb();
    state.candidates.splice(0, state.candidates.length, state.candidates[1]);
    state.media[0].is_primary = false;
    const result = await autoSetPreferredMasterCandidatePrimary("venues", "venue-1", db);
    expect(result).toMatchObject({ changed: true, reason: "primary_set", assetId: "asset-b" });
    expect(state.media.filter((asset) => asset.is_primary)).toEqual([expect.objectContaining({ id: "asset-b" })]);
    expect(state.candidates[0]).toMatchObject({ id: "candidate-b", review_status: "accepted", is_active: true, rights_status: "needs_review" });
  });

  it.each([
    ["venues", "venue_id"],
    ["artists", "artist_id"],
    ["works", "work_id"],
    ["exhibitions", "exhibition_id"],
  ] as const)("persists the exact-one policy through the %s owner boundary", async (entity, ownerKey) => {
    const { db, state } = imageSelectionDb(ownerKey);
    state.candidates.splice(0, state.candidates.length, state.candidates[1]);
    state.media.forEach((asset) => { asset.is_primary = false; });

    const result = await autoSetPreferredMasterCandidatePrimary(entity as ImageOwnerEntity, "venue-1", db);

    expect(result).toMatchObject({ changed: true, reason: "primary_set", assetId: "asset-b" });
    expect(state.media.filter((asset) => asset.is_primary)).toEqual([expect.objectContaining({ id: "asset-b", [ownerKey]: "venue-1" })]);
    expect(state.candidates[0]).toMatchObject({ review_status: "accepted", is_active: true, rights_status: "needs_review" });
  });
});
