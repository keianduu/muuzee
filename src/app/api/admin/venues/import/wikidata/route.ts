import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { importWikidataVenues } from "@/lib/wikidata/venue-importer";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { HOSTED_WIKIDATA_FULL_SYNC_ERROR, shouldRejectHostedWikidataFullSync, wikidataRuntime } from "@/lib/wikidata/runtime-policy";
import { isVenueInitialAcquisitionEnabled, VENUE_INITIAL_ACQUISITION_DISABLED } from "@/lib/admin/venue-initial-acquisition-capability";

export const maxDuration = 300;

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
    if (shouldRejectHostedWikidataFullSync(body.mode)) {
      return NextResponse.json(HOSTED_WIKIDATA_FULL_SYNC_ERROR, { status: 409 });
    }
    const mode = body.mode === "full" ? "full" : "count";
    const runtime = wikidataRuntime();
    if (runtime === "hosted" && mode === "count" && !isVenueInitialAcquisitionEnabled({ hosted: true })) {
      return NextResponse.json(VENUE_INITIAL_ACQUISITION_DISABLED, { status: 403 });
    }
    const count = runtime === "hosted" && mode === "count"
      ? Math.min(5, Number(body.count) || 5)
      : Number(body.count) || 20;
    const offset = Number.isFinite(Number(body.offset)) ? Number(body.offset) : undefined;
    const result = await importWikidataVenues({ mode, count, offset, runtime });
    revalidatePath("/admin/venues");
    revalidatePath("/admin/imports");
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Wikidata Venue Import failed" }, { status: 400 });
  }
}
