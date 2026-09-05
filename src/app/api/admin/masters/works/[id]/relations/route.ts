import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { validUuid } from "@/lib/admin/http";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params; const body = await request.json(); if (!validUuid(id) || !validUuid(body.targetId)) throw new Error("Invalid ID");
    const db = createSupabaseAdminClient();
    if (body.kind === "artist") {
      const { error } = await db.from("work_artists").upsert({ work_id: id, artist_id: body.targetId, role: body.role || null }, { onConflict: "work_id,artist_id" }); if (error) throw error;
    } else if (body.kind === "holding") {
      const { data: existing, error: findError } = await db.from("collection_holdings").select("id").eq("work_id", id).eq("venue_id", body.targetId).is("inventory_number", null).maybeSingle(); if (findError) throw findError;
      const values = { work_id: id, venue_id: body.targetId, holding_type: body.holdingType || null, inventory_number: null };
      const result = existing ? await db.from("collection_holdings").update(values).eq("id", existing.id) : await db.from("collection_holdings").insert(values); if (result.error) throw result.error;
    } else throw new Error("Unknown relation kind");
    revalidatePath(`/admin/works/${id}`); revalidatePath("/admin/works");
    return NextResponse.json({ message: "Relationを保存しました。" });
  } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "Relation save failed" }, { status: 400 }); }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params; const body = await request.json(); if (!validUuid(id) || !validUuid(body.relationId)) throw new Error("Invalid ID");
    const table = body.kind === "artist" ? "work_artists" : body.kind === "holding" ? "collection_holdings" : null; if (!table) throw new Error("Unknown relation kind");
    const { error } = await createSupabaseAdminClient().from(table).delete().eq("id", body.relationId).eq("work_id", id); if (error) throw error;
    revalidatePath(`/admin/works/${id}`); revalidatePath("/admin/works");
    return NextResponse.json({ message: "Relationを解除しました。" });
  } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "Relation delete failed" }, { status: 400 }); }
}
