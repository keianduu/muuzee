import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { matchExhibitionArtists } from "@/lib/artist-matching/exhibition-matcher";

export const maxDuration = 300;

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const result = await matchExhibitionArtists({ limit: Number(body.limit) || 500, dryRun: Boolean(body.dryRun) });
    revalidatePath("/admin/artists");
    return NextResponse.json({ message: body.dryRun ? "Exhibition → Artist照合のDry Runが完了しました。" : "Exhibition → Artist照合が完了しました。", ...result });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Exhibition Artist matching failed" }, { status: 400 });
  }
}
