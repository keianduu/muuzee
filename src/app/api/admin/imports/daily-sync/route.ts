import { NextResponse } from "next/server";
import { runExhibitionDailySync } from "@/lib/exhibition-sync/daily-sync";

export const maxDuration = 300;

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const result = await runExhibitionDailySync({ dryRun: body.dryRun !== false, keyword: typeof body.keyword === "string" ? body.keyword : "", dateFrom: typeof body.dateFrom === "string" ? body.dateFrom : undefined, dateTo: typeof body.dateTo === "string" ? body.dateTo : undefined, sampleLimit: Number(body.sampleLimit || 20), backfillExisting: body.backfillExisting === true });
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Daily Sync failed" }, { status: 500 });
  }
}
