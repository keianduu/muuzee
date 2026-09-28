import { type NextRequest } from "next/server";
import { authJsonResponse, readAuthJson } from "@/lib/auth/http";
import { registerWithPassword } from "@/lib/auth/service";
import { buildAuthCallbackUrl } from "@/lib/auth/validation";
import { createSupabaseRouteClient } from "@/lib/supabase/route";

export async function POST(request: NextRequest) {
  const input = await readAuthJson(request);
  const { supabase, applyAuthState } = createSupabaseRouteClient(request);
  const result = registerWithPassword(supabase.auth, {
    email: input.email,
    password: input.password,
    emailRedirectTo: buildAuthCallbackUrl(
      request.nextUrl.origin,
      "confirmation",
      typeof input.returnTo === "string" ? input.returnTo : null,
    ),
  });
  return authJsonResponse(result, applyAuthState);
}
