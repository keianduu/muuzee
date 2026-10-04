import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { validUuid } from "@/lib/admin/http";
import { reviewVenueCoordinateCandidate } from "@/lib/admin/venue-coordinate-review";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string; candidateId: string }> }) {
  try {
    const { id, candidateId } = await params;
    if (!validUuid(id) || !validUuid(candidateId)) throw new Error("Invalid ID");
    const body = await request.json() as { action?: "accept" | "reject" };
    if (body.action !== "accept" && body.action !== "reject") throw new Error("Unsupported coordinate review action");
    const result = await reviewVenueCoordinateCandidate(createSupabaseAdminClient(), id, candidateId, body.action);
    revalidatePath("/admin/venues");
    revalidatePath(`/admin/venues/${id}`);
    return NextResponse.json({ ...result, message: body.action === "accept" ? "位置情報候補を採用しました。" : "位置情報候補を非採用にしました。" });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Coordinate review failed" }, { status: 400 });
  }
}
