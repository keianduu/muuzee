import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { importWikidataVenues } from "@/lib/wikidata/venue-importer";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const maxDuration = 3600;

export async function GET() {
  try {
    const db = createSupabaseAdminClient();
    const { data, error } = await db.from("import_runs").select("id,status,metrics,started_at,finished_at").eq("operation_type", "wikidata_venue_import").order("started_at", { ascending: false }).limit(1).maybeSingle();
    if (error) throw error;
    return NextResponse.json(data || null);
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Progress lookup failed" }, { status: 400 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const mode = body.mode === "full" ? "full" : "count";
    const count = Number(body.count) || 20;
    const offset = Number.isFinite(Number(body.offset)) ? Number(body.offset) : undefined;
    const result = await importWikidataVenues({ mode, count, offset });
    revalidatePath("/admin/venues");
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Wikidata Venue Import failed" }, { status: 400 });
  }
}
