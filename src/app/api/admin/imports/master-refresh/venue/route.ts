import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { runVenuePeriodicRefresh } from "@/lib/wikidata/venue-periodic-refresh";

export const maxDuration = 300;

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const result = await runVenuePeriodicRefresh({
      dryRun: body.dryRun !== false,
      limit: Number(body.limit),
    });
    if (!result.dryRun) {
      revalidatePath("/admin/imports");
      revalidatePath("/admin/imports/summary");
      revalidatePath("/admin/venues");
    }
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Venue periodic refresh failed" }, { status: 500 });
  }
}
