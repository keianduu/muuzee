import { NextResponse } from "next/server";
import { listExhibitions } from "@/lib/admin/exhibition-list-repository";

export async function GET(request: Request) {
  try {
    const query = new URL(request.url).searchParams;
    const result = await listExhibitions({
      q: query.get("q") || undefined,
      status: query.get("status") || undefined,
      image: query.get("image") || undefined,
      schedule: query.get("schedule") || undefined,
      page: Number(query.get("page")),
      pageSize: Number(query.get("pageSize")),
    });
    return NextResponse.json(result, { status: result.error ? 500 : 200 });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "展覧会一覧の取得に失敗しました。" }, { status: 400 });
  }
}
