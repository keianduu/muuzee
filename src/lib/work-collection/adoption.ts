import type { SupabaseClient } from "@supabase/supabase-js";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { hasWorkTitle } from "@/lib/work-title";

export function hasWorkCandidateCore(candidate: { title?: string | null; title_ja?: string | null; title_en?: string | null; title_original?: string | null; artist_id?: string | null; matched_venue_id?: string | null }) {
  return Boolean(hasWorkTitle(candidate) && candidate.artist_id && candidate.matched_venue_id);
}

type WorkCandidateAdoptionState = Parameters<typeof hasWorkCandidateCore>[0] & {
  match_status?: string | null;
  source_venue_name?: string | null;
};

export function workCandidateAdoptionReasons(candidate: WorkCandidateAdoptionState) {
  const reasons: string[] = [];
  if (candidate.match_status === "imported") reasons.push("採用済み");
  if (!hasWorkTitle(candidate)) reasons.push("作品名が登録されていません");
  if (!candidate.artist_id) reasons.push("アーティスト情報と紐づいていません");
  if (!candidate.matched_venue_id) {
    if (candidate.match_status === "ambiguous") reasons.push("所蔵先に一致する会場候補が複数あります");
    else if (!candidate.source_venue_name) reasons.push("所蔵先情報が登録されていません");
    else reasons.push("所蔵先と会場情報を紐づけられていません");
  }
  return reasons;
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
