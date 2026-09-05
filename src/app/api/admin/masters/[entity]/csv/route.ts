import { NextResponse } from "next/server";
import { createCsv, createCsvTemplate } from "@/lib/admin/master-csv";
import { fetchAllMasters } from "@/lib/admin/master-repository";
import { isMasterEntity } from "@/lib/admin/master-config";

export async function GET(request: Request, { params }: { params: Promise<{ entity: string }> }) {
  try {
    const { entity } = await params; if (!isMasterEntity(entity)) throw new Error("Unknown master entity");
    const url = new URL(request.url); const mode = url.searchParams.get("mode") || "all";
    const rows = mode === "template" ? [] : await fetchAllMasters(entity);
    const content = mode === "template" ? createCsvTemplate(entity) : createCsv(entity, rows);
    const filename = `muuzee-${entity}-${mode}-${new Date().toISOString().slice(0, 10)}.csv`;
    return new NextResponse(`\uFEFF${content}`, { headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="${filename}"` } });
  } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "CSV export failed" }, { status: 400 }); }
}
