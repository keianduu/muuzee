import { NextResponse } from "next/server";
import { validUuid } from "@/lib/admin/http";
import { isMasterEntity } from "@/lib/admin/master-config";
import { getMasterData } from "@/lib/admin/master-repository";

export async function GET(_: Request, { params }: { params: Promise<{ entity: string; id: string }> }) {
  try {
    const { entity, id } = await params;
    if (!isMasterEntity(entity) || !validUuid(id)) throw new Error("Invalid master");
    const result = await getMasterData(entity, id);
    if (!result.data) return NextResponse.json({ error: result.error || "Data診断が見つかりません。" }, { status: 404 });
    return NextResponse.json(result.data);
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Data診断の取得に失敗しました。" }, { status: 400 });
  }
}
