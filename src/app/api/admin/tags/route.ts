import { NextResponse } from "next/server";
import { nullableText } from "@/lib/admin/http";
import { isAdminTagType } from "@/lib/admin/tags";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

function escapePostgrestSearch(value: string) {
  return value.replaceAll("\\", "\\\\").replaceAll("%", "\\%").replaceAll("_", "\\_").replaceAll(",", "\\,");
}

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const q = nullableText(url.searchParams.get("q"));
    const type = nullableText(url.searchParams.get("type"));
    if (type && !isAdminTagType(type)) {
      return NextResponse.json({ error: "対応するTag種別を指定してください。" }, { status: 400 });
    }

    let query = createSupabaseAdminClient().from("tags").select("id,type,name,slug").order("type").order("name");
    if (type) query = query.eq("type", type);
    if (q) {
      const term = escapePostgrestSearch(q);
      query = query.or(`name.ilike.%${term}%,slug.ilike.%${term}%`);
    }
    const { data, error } = await query;
    if (error) throw error;
    return NextResponse.json({ tags: data || [] });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Tag search failed" }, { status: 400 });
  }
}
