import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { createMaster, listMasters } from "@/lib/admin/master-repository";
import { isMasterEntity } from "@/lib/admin/master-config";

export async function GET(request: Request, { params }: { params: Promise<{ entity: string }> }) {
  try {
    const { entity } = await params;
    if (!isMasterEntity(entity)) throw new Error("Unknown master entity");
    const query = new URL(request.url).searchParams;
    const result = await listMasters(entity, {
      q: query.get("q") || undefined,
      status: query.get("status") || undefined,
      type: query.get("type") || undefined,
      active: query.get("active") || undefined,
      image: query.get("image") || undefined,
      coordinates: query.get("coordinates") || undefined,
      source: query.get("source") || undefined,
      match: query.get("match") || undefined,
      completeness: query.get("completeness") || undefined,
      page: Number(query.get("page")),
      pageSize: Number(query.get("pageSize")),
    });
    return NextResponse.json(result, { status: result.error ? 500 : 200 });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "List failed" }, { status: 400 });
  }
}

export async function POST(request: Request, { params }: { params: Promise<{ entity: string }> }) {
  try {
    const { entity } = await params;
    if (!isMasterEntity(entity)) throw new Error("Unknown master entity");
    const id = await createMaster(entity, await request.json(), "manual");
    revalidatePath("/admin"); revalidatePath(`/admin/${entity}`);
    return NextResponse.json({ id, message: "Draftとして作成しました。" }, { status: 201 });
  } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "Create failed" }, { status: 400 }); }
}
