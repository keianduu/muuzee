import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { validUuid } from "@/lib/admin/http";
import { setVenuePrimaryFromCandidate } from "@/lib/admin/venue-primary-image";

export async function POST(_request: Request, { params }: { params: Promise<{ id: string; candidateId: string }> }) {
  try {
    const { id, candidateId } = await params;
    if (!validUuid(id) || !validUuid(candidateId)) throw new Error("Invalid ID");

    await setVenuePrimaryFromCandidate(id, candidateId, { replaceExisting: true });

    revalidatePath("/admin/venues");
    revalidatePath(`/admin/venues/${id}`);
    return NextResponse.json({ message: "候補画像をPrimary画像に設定しました。" });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "候補画像の設定に失敗しました。" }, { status: 400 });
  }
}
