import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { applyStoredWikidataCandidate, classifyExhibitionVenueCandidates } from "@/lib/venue-enrichment/source-application";

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({})) as { mode?: string };
    const db = createSupabaseAdminClient();
    const classified = await classifyExhibitionVenueCandidates(db);
    const summary = {
      target: classified.venueIds.length,
      zero: classified.zero.length,
      single: classified.single.length,
      multiple: classified.multiple.length,
      applied: 0,
      failed: [] as Array<{ venueId: string; message: string }>,
    };
    if (body.mode !== "apply") return NextResponse.json({ mode: "dry-run", ...summary });
    for (const item of classified.single) {
      try {
        await applyStoredWikidataCandidate(db, item.venueId, item.candidate);
        summary.applied += 1;
      } catch (error) {
        summary.failed.push({ venueId: item.venueId, message: error instanceof Error ? error.message : "Source application failed" });
      }
    }
    revalidatePath("/admin/venues");
    return NextResponse.json({ mode: "apply", ...summary });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Source application failed" }, { status: 400 });
  }
}
