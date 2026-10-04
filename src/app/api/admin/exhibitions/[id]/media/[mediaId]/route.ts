import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { validUuid } from "@/lib/admin/http";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string; mediaId: string }> }) {
  try { const { id, mediaId } = await params; if (!validUuid(id) || !validUuid(mediaId)) throw new Error("Invalid ID"); const db = createSupabaseAdminClient(); const { data, error } = await db.from("media_assets").select("storage_path").eq("id", mediaId).eq("exhibition_id", id).single(); if (error) throw error; const { error: storageError } = await db.storage.from("exhibition-images").remove([data.storage_path]); if (storageError) throw storageError; const { error: deleteError } = await db.from("media_assets").delete().eq("id", mediaId).eq("exhibition_id", id); if (deleteError) throw deleteError; revalidatePath("/admin"); revalidatePath("/admin/exhibitions"); revalidatePath(`/admin/exhibitions/${id}`); return NextResponse.json({ message: "画像を削除しました。", removedAssetId: mediaId }); }
  catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "Delete failed" }, { status: 400 }); }
}
