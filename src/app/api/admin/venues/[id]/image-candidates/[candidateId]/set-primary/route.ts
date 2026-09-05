import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { assertCandidateImageUrl, downloadCandidateImage } from "@/lib/admin/candidate-image";
import { validUuid } from "@/lib/admin/http";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export async function POST(_request: Request, { params }: { params: Promise<{ id: string; candidateId: string }> }) {
  let uploadedPath: string | null = null;
  let insertedAssetId: string | null = null;
  try {
    const { id, candidateId } = await params;
    if (!validUuid(id) || !validUuid(candidateId)) throw new Error("Invalid ID");

    const db = createSupabaseAdminClient();
    const { data: sources, error: sourceError } = await db.from("source_records").select("id").eq("venue_id", id);
    if (sourceError) throw sourceError;
    const sourceIds = (sources || []).map((source) => source.id);
    if (!sourceIds.length) throw new Error("画像Candidateが見つかりません。");

    const { data: candidate, error: candidateError } = await db
      .from("source_image_candidates")
      .select("*")
      .eq("id", candidateId)
      .in("source_record_id", sourceIds)
      .single();
    if (candidateError || !candidate) throw candidateError || new Error("画像Candidateが見つかりません。");
    if (!candidate.is_active || candidate.review_status === "rejected") throw new Error("除外された候補は画像に設定できません。");
    if (candidate.rights_status === "rejected") throw new Error("明確に利用不可と記録された候補は画像に設定できません。");

    const canonicalSourceUrl = candidate.source_url || candidate.image_url;
    const { data: existingAsset, error: existingError } = await db
      .from("media_assets")
      .select("id")
      .eq("venue_id", id)
      .eq("source_url", canonicalSourceUrl)
      .maybeSingle();
    if (existingError) throw existingError;

    if (existingAsset) {
      const { error: clearError } = await db.from("media_assets").update({ is_primary: false }).eq("venue_id", id).eq("is_primary", true).neq("id", existingAsset.id);
      if (clearError) throw clearError;
      const { error: primaryError } = await db.from("media_assets").update({ is_primary: true }).eq("id", existingAsset.id).eq("venue_id", id);
      if (primaryError) throw primaryError;
    } else {
      const imageUrl = assertCandidateImageUrl(candidate.thumbnail_url || candidate.image_url, candidate.provider);
      const { bytes, contentType, extension } = await downloadCandidateImage(imageUrl);

      uploadedPath = `venues/${id}/${randomUUID()}.${extension}`;
      const { error: uploadError } = await db.storage.from("exhibition-images").upload(uploadedPath, bytes, { contentType, upsert: false });
      if (uploadError) throw uploadError;

      const { data: inserted, error: insertError } = await db.from("media_assets").insert({
        venue_id: id,
        exhibition_id: null,
        artist_id: null,
        work_id: null,
        kind: "image",
        storage_path: uploadedPath,
        original_filename: candidate.stable_identifier || `candidate-${candidate.id}.${extension}`,
        source_type: candidate.provider === "wikimedia_commons" ? "wikimedia" : "other",
        source_url: canonicalSourceUrl,
        credit: candidate.credit,
        usage_note: candidate.usage_terms,
        reported_license: candidate.license_short_name,
        reported_license_url: candidate.license_url,
        reported_author: candidate.author,
        reported_usage_terms: candidate.usage_terms,
        rights_status: candidate.rights_status,
        rights_checked_at: candidate.rights_status === "approved" ? new Date().toISOString() : null,
        is_primary: false,
      }).select("id").single();
      if (insertError || !inserted) throw insertError || new Error("候補画像を保存できませんでした。");
      insertedAssetId = inserted.id;

      const { error: clearError } = await db.from("media_assets").update({ is_primary: false }).eq("venue_id", id).eq("is_primary", true);
      if (clearError) throw clearError;
      const { error: primaryError } = await db.from("media_assets").update({ is_primary: true }).eq("id", inserted.id).eq("venue_id", id);
      if (primaryError) throw primaryError;
    }

    const [{ error: reviewError }, { error: venueError }] = await Promise.all([
      db.from("source_image_candidates").update({ review_status: "accepted" }).eq("id", candidateId),
      db.from("venues").update({ image_search_status: "approved_image_exists" }).eq("id", id),
    ]);
    if (reviewError) throw reviewError;
    if (venueError) throw venueError;

    revalidatePath("/admin/venues");
    revalidatePath(`/admin/venues/${id}`);
    return NextResponse.json({ message: "候補画像をPrimary画像に設定しました。" });
  } catch (error) {
    if (insertedAssetId) await createSupabaseAdminClient().from("media_assets").delete().eq("id", insertedAssetId);
    if (uploadedPath) await createSupabaseAdminClient().storage.from("exhibition-images").remove([uploadedPath]);
    return NextResponse.json({ error: error instanceof Error ? error.message : "候補画像の設定に失敗しました。" }, { status: 400 });
  }
}
