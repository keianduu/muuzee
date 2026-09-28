import { type NextRequest, NextResponse } from "next/server";
import { authError } from "@/lib/auth/errors";
import { clearAccountLifecycleMarker } from "@/lib/account-lifecycle/marker";
import {
  clearPasswordRecoveryMarker,
  createPasswordRecoveryMarker,
  setPasswordRecoveryMarker,
  verifyPasswordRecoveryCallbackState,
} from "@/lib/auth/recovery";
import { completeAuthCallback } from "@/lib/auth/service";
import {
  buildFinalAuthRedirect,
  DEFAULT_AUTH_RETURN_TO,
  PASSWORD_RECOVERY_RETURN_TO,
  resolveSafeReturnTo,
  validateEmail,
} from "@/lib/auth/validation";
import type { AuthCallbackIntent } from "@/lib/auth/types";
import { createSupabaseRouteClient } from "@/lib/supabase/route";

function callbackIntent(value: string | null): AuthCallbackIntent | null {
  return value === "confirmation" || value === "recovery" ? value : null;
}

export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const intent = callbackIntent(searchParams.get("intent"));
  const code = searchParams.get("code");
  const tokenHash = searchParams.get("token_hash");
  const recoveryState = searchParams.get("recovery_state");
  const fallback = intent === "recovery" ? PASSWORD_RECOVERY_RETURN_TO : DEFAULT_AUTH_RETURN_TO;
  const returnTo = resolveSafeReturnTo(searchParams.get("returnTo"), fallback);
  const { supabase, applyAuthState } = createSupabaseRouteClient(request);
  let result;
  try {
    result = await completeAuthCallback(supabase.auth, {
      code,
      tokenHash,
      type: searchParams.get("type"),
      intent,
    });
  } catch {
    result = authError("temporary", true);
  }

  let recoveryMarker: string | null = null;
  const providerRecovery = result.ok && result.transition?.source === "recovery";
  const pkceRecoveryCandidate = result.ok
    && Boolean(code)
    && (intent === "recovery" || recoveryState !== null);

  if (pkceRecoveryCandidate && !recoveryState) {
    result = authError("expired_or_invalid_link");
  } else if (providerRecovery || pkceRecoveryCandidate) {
    try {
      const { data, error } = await supabase.auth.getUser();
      if (error || !data.user) {
        result = authError("unauthenticated");
      } else if (pkceRecoveryCandidate) {
        const email = validateEmail(data.user.email);
        if (
          !email.ok
          || !verifyPasswordRecoveryCallbackState(recoveryState, email.email)
        ) {
          result = authError("expired_or_invalid_link");
        } else {
          recoveryMarker = createPasswordRecoveryMarker(data.user.id);
        }
      } else {
        recoveryMarker = createPasswordRecoveryMarker(data.user.id);
      }
    } catch {
      result = authError("temporary", true);
    }
  }

  const destination = result.ok
    ? buildFinalAuthRedirect(origin, returnTo)
    : buildFinalAuthRedirect(origin, DEFAULT_AUTH_RETURN_TO, result.error.code);
  const response = applyAuthState(NextResponse.redirect(destination));

  // A recovery-purpose marker must never survive an unrelated callback.
  clearPasswordRecoveryMarker(response);
  clearAccountLifecycleMarker(response);
  if (recoveryMarker) {
    setPasswordRecoveryMarker(response, recoveryMarker);
  }

  return response;
}
