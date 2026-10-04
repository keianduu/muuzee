import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { validUuid } from "@/lib/admin/http";
import { applyOfficialVenueFields } from "@/lib/admin/venue-field-review-service";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    if (!validUuid(id)) throw new Error("Invalid venue ID");
    const body = await request.json() as { runId?: string; fields?: string[] };
    if (!body.runId || !validUuid(body.runId)) throw new Error("Invalid crawl run ID");
    const result = await applyOfficialVenueFields(createSupabaseAdminClient(), id, body.runId, Array.isArray(body.fields) ? body.fields : []);
    revalidatePath("/admin/venues");
    revalidatePath(`/admin/venues/${id}`);
    return NextResponse.json({ ...result, message: `${result.applied.length}項目を公式サイトから反映しました。` });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Official fields apply failed" }, { status: 400 });
  }
}
