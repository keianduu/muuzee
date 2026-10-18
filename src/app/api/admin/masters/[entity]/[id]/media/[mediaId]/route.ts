import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { validUuid } from "@/lib/admin/http";
import { isMasterEntity, MASTER_CONFIGS } from "@/lib/admin/master-config";
import { signedMediaAsset } from "@/lib/admin/media-asset-response";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export async function PATCH(request: Request, { params }: { params: Promise<{ entity: string; id: string; mediaId: string }> }) {
  try {
    const { entity, id, mediaId } = await params;
    if (!isMasterEntity(entity) || !validUuid(id) || !validUuid(mediaId)) throw new Error("Invalid ID");
    const body = await request.json() as { action?: string };
    if (body.action !== "approve_rights") throw new Error("Unsupported action");
    const config = MASTER_CONFIGS[entity]; const db = createSupabaseAdminClient();
    const { data, error } = await db.from("media_assets").update({ rights_status: "approved", rights_checked_at: new Date().toISOString() }).eq("id", mediaId).eq(config.ownerKey, id).eq("rights_status", "needs_review").select("id").maybeSingle();
    if (error) throw error;
    if (!data) throw new Error("Rights確認待ちの登録画像ではありません。");
    revalidatePath(`/admin/${entity}`); revalidatePath(`/admin/${entity}/${id}`);
    return NextResponse.json({ message: "Rightsを確認済みにしました。", asset: await signedMediaAsset(db, mediaId) });
  } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "Rights approval failed" }, { status: 400 }); }
}

export async function DELETE(_: Request, { params }: { params: Promise<{ entity: string; id: string; mediaId: string }> }) {
  try {
    const { entity, id, mediaId } = await params;
    if (!isMasterEntity(entity) || !validUuid(id) || !validUuid(mediaId)) throw new Error("Invalid ID");
    const config = MASTER_CONFIGS[entity]; const db = createSupabaseAdminClient();
    const { data, error } = await db.from("media_assets").select("storage_path").eq("id", mediaId).eq(config.ownerKey, id).single();
    if (error) throw error;
    const { error: deleteError } = await db.from("media_assets").delete().eq("id", mediaId).eq(config.ownerKey, id); if (deleteError) throw deleteError;
    const { error: storageError } = await db.storage.from("exhibition-images").remove([data.storage_path]); if (storageError) throw storageError;
    revalidatePath(`/admin/${entity}`); revalidatePath(`/admin/${entity}/${id}`);
    return NextResponse.json({ message: "画像を削除しました。", removedAssetId: mediaId });
  } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "Delete failed" }, { status: 400 }); }
}
