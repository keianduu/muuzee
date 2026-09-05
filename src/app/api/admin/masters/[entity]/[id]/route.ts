import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { validUuid } from "@/lib/admin/http";
import { deleteMaster, getMaster, updateMaster } from "@/lib/admin/master-repository";
import { isMasterEntity } from "@/lib/admin/master-config";

function check(entity: string, id: string) {
  if (!isMasterEntity(entity)) throw new Error("Unknown master entity");
  if (!validUuid(id)) throw new Error("Invalid master ID");
  return entity;
}

export async function GET(_: Request, { params }: { params: Promise<{ entity: string; id: string }> }) {
  try {
    const { entity, id } = await params; const validEntity = check(entity, id);
    const result = await getMaster(validEntity, id);
    if (!result.data) return NextResponse.json({ error: result.error || "Masterが見つかりません。" }, { status: 404 });
    return NextResponse.json(result.data);
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Detail fetch failed" }, { status: 400 });
  }
}

export async function PATCH(request: Request, { params }: { params: Promise<{ entity: string; id: string }> }) {
  try {
    const { entity, id } = await params; const validEntity = check(entity, id);
    const changed = await updateMaster(validEntity, id, await request.json(), "manual");
    revalidatePath("/admin"); revalidatePath(`/admin/${validEntity}`); revalidatePath(`/admin/${validEntity}/${id}`);
    return NextResponse.json({ changed, message: changed.length ? `保存しました（${changed.join("、")}）。` : "変更はありません。" });
  } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "Save failed" }, { status: 400 }); }
}

export async function DELETE(_: Request, { params }: { params: Promise<{ entity: string; id: string }> }) {
  try {
    const { entity, id } = await params; const validEntity = check(entity, id);
    await deleteMaster(validEntity, id);
    revalidatePath("/admin"); revalidatePath(`/admin/${validEntity}`);
    return NextResponse.json({ message: "削除しました。" });
  } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "Delete failed" }, { status: 409 }); }
}
