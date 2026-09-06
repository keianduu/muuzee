import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { isMasterEntity } from "@/lib/admin/master-config";
import { masterAutoPrimaryMaintenance } from "@/lib/admin/master-primary-image";

export async function GET(_request: Request, { params }: { params: Promise<{ entity: string }> }) {
  try {
    const { entity } = await params;
    if (!isMasterEntity(entity)) throw new Error("Unknown entity");
    const tiers = entity === "artists" ? ["A"] : ["A", "B", "C"];
    return NextResponse.json(await masterAutoPrimaryMaintenance(entity, { tiers }));
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Dry run failed" }, { status: 400 });
  }
}

export async function POST(request: Request, { params }: { params: Promise<{ entity: string }> }) {
  try {
    const { entity } = await params;
    if (!isMasterEntity(entity)) throw new Error("Unknown entity");
    const body = await request.json().catch(() => ({}));
    const tiers = entity === "artists" ? ["A"] : ["A", "B", "C"];
    const result = await masterAutoPrimaryMaintenance(entity, { apply: true, tiers, limit: Number(body.limit) || undefined });
    revalidatePath(`/admin/${entity}`);
    return NextResponse.json({ ...result, message: `${result.applied}件をPrimary画像へ設定しました。Rights Statusは変更していません。` });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Auto primary failed" }, { status: 400 });
  }
}
