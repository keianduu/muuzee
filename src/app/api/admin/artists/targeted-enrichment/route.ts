import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { targetedTierAArtistEnrichment } from "@/lib/artist-enrichment/targeted";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const result = await targetedTierAArtistEnrichment({ dryRun: Boolean(body.dryRun) });
    revalidatePath("/admin/artists");
    return NextResponse.json({ message: body.dryRun ? "Tier A Targeted Enrichment Dry Run完了" : "Tier A Targeted Enrichment完了", ...result });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Targeted Artist Enrichment failed" }, { status: 400 });
  }
}
