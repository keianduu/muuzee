import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { rematchUnresolvedWorkCandidateVenues } from "@/lib/work-collection/targeted";

export async function POST() {
  try {
    const result = await rematchUnresolvedWorkCandidateVenues();
    revalidatePath("/admin/works");
    return NextResponse.json({ message: "未照合のWork候補をShared Venue Resolverで再照合しました。", ...result });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Venue rematch failed" }, { status: 400 });
  }
}
