import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  join(process.cwd(), "supabase/migrations/202611280001_artist_discovery_inventory.sql"),
  "utf8",
);

describe("Artist Discovery Inventory schema", () => {
  it("keeps inventory and indexed identity keys server-only", () => {
    expect(migration).toContain("alter table public.artist_discovery_inventory enable row level security");
    expect(migration).toContain("alter table public.artist_search_keys enable row level security");
    expect(migration).toContain("revoke all on table public.artist_discovery_inventory from public, anon, authenticated");
    expect(migration).toContain("grant select, insert, update, delete on table public.artist_discovery_inventory to service_role");
    expect(migration).not.toMatch(/create policy[\s\S]+artist_discovery_inventory/i);
  });

  it("uses indexed collision keys without authorizing name or alias auto-linking", () => {
    expect(migration).toContain("create index artist_search_keys_lookup_idx");
    expect(migration).toContain("from public.artist_search_keys search_key");
    expect(migration).toContain("state = 'review'");
    expect(migration).toContain("no automatic cross-QID link");
    expect(migration).not.toMatch(/linked_artist_id = candidate_id/);
  });

  it("claims bounded work with leases and retry backoff", () => {
    expect(migration).toContain("create or replace function public.claim_artist_discovery_inventory(");
    expect(migration).toContain("for update skip locked");
    expect(migration).toContain("inventory.lease_expires_at <= effective_now");
    expect(migration).toContain("limit least(greatest(coalesce(p_limit, 50), 1), 100)");
    expect(migration).toContain("when inventory.attempt_count = 2 then interval '5 minutes'");
  });

  it("validates an entire batch before atomic canonical/source/provenance settlement", () => {
    expect(migration).toContain("create or replace function public.apply_wikidata_artist_inventory_batch(");
    expect(migration).toContain("Validate every claim and provider envelope before performing the first");
    expect(migration).toContain("normalized_payload ->> 'qid' is distinct from qid");
    expect(migration).toContain("insert into public.artist_field_sources");
    expect(migration).toContain("'imageDiscoveryExecuted', false");
  });

  it("requires complete generation evidence before inactivation", () => {
    expect(migration).toContain("p_metrics -> 'roots' is distinct from '[\"Q3391743\"]'::jsonb");
    expect(migration).toContain("p_metrics -> 'completedRoots' is distinct from '[\"Q3391743\"]'::jsonb");
    expect(migration).toContain("p_metrics ->> 'rootIndex' is distinct from '1'");
  });
});
