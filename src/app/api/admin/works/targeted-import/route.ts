import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { listWorkImportCandidates, targetedWorkCoverage } from "@/lib/work-collection/targeted";

export async function GET() {
  try { return NextResponse.json({ candidateRows: await listWorkImportCandidates() }); }
  catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "Candidate load failed" }, { status: 400 }); }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const result = await targetedWorkCoverage({ limit: Number(body.limit) || 20, saveCandidates: Boolean(body.saveCandidates) });
    revalidatePath("/admin/works");
    return NextResponse.json({ message: body.saveCandidates ? "Work候補を保存しました。Masterへは未反映です。" : "Work source coverageを確認しました。", ...result, candidateRows: body.saveCandidates ? await listWorkImportCandidates() : [] });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Work targeted import failed" }, { status: 400 });
  }
}
