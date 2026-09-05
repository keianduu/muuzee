import { NextResponse } from "next/server";
import { getCsvPreview } from "@/lib/admin/master-repository";
import { isMasterEntity } from "@/lib/admin/master-config";

export async function POST(request: Request, { params }: { params: Promise<{ entity: string }> }) {
  try {
    const { entity } = await params; if (!isMasterEntity(entity)) throw new Error("Unknown master entity");
    const form = await request.formData(); const file = form.get("file");
    if (!(file instanceof File)) throw new Error("CSVファイルを選択してください。");
    if (file.size > 5 * 1024 * 1024) throw new Error("CSVは5MB以下にしてください。");
    return NextResponse.json(await getCsvPreview(entity, await file.text()));
  } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "CSV preview failed" }, { status: 400 }); }
}
