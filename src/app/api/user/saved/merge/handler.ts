import { type NextRequest, NextResponse } from "next/server";
import { UserDataError } from "@/lib/user/errors";
import type { EntityRef, MergeSavedResult } from "@/lib/user/types";

type MergeOperation = (refs: EntityRef[]) => Promise<MergeSavedResult>;

function errorStatus(error: UserDataError) {
  if (error.code === "unauthenticated") return 401;
  if (error.code === "forbidden") return 403;
  if (error.code === "invalid_input" || error.code === "invalid_target") return 400;
  if (error.code === "not_found") return 404;
  return error.retryable ? 503 : 500;
}

export function createMergeSavedPost(merge: MergeOperation) {
  return async function POST(request: NextRequest) {
    try {
      if (!request.headers.get("content-type")?.toLowerCase().includes("application/json")) {
        throw new UserDataError("invalid_input");
      }
      const body: unknown = await request.json().catch(() => null);
      if (!body || typeof body !== "object" || Array.isArray(body)) throw new UserDataError("invalid_input");
      const record = body as Record<string, unknown>;
      if (Object.keys(record).length !== 1 || !Array.isArray(record.refs)) throw new UserDataError("invalid_input");
      return NextResponse.json(await merge(record.refs as EntityRef[]));
    } catch (error) {
      const safe = error instanceof UserDataError ? error : new UserDataError("temporary", true);
      return NextResponse.json(
        { error: { code: safe.code, retryable: safe.retryable } },
        { status: errorStatus(safe) },
      );
    }
  };
}
