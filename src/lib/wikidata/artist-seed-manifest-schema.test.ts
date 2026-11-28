import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const migration = readFileSync(join(process.cwd(), "supabase/migrations/202611280002_artist_seed_manifest.sql"), "utf8");

describe("Artist seed manifest schema", () => {
  it("persists versioned complete manifests without global inventory inactivation", () => {
    expect(migration).toContain("create table public.artist_seed_manifests");
    expect(migration).toContain("create table public.artist_seed_manifest_items");
    expect(migration).toContain("create or replace function public.record_artist_seed_manifest(");
    expect(migration).toContain("verifiedExhibitionCount");
    expect(migration).toContain("'unrelatedInventoryInactivated', 0");
    expect(migration).not.toContain("set is_active = false");
  });
  it("settles valid and terminal-invalid claims atomically with cross-entity ownership guards", () => {
    expect(migration).toContain("create or replace function public.settle_wikidata_artist_inventory_batch(");
    expect(migration).toContain("num_nonnulls(source_record.exhibition_id, source_record.venue_id, source_record.work_id) > 0");
    expect(migration).toContain("perform public.invalidate_artist_discovery_inventory_candidate");
  });
});
