import { NextResponse } from "next/server";
import { validUuid } from "@/lib/admin/http";
import { getExhibitionListRow } from "@/lib/admin/exhibition-list-repository";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    if (!validUuid(id)) throw new Error("Invalid exhibition ID");
    const query = new URL(request.url).searchParams;
    const result = await getExhibitionListRow(id, { schedule: query.get("schedule") || undefined });
    if (!result.data) return NextResponse.json({ error: result.error || "展覧会一覧行が見つかりません。" }, { status: 404 });
    return NextResponse.json(result.data);
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "展覧会一覧行の取得に失敗しました。" }, { status: 400 });
  }
}
