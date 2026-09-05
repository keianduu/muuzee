import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { setMasterPublication } from "@/lib/admin/master-repository";
import { isMasterEntity } from "@/lib/admin/master-config";
import { validUuid } from "@/lib/admin/http";

export async function POST(request: Request, { params }: { params: Promise<{ entity: string }> }) {
  try {
    const { entity } = await params; if (!isMasterEntity(entity)) throw new Error("Unknown master entity");
    const { ids, action } = await request.json();
    if (!Array.isArray(ids) || !ids.length || ids.some((id) => typeof id !== "string" || !validUuid(id))) throw new Error("対象を選択してください。");
    if (action !== "publish" && action !== "unpublish") throw new Error("Invalid action");
    const result = await setMasterPublication(entity, ids, action);
    revalidatePath("/admin"); revalidatePath(`/admin/${entity}`);
    return NextResponse.json({ ...result, message: `${result.count}件を${result.status}に変更しました。` });
  } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "Bulk update failed" }, { status: 400 }); }
}
