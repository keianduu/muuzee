import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  join(process.cwd(), "supabase/migrations/202611020002_venue_discovery_inventory_consumer.sql"),
  "utf8",
);

describe("Venue Discovery Inventory consumer schema", () => {
  it("keeps every lifecycle primitive service_role-only", () => {
    for (const name of [
      "process_venue_discovery_inventory_candidate",
      "invalidate_venue_discovery_inventory_candidate",
      "retry_venue_discovery_inventory_candidate",
      "release_venue_discovery_inventory_claims",
    ]) {
      expect(migration).toContain(`revoke all on function public.${name}`);
      expect(migration).toMatch(new RegExp(`grant execute on function public\\.${name}[^;]+to service_role`, "s"));
    }
  });

  it("settles processed and invalid candidates only for the current claim owner", () => {
    expect(migration).toContain("state = 'processed'");
    expect(migration).toContain("state = 'invalid'");
    expect(migration.match(/inventory\.state = 'processing'/g)).toHaveLength(4);
    expect(migration.match(/inventory\.claimed_run_id = p_run_id/g)).toHaveLength(4);
    expect(migration).toContain("raise exception 'Inventory claim ownership mismatch'");
    expect(migration).toContain("linked_venue_id = p_linked_venue_id");
  });

  it("returns transient and unfinished claims to pending with bounded retry", () => {
    expect(migration.match(/state = 'pending'/g)).toHaveLength(2);
    expect(migration).toContain("when inventory.attempt_count <= 1 then interval '1 minute'");
    expect(migration).toContain("when inventory.attempt_count = 2 then interval '5 minutes'");
    expect(migration).toContain("else interval '60 minutes'");
    expect(migration).toContain("where inventory.state = 'processing'");
    expect(migration).toContain("and inventory.claimed_run_id = p_run_id");
  });
});
