import { NextResponse } from "next/server";
import type { AccountLifecycleErrorCode, AccountLifecycleResult } from "./types";

export async function readLifecycleJson(request: Request): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    return null;
  }
}

function statusFor(code: AccountLifecycleErrorCode) {
  switch (code) {
    case "invalid_input": return 400;
    case "unauthenticated": return 401;
    case "invalid_credentials": return 401;
    case "reauthentication_required": return 403;
    case "storage_cleanup_required": return 409;
    case "temporary": return 503;
  }
}

export function lifecycleJsonResponse<T>(result: AccountLifecycleResult<T>) {
  return NextResponse.json(result, { status: result.ok ? 200 : statusFor(result.error.code) });
}
