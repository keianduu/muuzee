import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { validUuid } from "@/lib/admin/http";
import { setMasterPublication } from "@/lib/admin/master-repository";
import { isMasterEntity } from "@/lib/admin/master-config";

export async function POST(request: Request, { params }: { params: Promise<{ entity: string; id: string }> }) {
  try {
    const { entity, id } = await params;
    if (!isMasterEntity(entity) || !validUuid(id)) throw new Error("Invalid master");
    const body = await request.json();
    if (body.action !== "publish" && body.action !== "unpublish") throw new Error("Invalid action");
    const result = await setMasterPublication(entity, [id], body.action);
    revalidatePath("/admin"); revalidatePath(`/admin/${entity}`); revalidatePath(`/admin/${entity}/${id}`);
    return NextResponse.json({ ...result, message: `${result.status}に変更しました。` });
  } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "Publication failed" }, { status: 400 }); }
}
