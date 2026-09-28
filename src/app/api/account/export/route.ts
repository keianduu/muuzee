import { type NextRequest, NextResponse } from "next/server";
import { exportAccountData } from "@/lib/account-lifecycle/service";
import { lifecycleJsonResponse } from "@/lib/account-lifecycle/http";
import { createSupabaseRouteClient } from "@/lib/supabase/route";

export async function GET(request: NextRequest) {
  const { supabase, applyAuthState } = createSupabaseRouteClient(request);
  const result = await exportAccountData(supabase);
  if (!result.ok) return applyAuthState(lifecycleJsonResponse(result));

  return applyAuthState(new NextResponse(JSON.stringify(result.data, null, 2), {
    status: 200,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": 'attachment; filename="muuzee-account-data.json"',
      "Cache-Control": "private, no-store",
    },
  }));
}
