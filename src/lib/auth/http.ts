import { NextResponse } from "next/server";
import { authError } from "./errors";
import type { AuthOperationResult } from "./types";

export async function readAuthJson(request: Request): Promise<Record<string, unknown>> {
  try {
    const body = await request.json();
    return body && typeof body === "object" && !Array.isArray(body)
      ? body as Record<string, unknown>
      : {};
  } catch {
    return {};
  }
}

function resultStatus(result: AuthOperationResult) {
  if (result.ok) return 200;
  switch (result.error.code) {
    case "invalid_input":
    case "expired_or_invalid_link":
      return 400;
    case "invalid_credentials":
    case "unauthenticated":
      return 401;
    case "rate_limited":
      return 429;
    case "temporary":
      return 503;
  }
}

export async function authJsonResponse(
  operation: AuthOperationResult | Promise<AuthOperationResult>,
  applyAuthState: (response: NextResponse) => NextResponse,
) {
  let result: AuthOperationResult;
  try {
    result = await operation;
  } catch {
    result = authError("temporary", true);
  }
  return applyAuthState(NextResponse.json(result, { status: resultStatus(result) }));
}
