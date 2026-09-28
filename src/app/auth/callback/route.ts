import { type NextRequest, NextResponse } from "next/server";
import { authError } from "@/lib/auth/errors";
import { completeAuthCallback } from "@/lib/auth/service";
import {
  buildFinalAuthRedirect,
  DEFAULT_AUTH_RETURN_TO,
  PASSWORD_RECOVERY_RETURN_TO,
  resolveSafeReturnTo,
} from "@/lib/auth/validation";
import type { AuthCallbackIntent } from "@/lib/auth/types";
import { createSupabaseRouteClient } from "@/lib/supabase/route";

function callbackIntent(value: string | null): AuthCallbackIntent | null {
  return value === "confirmation" || value === "recovery" ? value : null;
}

export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const intent = callbackIntent(searchParams.get("intent"));
  const fallback = intent === "recovery" ? PASSWORD_RECOVERY_RETURN_TO : DEFAULT_AUTH_RETURN_TO;
  const returnTo = resolveSafeReturnTo(searchParams.get("returnTo"), fallback);
  const { supabase, applyAuthState } = createSupabaseRouteClient(request);
  let result;
  try {
    result = await completeAuthCallback(supabase.auth, {
      code: searchParams.get("code"),
      tokenHash: searchParams.get("token_hash"),
      type: searchParams.get("type"),
      intent,
    });
  } catch {
    result = authError("temporary", true);
  }

  const destination = result.ok
    ? buildFinalAuthRedirect(origin, returnTo)
    : buildFinalAuthRedirect(origin, DEFAULT_AUTH_RETURN_TO, result.error.code);
  return applyAuthState(NextResponse.redirect(destination));
}
