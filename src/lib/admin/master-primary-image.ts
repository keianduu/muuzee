import { randomUUID } from "node:crypto";
import { assertCandidateImageUrl, downloadCandidateImage } from "./candidate-image";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { MASTER_CONFIGS, type MasterEntity } from "./master-config";
import { chooseAutoPrimaryCandidate, isPrimaryCandidateUsable, mediaAssetMetadataFromCandidate } from "./primary-image-policy";

export async function setMasterPrimaryFromCandidate(entity: MasterEntity, masterId: string, candidateId: string, options: { replaceExisting?: boolean } = {}) {
  const db = createSupabaseAdminClient(); const config = MASTER_CONFIGS[entity]; const owner = config.ownerKey;
  const { data: current, error: currentError } = await db.from("media_assets").select("id").eq(owner, masterId).eq("is_primary", true).maybeSingle();
  if (currentError) throw currentError; if (current && !options.replaceExisting) return { changed: false, reason: "primary_exists" as const };
  const { data: sources, error: sourceError } = await db.from("source_records").select("id").eq(owner, masterId); if (sourceError) throw sourceError;
  const sourceIds = (sources || []).map((row) => row.id); if (!sourceIds.length) throw new Error("画像Candidateが見つかりません。");
  const { data: candidate, error: candidateError } = await db.from("source_image_candidates").select("*").eq("id", candidateId).in("source_record_id", sourceIds).single();
  if (candidateError || !candidate) throw candidateError || new Error("画像Candidateが見つかりません。");
  if (!isPrimaryCandidateUsable(candidate)) throw new Error("利用できない候補です。");
  const sourceUrl = candidate.source_url || candidate.image_url;
  const { data: existing } = await db.from("media_assets").select("id").eq(owner, masterId).eq("source_url", sourceUrl).maybeSingle();
  let assetId = existing?.id as string | undefined; let storagePath: string | null = null;
  if (!assetId) {
    const url = assertCandidateImageUrl(candidate.thumbnail_url || candidate.image_url, candidate.provider);
    const { bytes, contentType, extension } = await downloadCandidateImage(url); storagePath = `${entity}/${masterId}/${randomUUID()}.${extension}`;
    const { error: uploadError } = await db.storage.from("exhibition-images").upload(storagePath, bytes, { contentType }); if (uploadError) throw uploadError;
    const owners = { exhibition_id: null, venue_id: null, artist_id: null, work_id: null, [owner]: masterId };
    const { data: asset, error } = await db.from("media_assets").insert({ ...owners, kind: "image", storage_path: storagePath, original_filename: candidate.stable_identifier || `candidate-${candidate.id}.${extension}`, ...mediaAssetMetadataFromCandidate(candidate), is_primary: false }).select("id").single();
    if (error || !asset) { await db.storage.from("exhibition-images").remove([storagePath]); throw error || new Error("候補画像を保存できませんでした。"); } assetId = asset.id;
  }
  if (options.replaceExisting) await db.from("media_assets").update({ is_primary: false }).eq(owner, masterId).eq("is_primary", true).neq("id", assetId);
  const { error } = await db.from("media_assets").update({ is_primary: true }).eq("id", assetId).eq(owner, masterId); if (error) throw error;
  await db.from("source_image_candidates").update({ review_status: "accepted" }).eq("id", candidateId);
  return { changed: true, reason: "primary_set" as const, assetId };
}

export async function autoSetPreferredMasterCandidatePrimary(entity: MasterEntity, masterId: string) {
  const db = createSupabaseAdminClient(); const owner = MASTER_CONFIGS[entity].ownerKey;
  const [{ data: primary }, { data: sources }] = await Promise.all([db.from("media_assets").select("id").eq(owner, masterId).eq("is_primary", true).limit(1), db.from("source_records").select("id").eq(owner, masterId)]);
  if (primary?.length) return { changed: false, reason: "primary_exists" as const };
  const ids = (sources || []).map((row) => row.id); if (!ids.length) return { changed: false, reason: "no_candidates" as const };
  const { data, error } = await db.from("source_image_candidates").select("id,discovery_source,is_active,review_status,rights_status").in("source_record_id", ids).order("created_at", { ascending: true });
  if (error) throw error;
  const decision = chooseAutoPrimaryCandidate({ primaryCount: 0, candidates: data || [] });
  return decision.candidateId
    ? setMasterPrimaryFromCandidate(entity, masterId, decision.candidateId)
    : { changed: false, reason: decision.reason };
}

// Compatibility alias for callers created before P18 became the preferred representative image.
export const autoSetSingleMasterCandidatePrimary = autoSetPreferredMasterCandidatePrimary;

export function shouldAutoSetMasterPrimary(input: { primaryCount: number; activeCandidateCount: number }) {
  return input.primaryCount === 0 && input.activeCandidateCount === 1;
}

export function isMasterCandidateUsable(candidate: { is_active?: boolean; review_status?: string | null; rights_status?: string | null }) {
  return isPrimaryCandidateUsable({ id: "candidate", ...candidate });
}

export async function masterAutoPrimaryMaintenance(entity: MasterEntity, options: { apply?: boolean; tiers?: string[]; limit?: number } = {}) {
  const db = createSupabaseAdminClient();
  const config = MASTER_CONFIGS[entity];
  const relation = `source_records!source_records_${config.ownerKey}_fkey(id,source_image_candidates(id,discovery_source,is_active,review_status,rights_status))`;
  let query = db.from(entity).select(`id,${config.titleKey},effective_priority_tier,media_assets(id,is_primary),${relation}`).order("effective_priority_tier").order(config.titleKey);
  if (options.tiers?.length) query = query.in("effective_priority_tier", options.tiers);
  if (entity === "venues") query = query.is("merged_into_venue_id", null);
  const { data, error } = await query;
  if (error) throw error;

  const evaluated = (data || []).map((row) => {
    const record = row as unknown as Record<string, unknown>;
    const sources = (record.source_records || []) as Array<{ source_image_candidates?: Array<Record<string, unknown>> }>;
    const candidates = sources.flatMap((source) => source.source_image_candidates || []) as Array<{ id: string; discovery_source?: string | null; is_active?: boolean | null; review_status?: string | null; rights_status?: string | null }>;
    const primaryCount = ((record.media_assets || []) as Array<{ is_primary?: boolean }>).filter((asset) => asset.is_primary).length;
    return { id: String(record.id), decision: chooseAutoPrimaryCandidate({ primaryCount, candidates }) };
  });
  const eligible = evaluated.filter((row) => row.decision.candidateId);
  const limit = Math.max(1, Math.min(5000, options.limit || eligible.length || 1));
  const selected = eligible.slice(0, limit);
  let applied = 0;
  const reasons = { wikidata_p18: 0, single_candidate: 0 };
  const errors: Array<{ masterId: string; message: string }> = [];
  if (options.apply) {
    for (const row of selected) {
      try {
        const result = await setMasterPrimaryFromCandidate(entity, row.id, row.decision.candidateId!);
        if (result.changed) {
          applied += 1;
          reasons[row.decision.reason as keyof typeof reasons] += 1;
        }
      } catch (caught) {
        errors.push({ masterId: row.id, message: caught instanceof Error ? caught.message : "Auto primary failed" });
      }
    }
  }
  return {
    dryRun: !options.apply,
    targetCount: eligible.length,
    selectedCount: selected.length,
    p18TargetCount: eligible.filter((row) => row.decision.reason === "wikidata_p18").length,
    singleCandidateTargetCount: eligible.filter((row) => row.decision.reason === "single_candidate").length,
    applied,
    appliedByReason: reasons,
    errors,
  };
}
