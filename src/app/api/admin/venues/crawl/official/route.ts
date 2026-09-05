import { NextResponse } from "next/server";
import { executeOfficialVenueCrawl } from "@/lib/official-venue-crawler/repository";

function assertLocalRequest(request: Request) {
  const hostname = new URL(request.url).hostname;
  if (!["localhost", "127.0.0.1", "::1", "[::1]"].includes(hostname)) throw new Error("Official Website Crawl v1はLOCAL環境専用です。");
}

export async function POST(request: Request) {
  try {
    assertLocalRequest(request);
    const body = await request.json();
    if (!["selected", "filtered", "count"].includes(body.mode)) throw new Error("Crawl modeが不正です。");
    const result = await executeOfficialVenueCrawl(body);
    return NextResponse.json({ ...result, rows: result.rows.slice(0, 20), message: "公式サイト情報を取得しました。CSVを確認してからImportしてください。" });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Official Website Crawl failed" }, { status: 400 });
  }
}
