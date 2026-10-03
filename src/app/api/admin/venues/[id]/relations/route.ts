import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { validUuid } from "@/lib/admin/http";
import { blocksPublishedOccurrenceDelete, isRelationVisibility, isVenueRelationKind } from "@/lib/admin/venue-relations";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

function refresh(venueId: string) {
  revalidatePath("/admin/venues");
  revalidatePath(`/admin/venues/${venueId}`);
  revalidatePath("/admin/exhibitions");
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = await request.json();
    if (!validUuid(id) || !validUuid(body.targetId) || !isVenueRelationKind(body.kind)) throw new Error("Invalid relation input");
    const db = createSupabaseAdminClient();
    if (body.kind === "holding") {
      const { data: existing, error: findError } = await db.from("collection_holdings").select("id").eq("venue_id", id).eq("work_id", body.targetId).is("inventory_number", null).maybeSingle();
      if (findError) throw findError;
      if (existing) return NextResponse.json({ message: "この所蔵作品はすでに登録されています。", id: existing.id, duplicate: true });
      const { data: defaultVisibility, error: visibilityError } = await db.rpc("relation_default_visibility", { p_source: "manual", p_assertion_type: "collection_holding" });
      if (visibilityError) throw visibilityError;
      const { data, error } = await db.from("collection_holdings").insert({
        venue_id: id,
        work_id: body.targetId,
        holding_type: "collection",
        inventory_number: null,
        source: "manual",
        verified_at: new Date().toISOString(),
        visibility_status: defaultVisibility === "public" ? "public" : "hidden",
        visibility_overridden: false,
      }).select("id").single();
      if (error) throw error;
      refresh(id);
      return NextResponse.json({ message: "所蔵作品を追加しました。", id: data.id });
    }

    const { data: existing, error: findError } = await db.from("exhibition_occurrences").select("id").eq("venue_id", id).eq("exhibition_id", body.targetId).is("start_date", null).maybeSingle();
    if (findError) throw findError;
    if (existing) return NextResponse.json({ message: "この関連展覧会はすでに登録されています。", id: existing.id, duplicate: true });
    const { data, error } = await db.from("exhibition_occurrences").insert({
      venue_id: id,
      exhibition_id: body.targetId,
      start_date: null,
      end_date: null,
      relation_status: "active",
      visibility_status: "public",
      visibility_overridden: false,
    }).select("id").single();
    if (error) throw error;
    refresh(id);
    return NextResponse.json({ message: "関連展覧会を追加しました。", id: data.id });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Relation save failed" }, { status: 400 });
  }
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = await request.json();
    if (!validUuid(id) || !validUuid(body.relationId) || !isVenueRelationKind(body.kind) || !isRelationVisibility(body.visibility)) throw new Error("Invalid relation visibility input");
    const table = body.kind === "holding" ? "collection_holdings" : "exhibition_occurrences";
    const db = createSupabaseAdminClient();
    const relationResult = body.kind === "holding"
      ? await db.from("collection_holdings").select("id,visibility_status").eq("id", body.relationId).eq("venue_id", id).maybeSingle()
      : await db.from("exhibition_occurrences").select("id,visibility_status,exhibition_id,relation_status,exhibitions(publication_status)").eq("id", body.relationId).eq("venue_id", id).maybeSingle();
    const { data: relation, error: relationError } = relationResult;
    if (relationError) throw relationError;
    if (!relation) throw new Error("Relation not found for this Venue");
    if (body.kind === "exhibition" && body.visibility === "hidden") {
      const occurrence = relation as unknown as { exhibition_id: string; relation_status: string; visibility_status: string; exhibitions: { publication_status?: string } | Array<{ publication_status?: string }> | null };
      const exhibition = Array.isArray(occurrence.exhibitions) ? occurrence.exhibitions[0] : occurrence.exhibitions;
      const { count, error: countError } = await db.from("exhibition_occurrences").select("id", { count: "exact", head: true }).eq("exhibition_id", occurrence.exhibition_id).neq("relation_status", "stale").eq("visibility_status", "public");
      if (countError) throw countError;
      if (blocksPublishedOccurrenceDelete({ publicationStatus: exhibition?.publication_status || "draft", activeVisibleCount: count || 0, targetRelationStatus: occurrence.relation_status, targetVisibility: occurrence.visibility_status })) {
        throw new Error("公開中の展覧会に残る公開会場がなくなるため非表示にできません。先に非公開化または別会場を追加してください。");
      }
    }
    const { error } = await db.from(table).update({
      visibility_status: body.visibility,
      visibility_overridden: true,
      hidden_reason: body.visibility === "hidden" ? (typeof body.hiddenReason === "string" ? body.hiddenReason.trim().slice(0, 500) || null : null) : null,
      visibility_updated_at: new Date().toISOString(),
    }).eq("id", relation.id).eq("venue_id", id);
    if (error) throw error;
    refresh(id);
    return NextResponse.json({ message: body.visibility === "public" ? "公開へ変更しました。" : "非表示へ変更しました。", before: relation.visibility_status, after: body.visibility });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Visibility update failed" }, { status: 400 });
  }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = await request.json();
    if (!validUuid(id) || !validUuid(body.relationId) || !isVenueRelationKind(body.kind)) throw new Error("Invalid relation delete input");
    const db = createSupabaseAdminClient();
    if (body.kind === "exhibition") {
      const { data: target, error: targetError } = await db.from("exhibition_occurrences").select("id,exhibition_id,relation_status,visibility_status,exhibitions(publication_status)").eq("id", body.relationId).eq("venue_id", id).maybeSingle();
      if (targetError) throw targetError;
      if (!target) throw new Error("Related Exhibition not found");
      const exhibitionValue = target.exhibitions as unknown as { publication_status?: string } | Array<{ publication_status?: string }> | null;
      const exhibition = Array.isArray(exhibitionValue) ? exhibitionValue[0] : exhibitionValue;
      const { count, error: countError } = await db.from("exhibition_occurrences").select("id", { count: "exact", head: true }).eq("exhibition_id", target.exhibition_id).neq("relation_status", "stale").eq("visibility_status", "public");
      if (countError) throw countError;
      if (blocksPublishedOccurrenceDelete({ publicationStatus: exhibition?.publication_status || "draft", activeVisibleCount: count || 0, targetRelationStatus: target.relation_status, targetVisibility: target.visibility_status })) {
        throw new Error("公開中の展覧会に残る公開会場がなくなるため削除できません。先に非公開化または別会場を追加してください。");
      }
    }
    const table = body.kind === "holding" ? "collection_holdings" : "exhibition_occurrences";
    const { error } = await db.from(table).delete().eq("id", body.relationId).eq("venue_id", id);
    if (error) throw error;
    refresh(id);
    return NextResponse.json({ message: "関連を削除しました。" });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Relation delete failed" }, { status: 400 });
  }
}
