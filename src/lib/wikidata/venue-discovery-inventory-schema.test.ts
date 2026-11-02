import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  join(process.cwd(), "supabase/migrations/202611020001_venue_discovery_inventory.sql"),
  "utf8",
);

describe("Venue Discovery Inventory schema", () => {
  it("keeps the inventory server-only with explicit service_role access", () => {
    expect(migration).toContain("alter table public.venue_discovery_inventory enable row level security");
    expect(migration).toContain("revoke all on table public.venue_discovery_inventory from public, anon, authenticated");
    expect(migration).toContain("grant select, insert, update, delete on table public.venue_discovery_inventory to service_role");
    expect(migration).not.toMatch(/create policy[\s\S]+venue_discovery_inventory/i);
  });

  it("bootstraps linked Wikidata records idempotently as active processed inventory", () => {
    expect(migration).toContain("create or replace function public.bootstrap_venue_discovery_inventory()");
    expect(migration).toContain("and ds.key = 'wikidata'");
    expect(migration).toContain("where sr.venue_id is not null");
    expect(migration).toContain("on conflict (data_source_id, external_id) do update");
    expect(migration).toContain("state = 'processed'");
    expect(migration).toContain("linked_venue_id = excluded.linked_venue_id");
  });

  it("claims retry-due or expired work atomically without overlapping workers", () => {
    expect(migration).toContain("create or replace function public.claim_venue_discovery_inventory(");
    expect(migration).toContain("for update skip locked");
    expect(migration).toContain("inventory.next_attempt_at <= effective_now");
    expect(migration).toContain("inventory.lease_expires_at <= effective_now");
    expect(migration).toContain("state = 'processing'");
    expect(migration).toContain("claimed_run_id = p_run_id");
    expect(migration).toContain("attempt_count = inventory.attempt_count + 1");
  });

  it("only reconciles inactive and invalid rows when a complete generation is finalized", () => {
    expect(migration).toContain("create or replace function public.complete_venue_discovery_inventory_generation(");
    expect(migration).toContain("last_seen_generation_id is distinct from p_generation_id");
    expect(migration).toContain("and state = 'invalid'");
    expect(migration).toContain("'inventoryComplete', true");
  });
});
