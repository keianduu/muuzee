import type { WorkSourceCandidate } from "./types";

export function normalizeIdentity(value: string) {
  return value.normalize("NFKC").toLowerCase().replace(/[\s・･,，.．'’`´\-‐‑‒–—―_()（）「」『』]/g, "");
}

export function parseExplicitYear(value: string | null | undefined) {
  if (!value) return { text: null, from: null, to: null };
  const years = [...value.matchAll(/(?<!\d)(-?\d{3,4})(?!\d)/g)].map((match) => Number(match[1])).filter((year) => year >= -10000 && year <= 9999);
  if (!years.length) return { text: value.trim() || null, from: null, to: null };
  return { text: value.trim(), from: years[0], to: years[1] ?? years[0] };
}

export function explicitPresentation(value: string | null | undefined) {
  const text = (value || "").normalize("NFKC").toLowerCase();
  if (!text) return { type: null, status: null };
  const type = /常設|permanent/.test(text) ? "permanent" as const : /企画|特別|temporary/.test(text) ? "temporary" as const : null;
  const status = /展示中|現在展示|on\s+(?:display|view)/.test(text) ? "currently_displayed" as const
    : /非展示|展示していません|not\s+on\s+(?:display|view)/.test(text) ? "not_displayed" as const : null;
  return { type, status };
}

export function workDuplicateKey(candidate: Pick<WorkSourceCandidate, "title" | "artistName" | "venueName">) {
  return [candidate.title, candidate.artistName, candidate.venueName || ""].map(normalizeIdentity).join("::");
}

export function exactNameMatch(target: { name: string; name_en?: string | null; aliases?: string[] }, sourceName: string) {
  const source = normalizeIdentity(sourceName);
  return [target.name, target.name_en, ...(target.aliases || [])].filter(Boolean).some((name) => normalizeIdentity(String(name)) === source);
}
