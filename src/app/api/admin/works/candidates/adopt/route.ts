import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { adoptWorkCandidates } from "@/lib/work-collection/adoption";
import { listWorkImportCandidates } from "@/lib/work-collection/targeted";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const candidateIds = Array.isArray(body.candidateIds) ? body.candidateIds.filter((id: unknown) => typeof id === "string").slice(0, 20) : [];
    if (!candidateIds.length) return NextResponse.json({ error: "採用するCandidateを選択してください。" }, { status: 400 });
    const results = await adoptWorkCandidates(candidateIds);
    revalidatePath("/admin/works");
    const created = results.filter((result: { created?: boolean }) => result.created).length;
    const existing = results.length - created;
    return NextResponse.json({ message: `Work Master作成 ${created}件 / 採用済み ${existing}件を確認しました。`, results, candidateRows: await listWorkImportCandidates() });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Work adoption failed" }, { status: 400 });
  }
}
