import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { enrichVenueAddressesFromWikipedia, type WikipediaVenueScope } from "@/lib/wikipedia/venue-enrichment";

export const maxDuration = 300;

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const scope = (["A", "A-B", "A-C", "selected"].includes(body.scope) ? body.scope : "A-C") as WikipediaVenueScope;
    const venueIds = Array.isArray(body.venueIds) ? body.venueIds.filter((id: unknown) => typeof id === "string").slice(0, 200) : [];
    if (scope === "selected" && !venueIds.length) throw new Error("Venueを選択してください。");
    const result = await enrichVenueAddressesFromWikipedia({ scope, venueIds, limit: Number(body.limit) || 20, dryRun: Boolean(body.dryRun), force: Boolean(body.force) });
    revalidatePath("/admin/venues");
    return NextResponse.json({ message: body.dryRun ? "Wikipedia住所補完のDry Runが完了しました。" : "Wikipedia住所補完が完了しました。", ...result });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Wikipedia address enrichment failed" }, { status: 400 });
  }
}
