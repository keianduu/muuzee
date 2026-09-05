import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { validUuid } from "@/lib/admin/http";
import { isMasterEntity, MASTER_CONFIGS } from "@/lib/admin/master-config";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

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
    return NextResponse.json({ message: "画像を削除しました。" });
  } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "Delete failed" }, { status: 400 }); }
}
