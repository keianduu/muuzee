import type { SupabaseClient } from "@supabase/supabase-js";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export function hasWorkCandidateCore(candidate: { title?: string | null; artist_id?: string | null; matched_venue_id?: string | null }) {
  return Boolean(candidate.title?.trim() && candidate.artist_id && candidate.matched_venue_id);
}

export async function adoptWorkCandidates(candidateIds: string[], db: SupabaseClient = createSupabaseAdminClient()) {
  const results = [];
  for (const candidateId of [...new Set(candidateIds)]) {
    const { data, error } = await db.rpc("adopt_work_candidate", { p_candidate_id: candidateId });
    if (error) throw error;
    results.push(data);
  }
  return results;
}
