import { NextResponse } from "next/server";
import { validUuid } from "@/lib/admin/http";
import { createOfficialCrawlCsv } from "@/lib/official-venue-crawler/csv";
import { getOfficialCrawlRows } from "@/lib/official-venue-crawler/repository";

export async function GET(_request: Request, { params }: { params: Promise<{ runId: string }> }) {
  try {
    const { runId } = await params;
    if (!validUuid(runId)) throw new Error("Invalid Crawl run ID");
    const rows = await getOfficialCrawlRows(runId);
    const date = new Date().toISOString().slice(0, 10).replaceAll("-", "");
    return new NextResponse(createOfficialCrawlCsv(rows), {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="venue-official-crawl-${date}.csv"`,
      },
    });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "CSV download failed" }, { status: 400 });
  }
}
