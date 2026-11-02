import type { SupabaseClient } from "@supabase/supabase-js";

export const HOSTED_VENUE_INVENTORY_BATCH_SIZE = 5;

export type VenueDiscoveryInventoryCandidate = {
  id: string;
  external_id: string;
  discovery_root_ids: string[];
  attempt_count: number;
};

function sanitizedError(error: unknown, fallback: string) {
  const message = error instanceof Error
    ? error.message
    : typeof error === "string"
      ? error
      : error && typeof error === "object" && "message" in error && typeof error.message === "string"
        ? error.message
        : fallback;
  return message.replace(/[\r\n\t]+/g, " ").slice(0, 500);
}

function rpcError(error: unknown, fallback: string) {
  if (error) throw new Error(sanitizedError(error, fallback));
}

export async function claimVenueDiscoveryInventory(
  db: SupabaseClient,
  input: { dataSourceId: string; runId: string; limit: number },
) {
  const { data, error } = await db.rpc("claim_venue_discovery_inventory", {
    p_data_source_id: input.dataSourceId,
    p_run_id: input.runId,
    p_limit: Math.min(HOSTED_VENUE_INVENTORY_BATCH_SIZE, Math.max(1, Math.floor(input.limit))),
    p_lease_seconds: 300,
  });
  rpcError(error, "Venue Discovery Inventory claim failed");
  return (data || []) as VenueDiscoveryInventoryCandidate[];
}

export async function processVenueDiscoveryInventoryCandidate(
  db: SupabaseClient,
  input: { inventoryId: string; runId: string; linkedVenueId: string | null },
) {
  const { error } = await db.rpc("process_venue_discovery_inventory_candidate", {
    p_inventory_id: input.inventoryId,
    p_run_id: input.runId,
    p_linked_venue_id: input.linkedVenueId,
  });
  rpcError(error, "Venue Discovery Inventory settlement failed");
}

export async function invalidateVenueDiscoveryInventoryCandidate(
  db: SupabaseClient,
  input: { inventoryId: string; runId: string; reason: string },
) {
  const { error } = await db.rpc("invalidate_venue_discovery_inventory_candidate", {
    p_inventory_id: input.inventoryId,
    p_run_id: input.runId,
    p_reason: sanitizedError(input.reason, "Candidate is not a valid Japan Venue"),
  });
  rpcError(error, "Venue Discovery Inventory invalid settlement failed");
}

export async function retryVenueDiscoveryInventoryCandidate(
  db: SupabaseClient,
  input: { inventoryId: string; runId: string; error: unknown },
) {
  const { error } = await db.rpc("retry_venue_discovery_inventory_candidate", {
    p_inventory_id: input.inventoryId,
    p_run_id: input.runId,
    p_error: sanitizedError(input.error, "Transient inventory processing failure"),
  });
  rpcError(error, "Venue Discovery Inventory retry settlement failed");
}

export async function releaseVenueDiscoveryInventoryClaims(
  db: SupabaseClient,
  input: { runId: string; error: unknown },
) {
  const { data, error } = await db.rpc("release_venue_discovery_inventory_claims", {
    p_run_id: input.runId,
    p_error: sanitizedError(input.error, "Controlled importer interruption"),
  });
  rpcError(error, "Venue Discovery Inventory release failed");
  return Number(data || 0);
}
