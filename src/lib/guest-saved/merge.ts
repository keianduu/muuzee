"use client";

import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import type { MergeSavedFailure, MergeSavedResult } from "@/lib/user/types";
import {
  canonicalEntityRefs,
  consumeGuestSaved,
  getBrowserGuestSavedStorage,
  readGuestSaved,
  type GuestSavedStorage,
} from "./store";

export const GUEST_SAVED_MERGE_BATCH_LIMIT = 50;

export type GuestSavedMergeOutcome = {
  status: "empty" | "merged" | "partial" | "unauthenticated" | "storage_unavailable" | "temporary";
  merged: number;
  failed: MergeSavedFailure[];
  retryable: boolean;
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
  return { status: merged ? "partial" : "temporary", merged, failed, retryable: true };
}

function safeMergeResult(input: unknown, requested: Set<string>): MergeSavedResult | null {
  if (!input || typeof input !== "object" || Array.isArray(input)) return null;
  const record = input as Record<string, unknown>;
  if (!Array.isArray(record.merged) || !Array.isArray(record.failed)) return null;
  const merged = canonicalEntityRefs(record.merged).filter((ref) => requested.has(`${ref.kind}:${ref.id}`));
  const safeCodes = new Set(["unauthenticated", "invalid_input", "invalid_target", "forbidden", "not_found", "temporary", "data_integrity"]);
  const failed = record.failed.flatMap((item): MergeSavedFailure[] => {
    if (!item || typeof item !== "object" || Array.isArray(item)) return [];
    const failure = item as Record<string, unknown>;
    const refs = canonicalEntityRefs([failure.ref]);
    const ref = refs[0];
    if (!ref || !requested.has(`${ref.kind}:${ref.id}`) || typeof failure.code !== "string" || !safeCodes.has(failure.code) || typeof failure.retryable !== "boolean") {
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
    return { status: "unauthenticated", merged: 0, failed: [], retryable: true };
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

    if (response.status === 401) {
      return { status: "unauthenticated", merged: mergedCount, failed: failures, retryable: true };
    }
    if (!response.ok) return temporaryOutcome(mergedCount, failures);

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
    ? { status: "partial", merged: mergedCount, failed: failures, retryable: true }
    : { status: "merged", merged: mergedCount, failed: [], retryable: false };
}

export function mergeGuestSaved(dependencies: MergeDependencies = {}): Promise<GuestSavedMergeOutcome> {
  if (mergeInFlight) return mergeInFlight;
  mergeInFlight = runMerge(dependencies).finally(() => {
    mergeInFlight = null;
  });
  return mergeInFlight;
}
