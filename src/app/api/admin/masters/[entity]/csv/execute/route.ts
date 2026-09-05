import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { executeCsvImport, getCsvPreview } from "@/lib/admin/master-repository";
import { isMasterEntity } from "@/lib/admin/master-config";

export async function POST(request: Request, { params }: { params: Promise<{ entity: string }> }) {
  try {
    const { entity } = await params; if (!isMasterEntity(entity)) throw new Error("Unknown master entity");
    const body = await request.json();
    if (typeof body.csv !== "string" || !body.csv.trim()) throw new Error("Preview対象CSVがありません。");
    const freshPreview = await getCsvPreview(entity, body.csv);
    const result = await executeCsvImport(entity, freshPreview.rows, body.allowConflicts === true);
    revalidatePath("/admin"); revalidatePath(`/admin/${entity}`);
    return NextResponse.json({ ...result, message: "CSV Importを実行しました。" });
  } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "CSV import failed" }, { status: 400 }); }
}
