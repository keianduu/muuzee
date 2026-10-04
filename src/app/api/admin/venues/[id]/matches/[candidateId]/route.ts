import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { validUuid } from "@/lib/admin/http";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { confirmWikidataIdentity, rejectWikidataIdentity, type StoredWikidataCandidate } from "@/lib/venue-enrichment/source-application";

export async function POST(request: Request, { params }: { params: Promise<{ id: string; candidateId: string }> }) {
  try {
    const { id, candidateId } = await params; if (!validUuid(id) || !validUuid(candidateId)) throw new Error("Invalid ID"); const { action } = await request.json(); const db = createSupabaseAdminClient();
    if (!['confirm', 'select', 'reject'].includes(action)) throw new Error("Unsupported Wikidata identity action");
    const { data, error } = await db.from("venue_external_match_candidates").select("*").eq("id", candidateId).eq("venue_id", id).single(); if (error || !data) throw error || new Error("Candidate not found");
    if (action === "reject") await rejectWikidataIdentity(db, id, candidateId);
    else await confirmWikidataIdentity(db, id, data as StoredWikidataCandidate, "human confirmed Wikidata identity");
    revalidatePath("/admin/venues"); revalidatePath(`/admin/venues/${id}`); return NextResponse.json({ message: action === "reject" ? "Wikidata候補を非採用にしました。" : "Wikidata QIDを確定しました。Master項目は変更していません。" });
  } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "Match update failed" }, { status: 400 }); }
}
