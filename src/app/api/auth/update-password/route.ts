import { type NextRequest } from "next/server";
import { authError } from "@/lib/auth/errors";
import { authJsonResponse, readAuthJson } from "@/lib/auth/http";
import {
  clearPasswordRecoveryMarker,
  hasPasswordRecoveryMarker,
} from "@/lib/auth/recovery";
import { updatePassword } from "@/lib/auth/service";
import type { AuthOperationResult } from "@/lib/auth/types";
import { createSupabaseRouteClient } from "@/lib/supabase/route";

export async function POST(request: NextRequest) {
  const input = await readAuthJson(request);
  const { supabase, applyAuthState } = createSupabaseRouteClient(request);
  let result: AuthOperationResult;
  try {
    result = hasPasswordRecoveryMarker(request.cookies)
      ? await updatePassword(supabase.auth, input)
      : authError("expired_or_invalid_link");
  } catch {
    result = authError("temporary", true);
  }
  const response = await authJsonResponse(result, applyAuthState);

  if (
    (result.ok && result.status === "password_updated")
    || (!result.ok && ["expired_or_invalid_link", "unauthenticated"].includes(result.error.code))
  ) {
    clearPasswordRecoveryMarker(response);
  }

  return response;
}
