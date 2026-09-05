import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { validUuid } from "@/lib/admin/http";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { applyStoredWikidataCandidate, type StoredWikidataCandidate } from "@/lib/venue-enrichment/source-application";

export async function POST(request: Request, { params }: { params: Promise<{ id: string; candidateId: string }> }) {
  try {
    const { id, candidateId } = await params; if (!validUuid(id) || !validUuid(candidateId)) throw new Error("Invalid ID"); const { action } = await request.json(); const db = createSupabaseAdminClient();
    if (action !== "select" && action !== "adopt") throw new Error("Source candidate selection only");
    const { data, error } = await db.from("venue_external_match_candidates").select("*").eq("id", candidateId).eq("venue_id", id).single(); if (error || !data) throw error || new Error("Candidate not found");
    await applyStoredWikidataCandidate(db, id, data as StoredWikidataCandidate, "human selected one of multiple source candidates");
    revalidatePath("/admin/venues"); revalidatePath(`/admin/venues/${id}`); return NextResponse.json({ message: "Source Candidateを選択し、優先順位に従ってMasterへ反映しました。" });
  } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "Match update failed" }, { status: 400 }); }
}
