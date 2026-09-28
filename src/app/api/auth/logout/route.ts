import { type NextRequest } from "next/server";
import { authJsonResponse } from "@/lib/auth/http";
import { clearPasswordRecoveryMarker } from "@/lib/auth/recovery";
import { logoutCurrentSession } from "@/lib/auth/service";
import { createSupabaseRouteClient } from "@/lib/supabase/route";

export async function POST(request: NextRequest) {
  const { supabase, applyAuthState } = createSupabaseRouteClient(request);
  const result = logoutCurrentSession(supabase.auth);
  const response = await authJsonResponse(result, applyAuthState);
  clearPasswordRecoveryMarker(response);
  return response;
}
