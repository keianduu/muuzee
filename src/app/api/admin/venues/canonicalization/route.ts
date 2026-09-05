import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export async function GET() {
  try {
    const db = createSupabaseAdminClient();
    const { data, error } = await db.from("venue_canonical_merge_candidates")
      .select("*").in("review_status", ["pending", "held"]).order("confidence", { ascending: false });
    if (error) throw error;
    const rows = data || [];
    const venueIds = [...new Set(rows.flatMap((row) => [row.source_venue_id, row.candidate_venue_id]))];
    const { data: assets, error: assetError } = venueIds.length
      ? await db.from("media_assets").select("id,venue_id,storage_path,source_url,credit,rights_status,is_primary").in("venue_id", venueIds).eq("is_primary", true)
      : { data: [], error: null };
    if (assetError) throw assetError;
    const images = new Map<string, Record<string, unknown>>();
    for (const asset of assets || []) {
      const { data: signed } = await db.storage.from("exhibition-images").createSignedUrl(asset.storage_path, 3600);
      images.set(asset.venue_id, { ...asset, signed_url: signed?.signedUrl || null });
    }
    return NextResponse.json({
      rows: rows.map((row) => ({ ...row, source_image: images.get(row.source_venue_id) || null, candidate_image: images.get(row.candidate_venue_id) || null })),
      summary: {
        total: rows.length,
        high: rows.filter((row) => row.match_category === "HIGH").length,
        possible: rows.filter((row) => row.match_category === "POSSIBLE").length,
        held: rows.filter((row) => row.review_status === "held").length,
      },
    });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Canonical candidate lookup failed" }, { status: 400 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    if (!body.candidateId || !["merge", "separate", "hold"].includes(body.action)) throw new Error("Invalid review action");
    const db = createSupabaseAdminClient();
    const { data: candidate, error } = await db.from("venue_canonical_merge_candidates").select("*").eq("id", body.candidateId).single();
    if (error || !candidate) throw error || new Error("Candidate not found");
    if (body.action !== "merge") {
      const review_status = body.action === "separate" ? "separate" : "held";
      const { error: updateError } = await db.from("venue_canonical_merge_candidates").update({ review_status, reviewed_at: new Date().toISOString(), reviewed_by: "admin" }).eq("id", candidate.id);
      if (updateError) throw updateError;
      return NextResponse.json({ message: review_status === "separate" ? "別Venueとして記録しました。" : "判断を保留しました。" });
    }
    const canonicalVenueId = String(body.canonicalVenueId || candidate.canonical_venue_id);
    const sourceVenueId = canonicalVenueId === candidate.source_venue_id ? candidate.candidate_venue_id : candidate.source_venue_id;
    if (![candidate.source_venue_id, candidate.candidate_venue_id].includes(canonicalVenueId)) throw new Error("Canonical Venue must be one of the reviewed pair");
    const { data: mergeResult, error: mergeError } = await db.rpc("merge_venue_into_canonical", {
      p_source_venue_id: sourceVenueId,
      p_canonical_venue_id: canonicalVenueId,
      p_candidate_id: candidate.id,
      p_confidence: candidate.confidence,
      p_match_reasons: candidate.match_reasons,
      p_merge_method: "human_review",
    });
    if (mergeError) throw mergeError;
    revalidatePath("/admin/venues");
    return NextResponse.json({ message: "Canonical Venueへ統合しました。", result: mergeResult });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Canonical review failed" }, { status: 400 });
  }
}
