import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { searchPriorityVenueImages } from "@/lib/venue-enrichment/service";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    if (body.tier !== "A-C") throw new Error("Targeted Image SearchはA〜C専用です。");
    const result = await searchPriorityVenueImages({ limit: Number(body.limit) || 20, dryRun: Boolean(body.dryRun), venueIds: Array.isArray(body.venueIds) ? body.venueIds : [] });
    revalidatePath("/admin/venues");
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Image search failed" }, { status: 400 });
  }
}
