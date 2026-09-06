import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { searchPriorityArtistImages } from "@/lib/wikidata/artist-image-search";

export const maxDuration = 300;
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const result = await searchPriorityArtistImages({ limit: Number(body.limit) || 20, artistIds: Array.isArray(body.artistIds) ? body.artistIds : [], dryRun: Boolean(body.dryRun) });
    revalidatePath("/admin/artists");
    return NextResponse.json({ message: body.dryRun ? "Artist画像再探索のDry Runが完了しました。" : "Artist画像候補の再探索が完了しました。", ...result });
  } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "Artist image search failed" }, { status: 400 }); }
}
