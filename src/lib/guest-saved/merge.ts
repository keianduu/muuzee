"use client";

import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import type { UserDataErrorCode } from "@/lib/user/errors";
import type { MergeSavedFailure, MergeSavedResult } from "@/lib/user/types";
import {
  canonicalEntityRefs,
  consumeGuestSaved,
  getBrowserGuestSavedStorage,
  readGuestSaved,
  type GuestSavedStorage,
} from "./store";

export const GUEST_SAVED_MERGE_BATCH_LIMIT = 50;

const USER_DATA_ERROR_CODES = new Set<UserDataErrorCode>([
  "unauthenticated",
  "invalid_input",
  "invalid_target",
  "forbidden",
  "not_found",
  "temporary",
  "data_integrity",
]);

type RequestWideError = {
  code: UserDataErrorCode;
  retryable: boolean;
};

export type GuestSavedMergeOutcome = {
  status: "empty" | "merged" | "partial" | "unauthenticated" | "request_error" | "storage_unavailable" | "temporary";
  merged: number;
  failed: MergeSavedFailure[];
  retryable: boolean;
  error?: RequestWideError;
};

type MergeDependencies = {
  storage?: GuestSavedStorage | null;
  fetcher?: typeof fetch;
  isAuthenticated?: () => Promise<boolean>;
};

let mergeInFlight: Promise<GuestSavedMergeOutcome> | null = null;

async function hasAuthenticatedBrowserSession() {
  try {
    const { data, error } = await createSupabaseBrowserClient().auth.getClaims();
    return !error && typeof data?.claims?.sub === "string";
  } catch {
    return false;
  }
}

function temporaryOutcome(merged = 0, failed: MergeSavedFailure[] = []): GuestSavedMergeOutcome {
  return {
    status: merged ? "partial" : "temporary",
    merged,
    failed,
    retryable: true,
    error: { code: "temporary", retryable: true },
  };
}

function safeRequestWideError(input: unknown): RequestWideError | null {
  if (!input || typeof input !== "object" || Array.isArray(input)) return null;
  const error = (input as Record<string, unknown>).error;
  if (!error || typeof error !== "object" || Array.isArray(error)) return null;
  const record = error as Record<string, unknown>;
  if (typeof record.code !== "string" || !USER_DATA_ERROR_CODES.has(record.code as UserDataErrorCode)) return null;
  if (typeof record.retryable !== "boolean") return null;
  return { code: record.code as UserDataErrorCode, retryable: record.retryable };
}

function safeMergeResult(input: unknown, requested: Set<string>): MergeSavedResult | null {
  if (!input || typeof input !== "object" || Array.isArray(input)) return null;
  const record = input as Record<string, unknown>;
  if (!Array.isArray(record.merged) || !Array.isArray(record.failed)) return null;
  const merged = canonicalEntityRefs(record.merged).filter((ref) => requested.has(`${ref.kind}:${ref.id}`));
  const failed = record.failed.flatMap((item): MergeSavedFailure[] => {
    if (!item || typeof item !== "object" || Array.isArray(item)) return [];
    const failure = item as Record<string, unknown>;
    const refs = canonicalEntityRefs([failure.ref]);
    const ref = refs[0];
    if (!ref || !requested.has(`${ref.kind}:${ref.id}`) || typeof failure.code !== "string" || !USER_DATA_ERROR_CODES.has(failure.code as UserDataErrorCode) || typeof failure.retryable !== "boolean") {
      return [];
    }
    return [{ ref, code: failure.code as MergeSavedFailure["code"], retryable: failure.retryable }];
  });
  const outcomeKeys = [...merged, ...failed.map((failure) => failure.ref)].map((ref) => `${ref.kind}:${ref.id}`);
  if (new Set(outcomeKeys).size !== outcomeKeys.length || outcomeKeys.length !== requested.size) return null;
  return { merged, failed };
}

async function runMerge(dependencies: MergeDependencies): Promise<GuestSavedMergeOutcome> {
  const storage = dependencies.storage === undefined ? getBrowserGuestSavedStorage() : dependencies.storage;
  const initial = readGuestSaved(storage);
  if (!initial.ok) return { status: "storage_unavailable", merged: 0, failed: [], retryable: true };
  if (!initial.value.length) return { status: "empty", merged: 0, failed: [], retryable: false };

  const isAuthenticated = dependencies.isAuthenticated ?? hasAuthenticatedBrowserSession;
  if (!await isAuthenticated()) {
    return {
      status: "unauthenticated",
      merged: 0,
      failed: [],
      retryable: false,
      error: { code: "unauthenticated", retryable: false },
    };
  }

  const fetcher = dependencies.fetcher ?? fetch;
  let mergedCount = 0;
  const failures: MergeSavedFailure[] = [];

  for (let offset = 0; offset < initial.value.length; offset += GUEST_SAVED_MERGE_BATCH_LIMIT) {
    const refs = initial.value.slice(offset, offset + GUEST_SAVED_MERGE_BATCH_LIMIT);
    let response: Response;
    try {
      response = await fetcher("/api/user/saved/merge", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ refs }),
      });
    } catch {
      return temporaryOutcome(mergedCount, failures);
    }

    if (!response.ok) {
      const body = await response.json().catch(() => null);
      const error = safeRequestWideError(body) ?? { code: "temporary" as const, retryable: true };
      return {
        status: error.code === "unauthenticated"
          ? "unauthenticated"
          : error.code === "temporary"
            ? "temporary"
            : "request_error",
        merged: mergedCount,
        failed: failures,
        retryable: error.retryable || failures.some((failure) => failure.retryable),
        error,
      };
    }

    const body = await response.json().catch(() => null);
    const requested = new Set(refs.map((ref) => `${ref.kind}:${ref.id}`));
    const result = safeMergeResult(body, requested);
    if (!result) return temporaryOutcome(mergedCount, failures);

    const cleanup = consumeGuestSaved(result.merged, storage);
    if (!cleanup.ok) {
      return { status: "storage_unavailable", merged: mergedCount + result.merged.length, failed: [...failures, ...result.failed], retryable: true };
    }
    mergedCount += result.merged.length;
    failures.push(...result.failed);
  }

  return failures.length
    ? { status: "partial", merged: mergedCount, failed: failures, retryable: failures.some((failure) => failure.retryable) }
    : { status: "merged", merged: mergedCount, failed: [], retryable: false };
}

export function mergeGuestSaved(dependencies: MergeDependencies = {}): Promise<GuestSavedMergeOutcome> {
  if (mergeInFlight) return mergeInFlight;
  mergeInFlight = runMerge(dependencies).finally(() => {
    mergeInFlight = null;
  });
  return mergeInFlight;
}
