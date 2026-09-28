import { type NextRequest } from "next/server";
import { authError, mapAuthProviderError } from "@/lib/auth/errors";
import { authJsonResponse, readAuthJson } from "@/lib/auth/http";
import {
  clearPasswordRecoveryMarker,
  readPasswordRecoveryMarker,
  verifyPasswordRecoveryMarker,
} from "@/lib/auth/recovery";
import { clearAccountLifecycleMarker } from "@/lib/account-lifecycle/marker";
import { updatePassword } from "@/lib/auth/service";
import type { AuthOperationResult } from "@/lib/auth/types";
import { validatePassword } from "@/lib/auth/validation";
import { createSupabaseRouteClient } from "@/lib/supabase/route";

export async function POST(request: NextRequest) {
  const input = await readAuthJson(request);
  const { supabase, applyAuthState } = createSupabaseRouteClient(request);
  let result: AuthOperationResult;
  try {
    const validated = validatePassword(input.password);
    if (!validated.ok) {
      result = validated;
    } else {
      const { data, error } = await supabase.auth.getUser();
      if (error || !data.user) {
        result = mapAuthProviderError(error, "authenticated");
      } else if (!verifyPasswordRecoveryMarker(
        readPasswordRecoveryMarker(request.cookies),
        data.user.id,
      )) {
        result = authError("expired_or_invalid_link");
      } else {
        result = await updatePassword(
          supabase.auth,
          { password: validated.password },
          data.user.id,
        );
      }
    }
  } catch {
    result = authError("temporary", true);
  }
  const response = await authJsonResponse(result, applyAuthState);

  if (
    (result.ok && result.status === "password_updated")
    || (!result.ok && ["expired_or_invalid_link", "unauthenticated"].includes(result.error.code))
  ) {
    clearPasswordRecoveryMarker(response);
    clearAccountLifecycleMarker(response);
  }

  return response;
}
