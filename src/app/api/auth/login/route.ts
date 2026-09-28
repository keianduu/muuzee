import { type NextRequest } from "next/server";
import { authJsonResponse, readAuthJson } from "@/lib/auth/http";
import { clearPasswordRecoveryMarker } from "@/lib/auth/recovery";
import { loginWithPassword } from "@/lib/auth/service";
import { createSupabaseRouteClient } from "@/lib/supabase/route";

export async function POST(request: NextRequest) {
  const input = await readAuthJson(request);
  const { supabase, applyAuthState } = createSupabaseRouteClient(request);
  const result = loginWithPassword(supabase.auth, input);
  const response = await authJsonResponse(result, applyAuthState);
  clearPasswordRecoveryMarker(response);
  return response;
}
