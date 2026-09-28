import { describe, expect, it } from "vitest";
import type { EntityKind, EntityRef } from "@/lib/user/types";
import {
  GUEST_SAVED_STORAGE_KEY,
  addGuestSaved,
  consumeGuestSaved,
  isGuestSaved,
  readGuestSaved,
  removeGuestSaved,
  toggleGuestSaved,
  type GuestSavedStorage,
} from "./store";

const IDS = {
  exhibition: "11111111-1111-4111-8111-111111111111",
  artist: "22222222-2222-4222-8222-222222222222",
  venue: "33333333-3333-4333-8333-333333333333",
  work: "44444444-4444-4444-8444-444444444444",
} satisfies Record<EntityKind, string>;

function memoryStorage(initial?: string): GuestSavedStorage & { value: string | null } {
  let value = initial ?? null;
  return {
    get value() { return value; },
    getItem: () => value,
    setItem: (_key, next) => { value = next; },
    removeItem: () => { value = null; },
  };
}

describe("Guest Saved store", () => {
  it.each([
    ["empty", null],
    ["malformed JSON", "{"],
    ["non-array JSON", JSON.stringify({ kind: "artist", id: IDS.artist })],
  ])("reads %s input as an empty canonical set", (_label, raw) => {
    expect(readGuestSaved(memoryStorage(raw ?? undefined))).toEqual({ ok: true, value: [] });
  });

  it("drops invalid kinds and UUIDs, strips extra fields, and deduplicates", () => {
    const storage = memoryStorage(JSON.stringify([
      { kind: "museum", id: IDS.venue },
      { kind: "artist", id: "not-a-uuid" },
      { kind: "artist", id: IDS.artist, title: "must not persist" },
      { kind: "artist", id: IDS.artist },
      null,
    ]));
    expect(readGuestSaved(storage)).toEqual({
      ok: true,
      value: [{ kind: "artist", id: IDS.artist }],
    });
  });

  it.each(Object.keys(IDS) as EntityKind[])("supports %s refs", (kind) => {
    const storage = memoryStorage();
    const ref = { kind, id: IDS[kind] };
    expect(addGuestSaved(ref, storage)).toEqual({ ok: true, value: [ref] });
    expect(isGuestSaved(ref, storage)).toEqual({ ok: true, value: true });
  });

  it("keeps add/remove idempotent and toggles membership", () => {
    const storage = memoryStorage();
    const ref: EntityRef = { kind: "exhibition", id: IDS.exhibition };
    addGuestSaved(ref, storage);
    addGuestSaved(ref, storage);
    expect(readGuestSaved(storage)).toEqual({ ok: true, value: [ref] });
    expect(toggleGuestSaved(ref, storage)).toEqual({ ok: true, value: { refs: [], saved: false } });
    expect(toggleGuestSaved(ref, storage)).toEqual({ ok: true, value: { refs: [ref], saved: true } });
    removeGuestSaved(ref, storage);
    expect(removeGuestSaved(ref, storage)).toEqual({ ok: true, value: [] });
  });

  it("consumes only exact canonical refs from the latest store", () => {
    const storage = memoryStorage();
    const artist: EntityRef = { kind: "artist", id: IDS.artist };
    const venue: EntityRef = { kind: "venue", id: IDS.venue };
    addGuestSaved(artist, storage);
    addGuestSaved(venue, storage);
    expect(consumeGuestSaved([artist], storage)).toEqual({ ok: true, value: [venue] });
  });

  it("returns a typed retryable error when storage read or write is unavailable", () => {
    const readFailure: GuestSavedStorage = {
      getItem: () => { throw new DOMException("blocked", "SecurityError"); },
      setItem: () => undefined,
      removeItem: () => undefined,
    };
    expect(readGuestSaved(readFailure)).toEqual({
      ok: false,
      error: { code: "storage_unavailable", retryable: true },
    });

    const quotaFailure: GuestSavedStorage = {
      getItem: () => null,
      setItem: () => { throw new DOMException("quota", "QuotaExceededError"); },
      removeItem: () => undefined,
    };
    expect(addGuestSaved({ kind: "work", id: IDS.work }, quotaFailure)).toEqual({
      ok: false,
      error: { code: "storage_unavailable", retryable: true },
    });
  });

  it("never reads a Prototype key", () => {
    const reads: string[] = [];
    const storage: GuestSavedStorage = {
      getItem: (key) => { reads.push(key); return null; },
      setItem: () => undefined,
      removeItem: () => undefined,
    };
    readGuestSaved(storage);
    expect(reads).toEqual([GUEST_SAVED_STORAGE_KEY]);
  });
});
