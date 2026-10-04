import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { assertHttpUrl, nullableText, validUuid } from "@/lib/admin/http";
import { isMasterEntity, MASTER_CONFIGS } from "@/lib/admin/master-config";
import { signedMediaAsset } from "@/lib/admin/media-asset-response";
import { shouldSetManualMediaPrimary } from "@/lib/admin/media-asset-state";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

const ALLOWED_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);
const MAX_BYTES = 20 * 1024 * 1024;

export async function POST(request: Request, { params }: { params: Promise<{ entity: string; id: string }> }) {
  let uploadedPath: string | null = null;
  try {
    const { entity, id } = await params;
    if (!isMasterEntity(entity) || !validUuid(id)) throw new Error("Invalid master");
    const config = MASTER_CONFIGS[entity]; const form = await request.formData(); const file = form.get("file");
    if (!(file instanceof File) || !file.size) throw new Error("Image fileは必須です。");
    if (!ALLOWED_TYPES.has(file.type) || file.size > MAX_BYTES) throw new Error("JPEG / PNG / WebP / GIF（20MB以下）のみ対応です。");
    const sourceType = nullableText(form.get("source_type")); if (!sourceType) throw new Error("Source typeは必須です。");
    const rightsStatus = nullableText(form.get("rights_status"));
    if (!rightsStatus || !["approved", "rejected", "needs_review"].includes(rightsStatus)) throw new Error("Rights classificationは必須です。");
    const sourceUrl = nullableText(form.get("source_url")); assertHttpUrl(sourceUrl, "Source URL");
    const extension = file.name.split(".").pop()?.toLowerCase().replace(/[^a-z0-9]/g, "") || "bin";
    uploadedPath = `${entity}/${id}/${randomUUID()}.${extension}`;
    const db = createSupabaseAdminClient();
    const { count: registeredCount, error: countError } = await db.from("media_assets").select("id", { count: "exact", head: true }).eq(config.ownerKey, id);
    if (countError) throw countError;
    const { error: uploadError } = await db.storage.from("exhibition-images").upload(uploadedPath, file, { contentType: file.type, upsert: false });
    if (uploadError) throw uploadError;
    const primary = shouldSetManualMediaPrimary(registeredCount);
    const ownership = { exhibition_id: null, venue_id: null, artist_id: null, work_id: null, [config.ownerKey]: id };
    const { data: inserted, error } = await db.from("media_assets").insert({ ...ownership, kind: "image", storage_path: uploadedPath, original_filename: file.name, source_type: sourceType, source_url: sourceUrl, credit: nullableText(form.get("credit")), usage_note: nullableText(form.get("usage_note")), rights_status: rightsStatus, rights_checked_at: new Date().toISOString(), valid_until: nullableText(form.get("valid_until")), is_primary: primary }).select("id").single();
    if (error || !inserted) throw error || new Error("画像を保存できませんでした。");
    const asset = await signedMediaAsset(db, inserted.id);
    revalidatePath(`/admin/${entity}`); revalidatePath(`/admin/${entity}/${id}`);
    return NextResponse.json({ message: `${config.label}画像を保存しました。`, asset });
  } catch (error) {
    if (uploadedPath) { try { await createSupabaseAdminClient().storage.from("exhibition-images").remove([uploadedPath]); } catch {} }
    return NextResponse.json({ error: error instanceof Error ? error.message : "Upload failed" }, { status: 400 });
  }
}
