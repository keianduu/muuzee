import { type NextRequest } from "next/server";
import { authJsonResponse, readAuthJson } from "@/lib/auth/http";
import {
  clearPasswordRecoveryMarker,
  createPasswordRecoveryCallbackState,
} from "@/lib/auth/recovery";
import { clearAccountLifecycleMarker } from "@/lib/account-lifecycle/marker";
import { requestPasswordRecovery } from "@/lib/auth/service";
import { buildAuthCallbackUrl } from "@/lib/auth/validation";
import { createSupabaseRouteClient } from "@/lib/supabase/route";

export async function POST(request: NextRequest) {
  const input = await readAuthJson(request);
  const { supabase, applyAuthState } = createSupabaseRouteClient(request);
  const result = requestPasswordRecovery(supabase.auth, {
    email: input.email,
    buildRedirectTo: (normalizedEmail) => buildAuthCallbackUrl(
      request.nextUrl.origin,
      "recovery",
      typeof input.returnTo === "string" ? input.returnTo : null,
      { recoveryState: createPasswordRecoveryCallbackState(normalizedEmail) },
    ),
  });
  const response = await authJsonResponse(result, applyAuthState);
  clearPasswordRecoveryMarker(response);
  clearAccountLifecycleMarker(response);
  return response;
}
