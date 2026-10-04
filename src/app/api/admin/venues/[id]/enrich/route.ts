import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { validUuid } from "@/lib/admin/http";
import { enrichVenue } from "@/lib/venue-enrichment/service";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    if (!validUuid(id)) throw new Error("Invalid venue ID");
    const db = createSupabaseAdminClient();
    const result = await enrichVenue(id, { autoConfirmSingle: false }, db);
    const { data: candidates, error } = await db.from("venue_external_match_candidates").select("*").eq("venue_id", id).eq("provider", "wikidata").neq("status", "rejected").order("confidence", { ascending: false });
    if (error) throw error;
    revalidatePath("/admin/venues"); revalidatePath(`/admin/venues/${id}`);
    return NextResponse.json({ message: "Wikidata候補を取得しました。Master項目は変更していません。", ...result, candidates: candidates || [] });
  }
  catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "Venue enrichment failed" }, { status: 400 }); }
}
