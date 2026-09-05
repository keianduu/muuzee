import { NextResponse } from "next/server";
import { validUuid } from "@/lib/admin/http";
import { createOfficialAiEnrichmentCsv } from "@/lib/official-venue-crawler/csv";
import { getOfficialCrawlRows } from "@/lib/official-venue-crawler/repository";

export async function GET(_request: Request, { params }: { params: Promise<{ runId: string }> }) {
  try {
    const { runId } = await params;
    if (!validUuid(runId)) throw new Error("Run IDが不正です。");
    const rows = await getOfficialCrawlRows(runId);
    if (!rows.length) throw new Error("Crawl結果がありません。");
    return new NextResponse(createOfficialAiEnrichmentCsv(rows), {
      headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="muuzee-venue-official-ai-${runId}.csv"` },
    });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "AI enrichment CSV export failed" }, { status: 400 });
  }
}
