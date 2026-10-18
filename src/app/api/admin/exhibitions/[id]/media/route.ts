import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { assertHttpUrl, nullableText, validUuid } from "@/lib/admin/http";
import { assertCandidateImageUrl, downloadCandidateImage } from "@/lib/admin/candidate-image";
import { signedMediaAsset } from "@/lib/admin/media-asset-response";
import { shouldSetManualMediaPrimary } from "@/lib/admin/media-asset-state";
import { assertManualImageRightsConfirmed } from "@/lib/admin/primary-image-policy";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

const ALLOWED = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]); const MAX_BYTES = 20 * 1024 * 1024;

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  let uploadedPath: string | null = null;
  try {
    const { id } = await params; if (!validUuid(id)) throw new Error("Invalid exhibition ID"); const form = await request.formData();
    const fileValue = form.get("file"); const file = fileValue instanceof File && fileValue.size ? fileValue : null; const imageUrlValue = nullableText(form.get("image_url")); if (!file && !imageUrlValue) throw new Error("画像ファイルまたは画像URLを指定してください。");
    let uploadBody: File | Buffer; let contentType: string; let extension: string; let originalFilename: string;
    if (file) { if (!ALLOWED.has(file.type) || file.size > MAX_BYTES) throw new Error("JPEG / PNG / WebP / GIF（20MB以下）のみ対応です。"); uploadBody = file; contentType = file.type; extension = file.name.split(".").pop()?.toLowerCase().replace(/[^a-z0-9]/g, "") || "bin"; originalFilename = file.name; }
    else { const imageUrl = assertCandidateImageUrl(imageUrlValue!, null); const downloaded = await downloadCandidateImage(imageUrl, 30_000); uploadBody = downloaded.bytes; contentType = downloaded.contentType; extension = downloaded.extension; originalFilename = decodeURIComponent(imageUrl.pathname.split("/").pop() || `remote-image.${extension}`).slice(0, 255); }
    const sourceUrl = nullableText(form.get("source_url")) || (!file ? imageUrlValue : null); assertHttpUrl(sourceUrl, "Source URL"); const usageNote = nullableText(form.get("usage_note"));
    const rightsStatus = assertManualImageRightsConfirmed(form.get("rights_confirmed"));
    const sourceType = nullableText(form.get("source_type")); if (!sourceType) throw new Error("Source typeは必須です。");
    uploadedPath = `${id}/${randomUUID()}.${extension}`; const db = createSupabaseAdminClient();
    const { count: registeredCount, error: countError } = await db.from("media_assets").select("id", { count: "exact", head: true }).eq("exhibition_id", id); if (countError) throw countError;
    const { error: uploadError } = await db.storage.from("exhibition-images").upload(uploadedPath, uploadBody, { contentType, upsert: false }); if (uploadError) throw uploadError;
    const primary = shouldSetManualMediaPrimary(registeredCount);
    const { data: inserted, error: insertError } = await db.from("media_assets").insert({ exhibition_id: id, storage_path: uploadedPath, original_filename: originalFilename, source_type: sourceType, source_url: sourceUrl, credit: nullableText(form.get("credit")), usage_note: usageNote, rights_status: rightsStatus, rights_checked_at: new Date().toISOString(), valid_until: nullableText(form.get("valid_until")), is_primary: primary }).select("id").single(); if (insertError || !inserted) throw insertError || new Error("画像を保存できませんでした。");
    const asset = await signedMediaAsset(db, inserted.id);
    revalidatePath("/admin"); revalidatePath("/admin/exhibitions"); revalidatePath(`/admin/exhibitions/${id}`); return NextResponse.json({ message: "画像とRights情報を保存しました。", asset });
  } catch (error) {
    if (uploadedPath) { try { await createSupabaseAdminClient().storage.from("exhibition-images").remove([uploadedPath]); } catch {} }
    return NextResponse.json({ error: error instanceof Error ? error.message : "Upload failed" }, { status: 400 });
  }
}
