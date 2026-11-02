import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it, vi } from "vitest";
import {
  claimVenueDiscoveryInventory,
  invalidateVenueDiscoveryInventoryCandidate,
  processVenueDiscoveryInventoryCandidate,
  releaseVenueDiscoveryInventoryClaims,
  retryVenueDiscoveryInventoryCandidate,
} from "./venue-discovery-inventory";

function rpcDb(result: { data?: unknown; error?: unknown } = {}) {
  const rpc = vi.fn().mockResolvedValue({ data: result.data ?? null, error: result.error ?? null });
  return { db: { rpc } as unknown as SupabaseClient, rpc };
}

describe("Venue Discovery Inventory repository", () => {
  it("enforces the hosted claim bound at the server repository boundary", async () => {
    const { db, rpc } = rpcDb({ data: [] });
    await claimVenueDiscoveryInventory(db, { dataSourceId: "source", runId: "run", limit: 99 });
    expect(rpc).toHaveBeenCalledWith("claim_venue_discovery_inventory", expect.objectContaining({ p_limit: 5 }));
  });

  it("maps processed, invalid, retry, and controlled release to ownership-aware RPCs", async () => {
    const { db, rpc } = rpcDb({ data: 2 });

    await processVenueDiscoveryInventoryCandidate(db, { inventoryId: "item", runId: "run", linkedVenueId: "venue" });
    await invalidateVenueDiscoveryInventoryCandidate(db, { inventoryId: "item", runId: "run", reason: "invalid\nentity" });
    await retryVenueDiscoveryInventoryCandidate(db, { inventoryId: "item", runId: "run", error: new Error("temporary\nprovider error") });
    await expect(releaseVenueDiscoveryInventoryClaims(db, { runId: "run", error: "controlled\nstop" })).resolves.toBe(2);

    expect(rpc).toHaveBeenNthCalledWith(1, "process_venue_discovery_inventory_candidate", {
      p_inventory_id: "item", p_run_id: "run", p_linked_venue_id: "venue",
    });
    expect(rpc).toHaveBeenNthCalledWith(2, "invalidate_venue_discovery_inventory_candidate", {
      p_inventory_id: "item", p_run_id: "run", p_reason: "invalid entity",
    });
    expect(rpc).toHaveBeenNthCalledWith(3, "retry_venue_discovery_inventory_candidate", {
      p_inventory_id: "item", p_run_id: "run", p_error: "temporary provider error",
    });
    expect(rpc).toHaveBeenNthCalledWith(4, "release_venue_discovery_inventory_claims", {
      p_run_id: "run", p_error: "controlled stop",
    });
  });

  it("fails closed when the DB rejects stale claim ownership", async () => {
    const { db } = rpcDb({ error: { message: "Inventory claim ownership mismatch" } });
    await expect(processVenueDiscoveryInventoryCandidate(db, {
      inventoryId: "item", runId: "stale-run", linkedVenueId: null,
    })).rejects.toThrow("Inventory claim ownership mismatch");
  });
});
