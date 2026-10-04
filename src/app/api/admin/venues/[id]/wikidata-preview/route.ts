import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { validUuid } from "@/lib/admin/http";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { applyWikidataVenueFields, previewWikidataVenueFields } from "@/lib/venue-enrichment/source-application";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    if (!validUuid(id)) throw new Error("Invalid venue ID");
    const preview = await previewWikidataVenueFields(createSupabaseAdminClient(), id);
    return NextResponse.json({ qid: preview.qid, rows: preview.rows });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Wikidata preview failed" }, { status: 400 });
  }
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    if (!validUuid(id)) throw new Error("Invalid venue ID");
    const body = await request.json() as { fields?: string[] };
    const result = await applyWikidataVenueFields(createSupabaseAdminClient(), id, Array.isArray(body.fields) ? body.fields : []);
    revalidatePath("/admin/venues");
    revalidatePath(`/admin/venues/${id}`);
    return NextResponse.json({ ...result, message: `${result.applied.length}項目をWikidataから反映しました。` });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Wikidata apply failed" }, { status: 400 });
  }
}
