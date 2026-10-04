import { describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { confirmWikidataIdentity, selectSingleSourceCandidate, shouldApplySourceField, type StoredWikidataCandidate } from "./source-application";

describe("Venue Source application policy", () => {
  it("auto-selects exactly one candidate regardless of confidence", () => {
    expect(selectSingleSourceCandidate([{ id: "Q1", status: "candidate", confidence: 0.1 }])).toMatchObject({ id: "Q1" });
  });

  it("does not auto-select multiple or zero candidates", () => {
    expect(selectSingleSourceCandidate([])).toBeNull();
    expect(selectSingleSourceCandidate([{ id: "Q1", status: "candidate" }, { id: "Q2", status: "candidate" }])).toBeNull();
  });

  it("ignores rejected rows when deciding whether identity is unique", () => {
    expect(selectSingleSourceCandidate([{ id: "Q1", status: "candidate" }, { id: "Q2", status: "rejected" }])).toMatchObject({ id: "Q1" });
  });

  it("lets Wikidata fill blanks and refresh Wikidata-owned values", () => {
    expect(shouldApplySourceField(null, null)).toBe(true);
    expect(shouldApplySourceField("old", "wikidata")).toBe(true);
  });

  it("protects Official Website and Manual values from Wikidata", () => {
    expect(shouldApplySourceField("official", "official_website")).toBe(false);
    expect(shouldApplySourceField("manual", "manual")).toBe(false);
    expect(shouldApplySourceField(null, "manual")).toBe(false);
  });

  it("confirms identity without writing Venue fields, provenance, or image candidates", async () => {
    const tableCalls: string[] = [];
    const venueUpdates: Array<Record<string, unknown>> = [];
    const db = { from: vi.fn((table: string) => {
      tableCalls.push(table);
      const query: Record<string, unknown> & { operation?: string } = {};
      for (const method of ["select", "eq", "neq", "limit", "order"]) query[method] = vi.fn(() => query);
      query.update = vi.fn((value: Record<string, unknown>) => { query.operation = "update"; if (table === "venues") venueUpdates.push(value); return query; });
      query.upsert = vi.fn(() => { query.operation = "upsert"; return query; });
      query.maybeSingle = vi.fn(async () => ({ data: null, error: null }));
      query.single = vi.fn(async () => ({ data: table === "data_sources" ? { id: "source-1" } : { id: "record-1", venue_id: "venue-1" }, error: null }));
      query.then = (resolve: (value: unknown) => unknown) => Promise.resolve({ error: null }).then(resolve);
      return query;
    }) } as unknown as SupabaseClient;
    const candidate: StoredWikidataCandidate = {
      id: "candidate-1", venue_id: "venue-1", external_id: "Q1", label_ja: "候補", label_en: "Candidate", description: null,
      official_url: "https://candidate.example", latitude: 35, longitude: 139, image_file_title: "Example.jpg", confidence: 0.9,
      match_reasons: ["label"], status: "candidate", raw_payload: { claims: {} },
    };
    await confirmWikidataIdentity(db, "venue-1", candidate);
    expect(venueUpdates).toHaveLength(1);
    expect(venueUpdates[0]).toMatchObject({ wikidata_match_status: "matched", best_wikidata_candidate_qid: "Q1" });
    expect(venueUpdates[0]).not.toHaveProperty("name");
    expect(venueUpdates[0]).not.toHaveProperty("latitude");
    expect(tableCalls).not.toContain("venue_field_sources");
    expect(tableCalls).not.toContain("source_image_candidates");
  });
});
