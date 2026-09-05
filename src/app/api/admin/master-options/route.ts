import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export async function GET(request: Request) {
  try {
    const url = new URL(request.url); const entity = url.searchParams.get("entity"); const q = (url.searchParams.get("q") || "").trim();
    if (entity !== "artists" && entity !== "venues") throw new Error("ArtistsまたはVenuesを指定してください。");
    const titleKey = "name";
    let query = createSupabaseAdminClient().from(entity).select(`id,${titleKey}`).order(titleKey).limit(20);
    if (q) query = query.ilike(titleKey, `%${q.replaceAll("%", "\\%")}%`);
    const { data, error } = await query; if (error) throw error;
    return NextResponse.json({ options: data || [] });
  } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "Search failed" }, { status: 400 }); }
}
