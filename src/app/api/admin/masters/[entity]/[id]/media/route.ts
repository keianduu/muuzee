import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { assertHttpUrl, nullableText, validUuid } from "@/lib/admin/http";
import { isMasterEntity, MASTER_CONFIGS } from "@/lib/admin/master-config";
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
    const { error: uploadError } = await db.storage.from("exhibition-images").upload(uploadedPath, file, { contentType: file.type, upsert: false });
    if (uploadError) throw uploadError;
    const primary = form.get("is_primary") === "true";
    if (primary) { const { error } = await db.from("media_assets").update({ is_primary: false }).eq(config.ownerKey, id).eq("is_primary", true); if (error) throw error; }
    const ownership = { exhibition_id: null, venue_id: null, artist_id: null, work_id: null, [config.ownerKey]: id };
    const { error } = await db.from("media_assets").insert({ ...ownership, kind: "image", storage_path: uploadedPath, original_filename: file.name, source_type: sourceType, source_url: sourceUrl, credit: nullableText(form.get("credit")), usage_note: nullableText(form.get("usage_note")), rights_status: rightsStatus, rights_checked_at: new Date().toISOString(), valid_until: nullableText(form.get("valid_until")), is_primary: primary });
    if (error) throw error;
    revalidatePath(`/admin/${entity}`); revalidatePath(`/admin/${entity}/${id}`);
    return NextResponse.json({ message: `${config.label}画像を保存しました。` });
  } catch (error) {
    if (uploadedPath) { try { await createSupabaseAdminClient().storage.from("exhibition-images").remove([uploadedPath]); } catch {} }
    return NextResponse.json({ error: error instanceof Error ? error.message : "Upload failed" }, { status: 400 });
  }
}
