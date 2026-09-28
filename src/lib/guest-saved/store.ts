import { ENTITY_KINDS, type EntityKind, type EntityRef } from "@/lib/user/types";

export const GUEST_SAVED_STORAGE_KEY = "muuzee:guest-saved:v1";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const ENTITY_KIND_SET = new Set<string>(ENTITY_KINDS);

export type GuestSavedStorage = Pick<Storage, "getItem" | "setItem" | "removeItem">;
export type GuestSavedStorageError = {
  code: "storage_unavailable";
  retryable: true;
};
export type GuestSavedResult<T> =
  | { ok: true; value: T }
  | { ok: false; error: GuestSavedStorageError };

function storageError(): GuestSavedResult<never> {
  return { ok: false, error: { code: "storage_unavailable", retryable: true } };
}

export function canonicalEntityRef(input: unknown): EntityRef | null {
  if (!input || typeof input !== "object" || Array.isArray(input)) return null;
  const record = input as Record<string, unknown>;
  if (!ENTITY_KIND_SET.has(String(record.kind)) || typeof record.id !== "string" || !UUID_PATTERN.test(record.id)) {
    return null;
  }
  return { kind: record.kind as EntityKind, id: record.id };
}

export function canonicalEntityRefs(input: unknown): EntityRef[] {
  if (!Array.isArray(input)) return [];
  const refs = input.flatMap((item) => {
    const ref = canonicalEntityRef(item);
    return ref ? [ref] : [];
  });
  return [...new Map(refs.map((ref) => [`${ref.kind}:${ref.id}`, ref])).values()];
}

export function getBrowserGuestSavedStorage(): GuestSavedStorage | null {
  try {
    return typeof window === "undefined" ? null : window.localStorage;
  } catch {
    return null;
  }
}

export function readGuestSaved(storage: GuestSavedStorage | null = getBrowserGuestSavedStorage()): GuestSavedResult<EntityRef[]> {
  if (!storage) return storageError();
  try {
    const raw = storage.getItem(GUEST_SAVED_STORAGE_KEY);
    if (raw === null) return { ok: true, value: [] };
    try {
      return { ok: true, value: canonicalEntityRefs(JSON.parse(raw)) };
    } catch {
      return { ok: true, value: [] };
    }
  } catch {
    return storageError();
  }
}

function writeGuestSaved(storage: GuestSavedStorage | null, refs: EntityRef[]): GuestSavedResult<EntityRef[]> {
  if (!storage) return storageError();
  try {
    if (refs.length) storage.setItem(GUEST_SAVED_STORAGE_KEY, JSON.stringify(refs));
    else storage.removeItem(GUEST_SAVED_STORAGE_KEY);
    return { ok: true, value: refs };
  } catch {
    return storageError();
  }
}

function refKey(ref: EntityRef) {
  return `${ref.kind}:${ref.id}`;
}

export function isGuestSaved(ref: EntityRef, storage?: GuestSavedStorage | null): GuestSavedResult<boolean> {
  const canonical = canonicalEntityRef(ref);
  if (!canonical) return { ok: true, value: false };
  const current = readGuestSaved(storage);
  if (!current.ok) return current;
  return { ok: true, value: current.value.some((item) => refKey(item) === refKey(canonical)) };
}

export function addGuestSaved(ref: EntityRef, storage?: GuestSavedStorage | null): GuestSavedResult<EntityRef[]> {
  const canonical = canonicalEntityRef(ref);
  const current = readGuestSaved(storage);
  if (!current.ok) return current;
  if (!canonical || current.value.some((item) => refKey(item) === refKey(canonical))) return current;
  return writeGuestSaved(storage ?? getBrowserGuestSavedStorage(), [...current.value, canonical]);
}

export function removeGuestSaved(ref: EntityRef, storage?: GuestSavedStorage | null): GuestSavedResult<EntityRef[]> {
  const canonical = canonicalEntityRef(ref);
  const current = readGuestSaved(storage);
  if (!current.ok) return current;
  if (!canonical) return current;
  const next = current.value.filter((item) => refKey(item) !== refKey(canonical));
  return next.length === current.value.length
    ? current
    : writeGuestSaved(storage ?? getBrowserGuestSavedStorage(), next);
}

export function toggleGuestSaved(ref: EntityRef, storage?: GuestSavedStorage | null): GuestSavedResult<{ refs: EntityRef[]; saved: boolean }> {
  const canonical = canonicalEntityRef(ref);
  const current = readGuestSaved(storage);
  if (!current.ok) return current;
  if (!canonical) return { ok: true, value: { refs: current.value, saved: false } };
  const saved = current.value.some((item) => refKey(item) === refKey(canonical));
  const next = saved
    ? current.value.filter((item) => refKey(item) !== refKey(canonical))
    : [...current.value, canonical];
  const written = writeGuestSaved(storage ?? getBrowserGuestSavedStorage(), next);
  return written.ok ? { ok: true, value: { refs: written.value, saved: !saved } } : written;
}

export function consumeGuestSaved(refs: EntityRef[], storage?: GuestSavedStorage | null): GuestSavedResult<EntityRef[]> {
  const consumedKeys = new Set(canonicalEntityRefs(refs).map(refKey));
  const current = readGuestSaved(storage);
  if (!current.ok) return current;
  if (!consumedKeys.size) return current;
  const next = current.value.filter((item) => !consumedKeys.has(refKey(item)));
  return next.length === current.value.length
    ? current
    : writeGuestSaved(storage ?? getBrowserGuestSavedStorage(), next);
}
