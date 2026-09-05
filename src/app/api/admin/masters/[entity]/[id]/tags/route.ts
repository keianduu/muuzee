import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { nullableText, validUuid } from "@/lib/admin/http";
import { isMasterEntity } from "@/lib/admin/master-config";
import { slugify } from "@/lib/admin/slug";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

const joins = { venues: ["venue_tags", "venue_id"], artists: ["artist_tags", "artist_id"], works: ["work_tags", "work_id"] } as const;

export async function POST(request: Request, { params }: { params: Promise<{ entity: string; id: string }> }) {
  try {
    const { entity, id } = await params; if (!isMasterEntity(entity) || !validUuid(id)) throw new Error("Invalid master");
    const body = await request.json(); const name = nullableText(body.name); const type = nullableText(body.type);
    if (!name || !type || !["genre", "movement", "era", "theme", "other"].includes(type)) throw new Error("Tag nameとtypeを入力してください。");
    const db = createSupabaseAdminClient(); const slug = slugify(name);
    const { data: tag, error: tagError } = await db.from("tags").upsert({ type, name, slug }, { onConflict: "type,slug" }).select("id").single(); if (tagError) throw tagError;
    const [table, ownerKey] = joins[entity]; const { error } = await db.from(table).upsert({ [ownerKey]: id, tag_id: tag.id }); if (error) throw error;
    revalidatePath(`/admin/${entity}/${id}`); return NextResponse.json({ message: "Tagを追加しました。" });
  } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "Tag save failed" }, { status: 400 }); }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ entity: string; id: string }> }) {
  try {
    const { entity, id } = await params; const { tagId } = await request.json(); if (!isMasterEntity(entity) || !validUuid(id) || !validUuid(tagId)) throw new Error("Invalid ID");
    const [table, ownerKey] = joins[entity]; const { error } = await createSupabaseAdminClient().from(table).delete().eq(ownerKey, id).eq("tag_id", tagId); if (error) throw error;
    revalidatePath(`/admin/${entity}/${id}`); return NextResponse.json({ message: "Tagを解除しました。" });
  } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "Tag delete failed" }, { status: 400 }); }
}
