import { type NextRequest } from "next/server";
import { authJsonResponse, readAuthJson } from "@/lib/auth/http";
import { updatePassword } from "@/lib/auth/service";
import { createSupabaseRouteClient } from "@/lib/supabase/route";

export async function POST(request: NextRequest) {
  const input = await readAuthJson(request);
  const { supabase, applyAuthState } = createSupabaseRouteClient(request);
  const result = updatePassword(supabase.auth, input);
  return authJsonResponse(result, applyAuthState);
}
