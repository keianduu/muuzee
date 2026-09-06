import { normalizeArtistName, type ArtistIdentity } from "./apj-client";
import { fetchJson } from "@/lib/external/fetch-json";

export type GettyUlanRecord = ArtistIdentity & {
  id: string;
  url: string;
  preferredName: string;
  variantNames: string[];
  nationalities: string[];
  roles: string[];
};

const NATIONALITY_CODES: Record<string, string> = {
  japanese: "JP", japan: "JP", italian: "IT", italy: "IT", finnish: "FI", finland: "FI",
  austrian: "AT", austria: "AT",
  french: "FR", france: "FR", german: "DE", germany: "DE", american: "US", "united states": "US",
  british: "GB", english: "GB", "united kingdom": "GB", swiss: "CH", switzerland: "CH",
};

function labels(value: unknown): string[] {
  return Array.isArray(value) ? value.flatMap((item) => typeof item === "object" && item && "_label" in item ? [String((item as { _label: unknown })._label)] : []) : [];
}

function classifications(value: unknown, category: string) {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    if (!item || typeof item !== "object") return [];
    const row = item as { _label?: unknown; classified_as?: unknown };
    return labels(row.classified_as).some((label) => label.toLowerCase() === category) && row._label ? [String(row._label)] : [];
  });
}

export function explicitGettyNationalityCode(nationalities: string[]) {
  const normalized = [...new Set(nationalities.map((value) => value.toLowerCase().replace(/\s*\([^)]*\)\s*/g, "").trim()).filter(Boolean))];
  if (normalized.length !== 1) return null;
  return NATIONALITY_CODES[normalized[0]] || null;
}

export function parseGettyUlanRecord(payload: Record<string, unknown>, id: string): GettyUlanRecord {
  const identified = Array.isArray(payload.identified_by) ? payload.identified_by as Array<Record<string, unknown>> : [];
  const names = identified.filter((item) => typeof item.content === "string");
  const preferred = names.find((item) => labels(item.classified_as).some((label) => label === "preferred term"));
  const preferredName = String(preferred?.content || payload._label || "");
  const variants = names.map((item) => String(item.content)).filter((value) => value !== preferredName);
  const born = payload.born as { timespan?: { begin_of_the_begin?: string }; took_place_at?: unknown } | undefined;
  const died = payload.died as { timespan?: { begin_of_the_begin?: string } } | undefined;
  return {
    id, url: `http://vocab.getty.edu/page/ulan/${id}`, name: preferredName, preferredName,
    nameEn: preferredName, aliases: variants, variantNames: variants,
    birthYear: Number(born?.timespan?.begin_of_the_begin?.slice(0, 4)) || null,
    deathYear: Number(died?.timespan?.begin_of_the_begin?.slice(0, 4)) || null,
    birthPlace: labels(born?.took_place_at)[0] || null,
    nationalities: classifications(payload.classified_as, "nationality"),
    roles: classifications(payload.classified_as, "roles"),
  };
}

export function matchGettyCandidates(target: ArtistIdentity, candidates: GettyUlanRecord[]) {
  const targetNames = new Set([target.name, target.nameEn, ...(target.aliases || [])].filter(Boolean).map((value) => normalizeArtistName(String(value))));
  const exact = candidates.filter((candidate) => [candidate.preferredName, ...candidate.variantNames].some((value) => targetNames.has(normalizeArtistName(value))));
  const dated = exact.filter((candidate) => (!target.birthYear || !candidate.birthYear || target.birthYear === candidate.birthYear)
    && (!target.deathYear || !candidate.deathYear || target.deathYear === candidate.deathYear));
  const eligible = dated.length ? dated : exact;
  return eligible.length === 1 ? { status: "exact" as const, candidate: eligible[0], candidates: eligible }
    : eligible.length > 1 ? { status: "ambiguous" as const, candidate: null, candidates: eligible }
      : { status: "not_found" as const, candidate: null, candidates: [] };
}

export async function fetchGettyUlan(id: string, fetcher: typeof fetch = fetch) {
  const numeric = id.replace(/^ulan\//, "");
  if (!/^\d{7,12}$/.test(numeric)) throw new Error("Invalid Getty ULAN ID");
  const url = `https://data.getty.edu/vocab/ulan/${numeric}`;
  if (fetcher === fetch) return parseGettyUlanRecord(await fetchJson<Record<string, unknown>>(url, { timeoutMs: 30_000 }), numeric);
  const response = await fetcher(url, { redirect: "follow", headers: { Accept: "application/ld+json", "User-Agent": "MuuzeeTargetedArtistEnrichment/1.0" } });
  if (!response.ok) throw new Error(`Getty ULAN ${response.status}`);
  return parseGettyUlanRecord(await response.json() as Record<string, unknown>, numeric);
}

export async function searchGettyUlan(query: string, fetcher: typeof fetch = fetch) {
  const queries = JSON.stringify({ q0: { query, type: "/ulan", limit: 5 } });
  const url = `https://services.getty.edu/vocab/reconcile/?queries=${encodeURIComponent(queries)}`;
  if (fetcher === fetch) {
    const payload = await fetchJson<{ q0?: { result?: Array<{ id: string }> } }>(url, { timeoutMs: 30_000 });
    const ids = (payload.q0?.result || []).map((item) => item.id.replace(/^ulan\//, ""));
    return Promise.all(ids.map((id) => fetchGettyUlan(id, fetcher)));
  }
  const response = await fetcher(url, { headers: { Accept: "application/json", "User-Agent": "MuuzeeTargetedArtistEnrichment/1.0" } });
  if (!response.ok) throw new Error(`Getty reconciliation ${response.status}`);
  const payload = await response.json() as { q0?: { result?: Array<{ id: string }> } };
  const ids = (payload.q0?.result || []).map((item) => item.id.replace(/^ulan\//, ""));
  return Promise.all(ids.map((id) => fetchGettyUlan(id, fetcher)));
}
