import type { SupabaseClient } from "@supabase/supabase-js";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
export { hasWorkCandidateCore, workCandidateAdoptionReasons } from "./adoption-policy";

export async function adoptWorkCandidates(candidateIds: string[], db: SupabaseClient = createSupabaseAdminClient()) {
  const results = [];
  for (const candidateId of [...new Set(candidateIds)]) {
    const { data, error } = await db.rpc("adopt_work_candidate", { p_candidate_id: candidateId });
    if (error) throw error;
    results.push(data);
  }
  return results;
}
