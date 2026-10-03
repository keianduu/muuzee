import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { masterOptionLabel } from "@/lib/admin/master-options";

export async function GET(request: Request) {
  try {
    const url = new URL(request.url); const entity = url.searchParams.get("entity"); const q = (url.searchParams.get("q") || "").trim();
    if (!["artists", "venues", "works", "exhibitions"].includes(entity || "")) throw new Error("対応するMasterを指定してください。");
    const table = entity as "artists" | "venues" | "works" | "exhibitions";
    const titleKey = table === "exhibitions" ? "title" : table === "works" ? "title_ja" : "name";
    const select = table === "works" ? "id,title,title_ja,title_en,title_original,original_language" : `id,${titleKey}`;
    let query = createSupabaseAdminClient().from(table).select(select).order(titleKey).limit(20);
    if (q) {
      const term = q.replaceAll("\\", "\\\\").replaceAll("%", "\\%").replaceAll("_", "\\_").replaceAll(",", "\\,");
      query = table === "works"
        ? query.or(`title.ilike.%${term}%,title_ja.ilike.%${term}%,title_en.ilike.%${term}%,title_original.ilike.%${term}%`)
        : query.ilike(titleKey, `%${term}%`);
    }
    const { data, error } = await query; if (error) throw error;
    return NextResponse.json({ options: ((data || []) as unknown as Array<Record<string, unknown>>).map((row) => ({ id: String(row.id), name: masterOptionLabel(table, row) })) });
  } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "Search failed" }, { status: 400 }); }
}
