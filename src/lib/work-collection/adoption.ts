import type { SupabaseClient } from "@supabase/supabase-js";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { hasWorkTitle } from "@/lib/work-title";

export function hasWorkCandidateCore(candidate: { title?: string | null; title_ja?: string | null; title_en?: string | null; title_original?: string | null; artist_id?: string | null; matched_venue_id?: string | null }) {
  return Boolean(hasWorkTitle(candidate) && candidate.artist_id && candidate.matched_venue_id);
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
