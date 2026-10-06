import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { validUuid } from "@/lib/admin/http";
import { isMasterEntity } from "@/lib/admin/master-config";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

const joins = { venues: ["venue_tags", "venue_id"], artists: ["artist_tags", "artist_id"], works: ["work_tags", "work_id"] } as const;

export async function POST(request: Request, { params }: { params: Promise<{ entity: string; id: string }> }) {
  try {
    const { entity, id } = await params;
    const body = await request.json();
    const tagId = body.tagId;
    if (!isMasterEntity(entity) || !validUuid(id) || typeof tagId !== "string" || !validUuid(tagId)) {
      return NextResponse.json({ error: "既存Tagを選択してください。" }, { status: 400 });
    }

    const db = createSupabaseAdminClient();
    const { data: master, error: masterError } = await db.from(entity).select("id").eq("id", id).maybeSingle();
    if (masterError) throw masterError;
    if (!master) return NextResponse.json({ error: "対象Masterが見つかりません。" }, { status: 404 });

    const { data: tag, error: tagError } = await db.from("tags").select("id,type,name,slug").eq("id", tagId).maybeSingle();
    if (tagError) throw tagError;
    if (!tag) return NextResponse.json({ error: "選択したTagが見つかりません。" }, { status: 404 });

    const [table, ownerKey] = joins[entity];
    const { error } = await db.from(table).upsert(
      { [ownerKey]: id, tag_id: tagId },
      { onConflict: `${ownerKey},tag_id`, ignoreDuplicates: true },
    );
    if (error) throw error;
    revalidatePath(`/admin/${entity}/${id}`);
    return NextResponse.json({ message: "Tagを付与しました。", tag });
  } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "Tag save failed" }, { status: 400 }); }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ entity: string; id: string }> }) {
  try {
    const { entity, id } = await params;
    const { tagId } = await request.json();
    if (!isMasterEntity(entity) || !validUuid(id) || typeof tagId !== "string" || !validUuid(tagId)) {
      return NextResponse.json({ error: "解除するTagを指定してください。" }, { status: 400 });
    }
    const db = createSupabaseAdminClient();
    const { data: master, error: masterError } = await db.from(entity).select("id").eq("id", id).maybeSingle();
    if (masterError) throw masterError;
    if (!master) return NextResponse.json({ error: "対象Masterが見つかりません。" }, { status: 404 });
    const [table, ownerKey] = joins[entity];
    const { error } = await db.from(table).delete().eq(ownerKey, id).eq("tag_id", tagId);
    if (error) throw error;
    revalidatePath(`/admin/${entity}/${id}`);
    return NextResponse.json({ message: "Tagを解除しました。", removedTagId: tagId });
  } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "Tag delete failed" }, { status: 400 }); }
}
