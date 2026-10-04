import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { validUuid } from "@/lib/admin/http";
import { setVenuePrimaryFromCandidate } from "@/lib/admin/venue-primary-image";
import { signedMediaAsset } from "@/lib/admin/media-asset-response";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export async function POST(_request: Request, { params }: { params: Promise<{ id: string; candidateId: string }> }) {
  try {
    const { id, candidateId } = await params;
    if (!validUuid(id) || !validUuid(candidateId)) throw new Error("Invalid ID");

    const result = await setVenuePrimaryFromCandidate(id, candidateId, { replaceExisting: true });
    const asset = result.assetId ? await signedMediaAsset(createSupabaseAdminClient(), result.assetId) : null;

    revalidatePath("/admin/venues");
    revalidatePath(`/admin/venues/${id}`);
    return NextResponse.json({ ...result, asset, message: "候補画像をPrimary画像に設定しました。" });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "候補画像の設定に失敗しました。" }, { status: 400 });
  }
}
