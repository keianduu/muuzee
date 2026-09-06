import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { validUuid } from "@/lib/admin/http";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string; candidateId: string }> }) {
  try {
    const { id, candidateId } = await params;
    if (!validUuid(id) || !validUuid(candidateId)) throw new Error("Invalid ID");
    const body = await request.json();
    const updates: Record<string, string> = {};
    if (body.review_status !== undefined) {
      if (!["accepted", "rejected"].includes(body.review_status)) throw new Error("Invalid review status");
      updates.review_status = body.review_status;
    }
    if (body.rights_status !== undefined) {
      if (!["rejected", "needs_review", "approved"].includes(body.rights_status)) throw new Error("Invalid rights status");
      updates.rights_status = body.rights_status;
    }
    if (!Object.keys(updates).length) throw new Error("No candidate update supplied");
    const db = createSupabaseAdminClient();
    const { data: source, error: sourceError } = await db.from("source_records").select("id").eq("venue_id", id);
    if (sourceError) throw sourceError;
    const sourceIds = (source || []).map((item) => item.id);
    if (!sourceIds.length) throw new Error("Candidate not found");
    const { data, error } = await db.from("source_image_candidates").update(updates).eq("id", candidateId).in("source_record_id", sourceIds).select("id").maybeSingle();
    if (error) throw error;
    if (!data) throw new Error("Candidate not found");
    if (updates.review_status) {
      const { data: remaining, error: remainingError } = await db.from("source_image_candidates").select("review_status,is_active,discovery_source").in("source_record_id", sourceIds);
      if (remainingError) throw remainingError;
      const active = (remaining || []).filter((item) => item.is_active);
      const imageSearchStatus = active.length && active.every((item) => item.review_status === "rejected") ? "image_candidate_rejected"
        : active.some((item) => item.discovery_source === "wikidata_p18") ? "p18_found"
          : active.some((item) => item.discovery_source === "commons_category") ? "commons_candidate_found"
            : active.some((item) => item.discovery_source === "wikipedia_article") ? "wikipedia_candidate_found"
              : active.some((item) => item.review_status === "accepted") ? "image_candidate_kept"
                : active.some((item) => item.review_status === "unreviewed") ? "image_candidate_found" : "no_image_found";
      const { error: venueError } = await db.from("venues").update({ image_search_status: imageSearchStatus }).eq("id", id);
      if (venueError) throw venueError;
    }
    revalidatePath(`/admin/venues/${id}`);
    revalidatePath("/admin/venues");
    return NextResponse.json({ message: "画像Candidateの判断を更新しました。" });
  }
  catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "Candidate update failed" }, { status: 400 }); }
}
