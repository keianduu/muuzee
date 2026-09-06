import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { autoSetPreferredMasterCandidatePrimary, masterAutoPrimaryMaintenance, setMasterPrimaryFromCandidate } from "./master-primary-image";

export async function setVenuePrimaryFromCandidate(venueId: string, candidateId: string, options: { replaceExisting?: boolean } = {}) {
  const db = createSupabaseAdminClient();
  const result = await setMasterPrimaryFromCandidate("venues", venueId, candidateId, options);
  if (result.changed) {
    const { error } = await db.from("venues").update({ image_search_status: "approved_image_exists" }).eq("id", venueId);
    if (error) throw error;
  }
  return result;
}

export async function autoSetPreferredVenueCandidatePrimary(venueId: string) {
  const result = await autoSetPreferredMasterCandidatePrimary("venues", venueId);
  if (result.changed) await createSupabaseAdminClient().from("venues").update({ image_search_status: "approved_image_exists" }).eq("id", venueId);
  return result;
}

export const autoSetSingleVenueCandidatePrimary = autoSetPreferredVenueCandidatePrimary;

export async function venueAutoPrimaryMaintenance(options: { apply?: boolean; limit?: number } = {}) {
  const result = await masterAutoPrimaryMaintenance("venues", { ...options, tiers: ["A", "B", "C"] });
  if (options.apply && result.applied) {
    const db = createSupabaseAdminClient();
    const { data } = await db.from("venues").select("id,media_assets(id,is_primary)").in("effective_priority_tier", ["A", "B", "C"]);
    const ids = (data || []).filter((venue) => venue.media_assets?.some((asset) => asset.is_primary)).map((venue) => venue.id);
    if (ids.length) await db.from("venues").update({ image_search_status: "approved_image_exists" }).in("id", ids);
  }
  return result;
}
