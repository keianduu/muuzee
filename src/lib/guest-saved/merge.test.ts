import { describe, expect, it, vi } from "vitest";
import type { EntityRef } from "@/lib/user/types";
import { addGuestSaved, GUEST_SAVED_STORAGE_KEY, readGuestSaved, type GuestSavedStorage } from "./store";
import { GUEST_SAVED_MERGE_BATCH_LIMIT, mergeGuestSaved } from "./merge";

function uuid(index: number) {
  return `00000000-0000-4000-8000-${index.toString(16).padStart(12, "0")}`;
}

function ref(index: number): EntityRef {
  return { kind: "exhibition", id: uuid(index) };
}

function memoryStorage(refs: EntityRef[] = []): GuestSavedStorage & { value: string | null } {
  let value: string | null = refs.length ? JSON.stringify(refs) : null;
  return {
    get value() { return value; },
    getItem: () => value,
    setItem: (_key, next) => { value = next; },
    removeItem: () => { value = null; },
  };
}

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

describe("Guest Saved merge orchestrator", () => {
  it("does not authenticate or call the API for an empty store", async () => {
    const isAuthenticated = vi.fn();
    const fetcher = vi.fn();
    await expect(mergeGuestSaved({ storage: memoryStorage(), isAuthenticated, fetcher })).resolves.toMatchObject({ status: "empty" });
    expect(isAuthenticated).not.toHaveBeenCalled();
    expect(fetcher).not.toHaveBeenCalled();
  });

  it("retains the whole store when no authenticated session exists", async () => {
    const item = ref(1);
    const storage = memoryStorage([item]);
    const fetcher = vi.fn();
    await expect(mergeGuestSaved({ storage, isAuthenticated: async () => false, fetcher })).resolves.toMatchObject({ status: "unauthenticated" });
    expect(readGuestSaved(storage)).toEqual({ ok: true, value: [item] });
    expect(fetcher).not.toHaveBeenCalled();
  });

  it("chunks stores larger than the server batch limit", async () => {
    const refs = Array.from({ length: GUEST_SAVED_MERGE_BATCH_LIMIT + 1 }, (_, index) => ref(index + 1));
    const storage = memoryStorage(refs);
    const fetcher = vi.fn(async (_url: Parameters<typeof fetch>[0], init?: RequestInit) => {
      const request = JSON.parse(String(init?.body)) as { refs: EntityRef[] };
      return jsonResponse({ merged: request.refs, failed: [] });
    });
    await expect(mergeGuestSaved({ storage, isAuthenticated: async () => true, fetcher })).resolves.toMatchObject({
      status: "merged",
      merged: refs.length,
    });
    expect(fetcher).toHaveBeenCalledTimes(2);
    expect(JSON.parse(String(fetcher.mock.calls[0][1]?.body)).refs).toHaveLength(GUEST_SAVED_MERGE_BATCH_LIMIT);
    expect(readGuestSaved(storage)).toEqual({ ok: true, value: [] });
  });

  it("consumes successes and retains safe partial failures", async () => {
    const merged = ref(1);
    const failed = ref(2);
    const storage = memoryStorage([merged, failed]);
    const fetcher = vi.fn(async () => jsonResponse({
      merged: [merged],
      failed: [{ ref: failed, code: "temporary", retryable: true }],
    }));
    await expect(mergeGuestSaved({ storage, isAuthenticated: async () => true, fetcher })).resolves.toEqual({
      status: "partial",
      merged: 1,
      failed: [{ ref: failed, code: "temporary", retryable: true }],
      retryable: true,
    });
    expect(readGuestSaved(storage)).toEqual({ ok: true, value: [failed] });
  });

  it("marks a partial outcome non-retryable when every failure is non-retryable", async () => {
    const merged = ref(1);
    const forbidden = ref(2);
    const storage = memoryStorage([merged, forbidden]);
    const fetcher = vi.fn(async () => jsonResponse({
      merged: [merged],
      failed: [{ ref: forbidden, code: "forbidden", retryable: false }],
    }));
    await expect(mergeGuestSaved({ storage, isAuthenticated: async () => true, fetcher })).resolves.toMatchObject({
      status: "partial",
      retryable: false,
    });
    expect(readGuestSaved(storage)).toEqual({ ok: true, value: [forbidden] });
  });

  it("marks a mixed partial outcome retryable when any failure is retryable", async () => {
    const merged = ref(1);
    const forbidden = ref(2);
    const temporary = ref(3);
    const storage = memoryStorage([merged, forbidden, temporary]);
    const fetcher = vi.fn(async () => jsonResponse({
      merged: [merged],
      failed: [
        { ref: forbidden, code: "forbidden", retryable: false },
        { ref: temporary, code: "temporary", retryable: true },
      ],
    }));
    await expect(mergeGuestSaved({ storage, isAuthenticated: async () => true, fetcher })).resolves.toMatchObject({
      status: "partial",
      retryable: true,
    });
    expect(readGuestSaved(storage)).toEqual({ ok: true, value: [forbidden, temporary] });
  });

  it("re-reads the latest store so a ref added during the request is retained", async () => {
    const original = ref(1);
    const addedDuringRequest = ref(2);
    const storage = memoryStorage([original]);
    const fetcher = vi.fn(async () => {
      addGuestSaved(addedDuringRequest, storage);
      return jsonResponse({ merged: [original], failed: [] });
    });
    await mergeGuestSaved({ storage, isAuthenticated: async () => true, fetcher });
    expect(readGuestSaved(storage)).toEqual({ ok: true, value: [addedDuringRequest] });
  });

  it("keeps merged refs when cleanup fails and converges on retry", async () => {
    const item = ref(1);
    let value: string | null = JSON.stringify([item]);
    let failCleanup = true;
    const storage: GuestSavedStorage = {
      getItem: () => value,
      setItem: (_key, next) => { if (failCleanup) throw new Error("quota"); value = next; },
      removeItem: () => { if (failCleanup) throw new Error("blocked"); value = null; },
    };
    const fetcher = vi.fn(async () => jsonResponse({ merged: [item], failed: [] }));
    await expect(mergeGuestSaved({ storage, isAuthenticated: async () => true, fetcher })).resolves.toMatchObject({
      status: "storage_unavailable",
      merged: 1,
      retryable: true,
    });
    expect(value).toBe(JSON.stringify([item]));

    failCleanup = false;
    await expect(mergeGuestSaved({ storage, isAuthenticated: async () => true, fetcher })).resolves.toMatchObject({ status: "merged" });
    expect(value).toBeNull();
    expect(fetcher).toHaveBeenCalledTimes(2);
  });

  it("retains refs and preserves a non-retryable unauthenticated response", async () => {
    const item = ref(1);
    const storage = memoryStorage([item]);
    await expect(mergeGuestSaved({
      storage,
      isAuthenticated: async () => true,
      fetcher: async () => jsonResponse({ error: { code: "unauthenticated", retryable: false } }, 401),
    })).resolves.toEqual({
      status: "unauthenticated",
      merged: 0,
      failed: [],
      retryable: false,
      error: { code: "unauthenticated", retryable: false },
    });
    expect(storage.value).toBe(JSON.stringify([item]));
  });

  it.each([
    { status: 403, code: "forbidden" as const },
    { status: 400, code: "invalid_input" as const },
  ])("preserves safe non-retryable request error $code", async ({ status, code }) => {
    const item = ref(1);
    const storage = memoryStorage([item]);
    await expect(mergeGuestSaved({
      storage,
      isAuthenticated: async () => true,
      fetcher: async () => jsonResponse({ error: { code, retryable: false } }, status),
    })).resolves.toEqual({
      status: "request_error",
      merged: 0,
      failed: [],
      retryable: false,
      error: { code, retryable: false },
    });
    expect(storage.value).toBe(JSON.stringify([item]));
  });

  it("preserves a safe retryable temporary response", async () => {
    const item = ref(1);
    const storage = memoryStorage([item]);
    await expect(mergeGuestSaved({
      storage,
      isAuthenticated: async () => true,
      fetcher: async () => jsonResponse({ error: { code: "temporary", retryable: true } }, 503),
    })).resolves.toEqual({
      status: "temporary",
      merged: 0,
      failed: [],
      retryable: true,
      error: { code: "temporary", retryable: true },
    });
    expect(storage.value).toBe(JSON.stringify([item]));
  });

  it("falls back to retryable temporary for a malformed non-2xx response", async () => {
    const item = ref(1);
    const storage = memoryStorage([item]);
    await expect(mergeGuestSaved({
      storage,
      isAuthenticated: async () => true,
      fetcher: async () => jsonResponse({ message: "raw provider detail" }, 500),
    })).resolves.toEqual({
      status: "temporary",
      merged: 0,
      failed: [],
      retryable: true,
      error: { code: "temporary", retryable: true },
    });
    expect(storage.value).toBe(JSON.stringify([item]));
  });

  it("allows only one merge run in flight per browser context", async () => {
    const storage = memoryStorage([ref(1)]);
    let resolveResponse!: (response: Response) => void;
    const response = new Promise<Response>((resolve) => { resolveResponse = resolve; });
    const fetcher = vi.fn(() => response);
    const dependencies = { storage, isAuthenticated: async () => true, fetcher };
    const first = mergeGuestSaved(dependencies);
    const second = mergeGuestSaved(dependencies);
    expect(second).toBe(first);
    resolveResponse(jsonResponse({ merged: [ref(1)], failed: [] }));
    await first;
    expect(fetcher).toHaveBeenCalledOnce();
  });

  it("does not pass consumed refs to a later account on the same browser", async () => {
    const storage = memoryStorage([ref(1)]);
    const accountAFetch = vi.fn(async () => jsonResponse({ merged: [ref(1)], failed: [] }));
    await mergeGuestSaved({ storage, isAuthenticated: async () => true, fetcher: accountAFetch });

    const accountBFetch = vi.fn();
    await expect(mergeGuestSaved({ storage, isAuthenticated: async () => true, fetcher: accountBFetch }))
      .resolves.toMatchObject({ status: "empty" });
    expect(accountBFetch).not.toHaveBeenCalled();
  });

  it("uses only the Production storage key", () => {
    expect(GUEST_SAVED_STORAGE_KEY).toBe("muuzee:guest-saved:v1");
  });
});
