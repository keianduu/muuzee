import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { validUuid } from "@/lib/admin/http";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params; const body = await request.json(); if (!validUuid(id) || !validUuid(body.targetId)) throw new Error("Invalid ID");
    const db = createSupabaseAdminClient();
    if (body.kind === "artist") {
      const { data: existing, error: findError } = await db.from("work_artists").select("id,visibility_overridden").eq("work_id", id).eq("artist_id", body.targetId).maybeSingle(); if (findError) throw findError;
      const sharedValues = { role: body.role || null, source: "manual", verified_at: new Date().toISOString() };
      const result = existing
        ? await db.from("work_artists").update(existing.visibility_overridden ? sharedValues : { ...sharedValues, visibility_status: "public", hidden_reason: null, visibility_updated_at: new Date().toISOString() }).eq("id", existing.id)
        : await db.from("work_artists").insert({ work_id: id, artist_id: body.targetId, ...sharedValues, visibility_status: "public", visibility_overridden: false });
      if (result.error) throw result.error;
    } else if (body.kind === "holding") {
      const { data: existing, error: findError } = await db.from("collection_holdings").select("id,visibility_overridden").eq("work_id", id).eq("venue_id", body.targetId).is("inventory_number", null).maybeSingle(); if (findError) throw findError;
      const sharedValues = { holding_type: body.holdingType || null, source: "manual", verified_at: new Date().toISOString() };
      const result = existing
        ? await db.from("collection_holdings").update(existing.visibility_overridden ? sharedValues : { ...sharedValues, visibility_status: "public", hidden_reason: null, visibility_updated_at: new Date().toISOString() }).eq("id", existing.id)
        : await db.from("collection_holdings").insert({ work_id: id, venue_id: body.targetId, inventory_number: null, ...sharedValues, visibility_status: "public", visibility_overridden: false });
      if (result.error) throw result.error;
    } else if (body.kind === "presentation") {
      const presentationType = ["permanent", "temporary", "unknown"].includes(body.presentationType) ? body.presentationType : "unknown";
      const status = ["currently_displayed", "not_displayed", "unknown"].includes(body.status) ? body.status : "unknown";
      const { error } = await db.from("work_presentations").upsert({ work_id: id, venue_id: body.targetId, presentation_type: presentationType, status, start_date: body.startDate || null, end_date: body.endDate || null, source: "manual", verified_at: new Date().toISOString() }, { onConflict: "work_id,venue_id,presentation_type,start_date" });
      if (error) throw error;
    } else throw new Error("Unknown relation kind");
    revalidatePath(`/admin/works/${id}`); revalidatePath("/admin/works");
    return NextResponse.json({ message: "Relationを保存しました。" });
  } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "Relation save failed" }, { status: 400 }); }
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = await request.json();
    if (!validUuid(id) || !validUuid(body.relationId)) throw new Error("Invalid ID");
    if (body.kind !== "artist" && body.kind !== "holding") throw new Error("Visibility is supported only for Artist and Holding relations");
    if (body.visibility !== "public" && body.visibility !== "hidden") throw new Error("Invalid visibility");
    const table = body.kind === "artist" ? "work_artists" : "collection_holdings";
    const reason = body.visibility === "hidden" && typeof body.hiddenReason === "string" ? body.hiddenReason.trim().slice(0, 500) || null : null;
    const db = createSupabaseAdminClient();
    const { data: relation, error: relationError } = await db.from(table).select("id,work_id,visibility_status").eq("id", body.relationId).eq("work_id", id).maybeSingle();
    if (relationError) throw relationError;
    if (!relation) throw new Error("Relation not found for this Work");
    const { error } = await db.from(table).update({
      visibility_status: body.visibility,
      visibility_overridden: true,
      hidden_reason: reason,
      visibility_updated_at: new Date().toISOString(),
    }).eq("id", relation.id).eq("work_id", id);
    if (error) throw error;
    revalidatePath(`/admin/works/${id}`); revalidatePath("/admin/works");
    return NextResponse.json({ message: `Relationを${body.visibility === "public" ? "Public" : "Hidden"}へ変更しました。`, before: relation.visibility_status, after: body.visibility });
  } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "Visibility update failed" }, { status: 400 }); }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params; const body = await request.json(); if (!validUuid(id) || !validUuid(body.relationId)) throw new Error("Invalid ID");
    const table = body.kind === "artist" ? "work_artists" : body.kind === "holding" ? "collection_holdings" : body.kind === "presentation" ? "work_presentations" : null; if (!table) throw new Error("Unknown relation kind");
    const { error } = await createSupabaseAdminClient().from(table).delete().eq("id", body.relationId).eq("work_id", id); if (error) throw error;
    revalidatePath(`/admin/works/${id}`); revalidatePath("/admin/works");
    return NextResponse.json({ message: "Relationを解除しました。" });
  } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "Relation delete failed" }, { status: 400 }); }
}
