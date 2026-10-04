import { NextResponse } from "next/server";
import { validUuid } from "@/lib/admin/http";
import { previewOfficialVenueFields } from "@/lib/admin/venue-field-review-service";
import { executeOfficialVenueCrawl } from "@/lib/official-venue-crawler/repository";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

function assertLocalRequest(request: Request) {
  const hostname = new URL(request.url).hostname;
  if (!["localhost", "127.0.0.1", "::1", "[::1]"].includes(hostname)) throw new Error("Official Website Crawl v1はLOCAL環境専用です。");
}

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    if (!validUuid(id)) throw new Error("Invalid venue ID");
    const runId = new URL(request.url).searchParams.get("run");
    return NextResponse.json(await previewOfficialVenueFields(createSupabaseAdminClient(), id, runId));
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Official preview failed" }, { status: 400 });
  }
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    assertLocalRequest(request);
    const { id } = await params;
    if (!validUuid(id)) throw new Error("Invalid venue ID");
    const result = await executeOfficialVenueCrawl({ mode: "selected", ids: [id] });
    const preview = await previewOfficialVenueFields(createSupabaseAdminClient(), id, result.runId);
    return NextResponse.json({ ...preview, message: "公式サイト取得結果を確認してください。Master項目はまだ変更していません。" });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Official Website Crawl failed" }, { status: 400 });
  }
}
