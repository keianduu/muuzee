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
    ] as Array<Record<string, unknown> & { id: string; is_active: boolean; review_status: string; rights_status: string | null }>,
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
  const candidate = (id: string, source: string, extra = {}) => ({ id, discovery_source: source, is_active: true, rights_status: "approved", ...extra });

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

  it("creates only Rights-approved Registered Image metadata", () => {
    const metadata = mediaAssetMetadataFromCandidate({ provider: "wikimedia_commons", source_url: "https://commons.test/file", credit: "Credit", usage_terms: "Attribution", license_short_name: "CC BY 4.0", license_url: "https://license.test", author: "Author", rights_status: "needs_review" });
    expect(metadata).toEqual({ source_type: "wikimedia", source_url: "https://commons.test/file", credit: "Credit", usage_note: "Attribution", reported_license: "CC BY 4.0", reported_license_url: "https://license.test", reported_author: "Author", reported_usage_terms: "Attribution", rights_status: "approved" });
  });

  it("requires explicit approval before a needs-review candidate can become Registered", async () => {
    const { db, state } = imageSelectionDb();
    await expect(setMasterPrimaryFromCandidate("venues", "venue-1", "candidate-b", { replaceExisting: true }, db)).rejects.toThrow("明示的な承認");
    await setMasterPrimaryFromCandidate("venues", "venue-1", "candidate-b", { replaceExisting: true, approveRights: true }, db);
    expect(state.media.filter((asset) => asset.is_primary)).toEqual([expect.objectContaining({ id: "asset-b" })]);
    expect(state.candidates.map(({ id, review_status, is_active }) => [id, review_status, is_active])).toEqual([
      ["candidate-a", "rejected", false], ["candidate-b", "accepted", true], ["candidate-c", "rejected", false],
    ]);
    expect(state.candidates.find(({ id }) => id === "candidate-b")).toMatchObject({ rights_status: "approved" });
    expect(state.media.find(({ id }) => id === "asset-b")).toMatchObject({ rights_status: "approved" });
  });

  it("requires explicit approval for null Rights and persists only approved Candidate / Media state", async () => {
    const { db, state } = imageSelectionDb();
    state.candidates.push({ id: "candidate-null", source_record_id: "source-1", source_url: "https://source.example/null", image_url: "https://image.example/null.jpg", is_active: true, review_status: "unreviewed", rights_status: null });
    state.media.push({ id: "asset-null", venue_id: "venue-1", source_url: "https://source.example/null", is_primary: false });

    await expect(setMasterPrimaryFromCandidate("venues", "venue-1", "candidate-null", { replaceExisting: true }, db)).rejects.toThrow("明示的な承認");
    await setMasterPrimaryFromCandidate("venues", "venue-1", "candidate-null", { replaceExisting: true, approveRights: true }, db);

    expect(state.candidates.find(({ id }) => id === "candidate-null")).toMatchObject({ rights_status: "approved", review_status: "accepted", is_active: true });
    expect(state.media.find(({ id }) => id === "asset-null")).toMatchObject({ rights_status: "approved", is_primary: true });
    expect(state.media.filter((asset) => asset.is_primary)).toHaveLength(1);
  });

  it("does not auto-select a needs-review candidate", async () => {
    const { db, state } = imageSelectionDb();
    state.candidates.splice(0, state.candidates.length, state.candidates[1]);
    state.media[0].is_primary = false;
    const result = await autoSetPreferredMasterCandidatePrimary("venues", "venue-1", db);
    expect(result).toMatchObject({ changed: false, reason: "no_candidates" });
    expect(state.media.filter((asset) => asset.is_primary)).toEqual([]);
  });

  it.each([
    ["venues", "venue_id"],
    ["artists", "artist_id"],
    ["works", "work_id"],
    ["exhibitions", "exhibition_id"],
  ] as const)("persists the exact-one policy through the %s owner boundary", async (entity, ownerKey) => {
    const { db, state } = imageSelectionDb(ownerKey);
    state.candidates.splice(0, state.candidates.length, state.candidates[0]);
    state.media.forEach((asset) => { asset.is_primary = false; });

    const result = await autoSetPreferredMasterCandidatePrimary(entity as ImageOwnerEntity, "venue-1", db);

    expect(result).toMatchObject({ changed: true, reason: "primary_set", assetId: "asset-a" });
    expect(state.media.filter((asset) => asset.is_primary)).toEqual([expect.objectContaining({ id: "asset-a", [ownerKey]: "venue-1", rights_status: "approved" })]);
    expect(state.candidates[0]).toMatchObject({ review_status: "accepted", is_active: true, rights_status: "approved" });
  });
});
