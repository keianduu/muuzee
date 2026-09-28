import { type NextRequest } from "next/server";
import { authJsonResponse } from "@/lib/auth/http";
import { logoutCurrentSession } from "@/lib/auth/service";
import { createSupabaseRouteClient } from "@/lib/supabase/route";

export async function POST(request: NextRequest) {
  const { supabase, applyAuthState } = createSupabaseRouteClient(request);
  const result = logoutCurrentSession(supabase.auth);
  return authJsonResponse(result, applyAuthState);
}
