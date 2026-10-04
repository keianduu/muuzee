import { randomUUID } from "node:crypto";
import { extname } from "node:path";
import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { assertHttpUrl, nullableText, validUuid } from "@/lib/admin/http";
import { signedMediaAsset } from "@/lib/admin/media-asset-response";
import { shouldSetManualMediaPrimary } from "@/lib/admin/media-asset-state";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

const ALLOWED = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]); const MAX_BYTES = 20 * 1024 * 1024;

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  let uploadedPath: string | null = null;
  try {
    const { id } = await params; if (!validUuid(id)) throw new Error("Invalid exhibition ID"); const form = await request.formData(); const file = form.get("file"); if (!(file instanceof File)) throw new Error("画像ファイルが必要です。"); if (!ALLOWED.has(file.type)) throw new Error("JPEG / PNG / WebP / GIFのみ対応しています。"); if (file.size > MAX_BYTES) throw new Error("画像は20 MB以下にしてください。");
    const sourceUrl = nullableText(form.get("source_url")); assertHttpUrl(sourceUrl, "Source URL"); const usageNote = nullableText(form.get("usage_note"));
    const rightsStatus = nullableText(form.get("rights_status")); if (!rightsStatus || !["approved", "rejected", "needs_review"].includes(rightsStatus)) throw new Error("Rights classificationは必須です。");
    const sourceType = nullableText(form.get("source_type")); if (!sourceType) throw new Error("Source typeは必須です。");
    const suffix = extname(file.name).toLowerCase() || `.${file.type.split("/")[1]}`; uploadedPath = `${id}/${randomUUID()}${suffix}`; const db = createSupabaseAdminClient();
    const { count: registeredCount, error: countError } = await db.from("media_assets").select("id", { count: "exact", head: true }).eq("exhibition_id", id); if (countError) throw countError;
    const { error: uploadError } = await db.storage.from("exhibition-images").upload(uploadedPath, file, { contentType: file.type, upsert: false }); if (uploadError) throw uploadError;
    const primary = shouldSetManualMediaPrimary(registeredCount);
    const { data: inserted, error: insertError } = await db.from("media_assets").insert({ exhibition_id: id, storage_path: uploadedPath, original_filename: file.name, source_type: sourceType, source_url: sourceUrl, credit: nullableText(form.get("credit")), usage_note: usageNote, rights_status: rightsStatus, rights_checked_at: new Date().toISOString(), valid_until: nullableText(form.get("valid_until")), is_primary: primary }).select("id").single(); if (insertError || !inserted) throw insertError || new Error("画像を保存できませんでした。");
    const asset = await signedMediaAsset(db, inserted.id);
    revalidatePath("/admin"); revalidatePath("/admin/exhibitions"); revalidatePath(`/admin/exhibitions/${id}`); return NextResponse.json({ message: "画像とRights情報を保存しました。", asset });
  } catch (error) {
    if (uploadedPath) { try { await createSupabaseAdminClient().storage.from("exhibition-images").remove([uploadedPath]); } catch {} }
    return NextResponse.json({ error: error instanceof Error ? error.message : "Upload failed" }, { status: 400 });
  }
}
