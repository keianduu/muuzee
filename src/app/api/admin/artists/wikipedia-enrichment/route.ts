import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { enrichArtistsFromWikipedia, type WikipediaArtistScope } from "@/lib/wikipedia/artist-enrichment";

export const maxDuration = 300;
export async function POST(request: Request) {
  try {
    const body = await request.json(); const scope = (["A", "A-B", "A-C", "selected"].includes(body.scope) ? body.scope : "A-C") as WikipediaArtistScope;
    const artistIds = Array.isArray(body.artistIds) ? body.artistIds.filter((id: unknown) => typeof id === "string").slice(0, 200) : [];
    const result = await enrichArtistsFromWikipedia({ scope, artistIds, limit: Number(body.limit) || 35, dryRun: Boolean(body.dryRun) }); revalidatePath("/admin/artists");
    return NextResponse.json({ message: body.dryRun ? "Wikipedia Artist補完のDry Runが完了しました。" : "Wikipedia Artist補完が完了しました。", ...result });
  } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "Wikipedia Artist enrichment failed" }, { status: 400 }); }
}
