import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { validUuid } from "@/lib/admin/http";
import { normalizeSourcePolicyInput } from "@/lib/admin/source-policy";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    if (!validUuid(id)) throw new Error("Invalid source ID");
    const input = normalizeSourcePolicyInput(await request.json());
    const db = createSupabaseAdminClient();
    const { data: source, error: sourceError } = await db.from("data_sources").select("id,name").eq("id", id).single();
    if (sourceError || !source) throw sourceError || new Error("Source not found");
    const { data, error } = await db.from("data_source_assertion_policies").upsert({
      data_source_id: id,
      assertion_type: input.assertionType,
      enabled: input.enabled,
      auto_apply: input.autoApply,
      default_visibility: input.defaultVisibility,
      review_required: input.reviewRequired,
    }, { onConflict: "data_source_id,assertion_type" }).select("id,data_source_id,assertion_type,enabled,auto_apply,default_visibility,review_required").single();
    if (error) throw error;
    revalidatePath("/admin/sources");
    return NextResponse.json({ sourceName: source.name, policy: data });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Policy update failed" }, { status: 400 });
  }
}
