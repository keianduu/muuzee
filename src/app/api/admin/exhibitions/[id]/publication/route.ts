import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { evaluatePublication, statusAfterUnpublish } from "@/lib/admin/publication";
import { validUuid } from "@/lib/admin/http";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { isExhibitionPublicationAction } from "@/lib/admin/exhibition-publication-action";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try { const { id } = await params; if (!validUuid(id)) throw new Error("Invalid exhibition ID"); const { action } = await request.json(); if (!isExhibitionPublicationAction(action)) throw new Error("Invalid publication action"); const db = createSupabaseAdminClient();
    const [exhibitionResult, occurrenceResult, imageResult] = await Promise.all([db.from("exhibitions").select("title").eq("id", id).single(), db.from("exhibition_occurrences").select("venue_id,start_date,end_date").eq("exhibition_id", id).neq("relation_status", "stale").eq("visibility_status", "public").limit(1).maybeSingle(), db.from("media_assets").select("id,rights_status").eq("exhibition_id", id).eq("is_primary", true).maybeSingle()]);
    if (exhibitionResult.error) throw exhibitionResult.error; if (occurrenceResult.error) throw occurrenceResult.error; if (imageResult.error) throw imageResult.error;
    const input = { title: exhibitionResult.data.title, venueId: occurrenceResult.data?.venue_id, startDate: occurrenceResult.data?.start_date, endDate: occurrenceResult.data?.end_date, primaryImage: imageResult.data ? { id: imageResult.data.id, rightsStatus: imageResult.data.rights_status } : null }; const evaluation = evaluatePublication(input);
    if (action === "publish" && !evaluation.canPublish) throw new Error(`公開条件が不足しています: ${evaluation.missing.join("、")}`);
    const nextStatus = action === "unpublish" ? statusAfterUnpublish() : "published"; const { error } = await db.from("exhibitions").update({ publication_status: nextStatus }).eq("id", id); if (error) throw error;
    revalidatePath("/admin"); revalidatePath("/admin/exhibitions"); revalidatePath(`/admin/exhibitions/${id}`); return NextResponse.json({ message: nextStatus === "published" ? "公開しました。" : "非公開にしました。" });
  } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "Publication update failed" }, { status: 400 }); }
}
