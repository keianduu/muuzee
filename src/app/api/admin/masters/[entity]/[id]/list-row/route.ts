import { NextResponse } from "next/server";
import { validUuid } from "@/lib/admin/http";
import { isMasterEntity } from "@/lib/admin/master-config";
import { getMasterListRow } from "@/lib/admin/master-repository";

export async function GET(_: Request, { params }: { params: Promise<{ entity: string; id: string }> }) {
  try {
    const { entity, id } = await params;
    if (!isMasterEntity(entity) || !validUuid(id)) throw new Error("Invalid master");
    const result = await getMasterListRow(entity, id);
    if (!result.data) return NextResponse.json({ error: result.error || "一覧行が見つかりません。" }, { status: 404 });
    return NextResponse.json(result.data);
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "一覧行の取得に失敗しました。" }, { status: 400 });
  }
}
