import type { SupabaseClient } from "@supabase/supabase-js";

export type VenueResolutionStatus = "resolved" | "ambiguous" | "unresolved";
export type VenueResolutionInput = {
  sourceName?: string | null;
  sourceKey?: string | null;
  externalId?: string | null;
  officialUrl?: string | null;
  address?: string | null;
  existingVenueId?: string | null;
};
export type VenueResolutionCandidate = {
  id: string;
  name: string;
  nameEn: string | null;
  address: string | null;
  keyType: "name" | "name_en" | "alias" | "official_url";
};
export type VenueResolution = {
  status: VenueResolutionStatus;
  venueId: string | null;
  candidateIds: string[];
  candidates: VenueResolutionCandidate[];
  matchMethod: string;
  reason: string;
};

const KEY_PRIORITY = { name: 1, name_en: 2, alias: 3, official_url: 4 } as const;

export function normalizeVenueSearchKey(value: string | null | undefined) {
  const normalized = (value || "").normalize("NFKC").trim().toLowerCase().replace(/\s+/g, " ");
  return normalized || null;
}

export function hasMultipleVenueLikeValues(value: string | null | undefined) {
  return Boolean(value && (/\r|\n|、|；|;|\s[\/／|｜]\s/.test(value)));
}

function unresolved(reason: string, method = "no_exact_canonical_candidate"): VenueResolution {
  return { status: "unresolved", venueId: null, candidateIds: [], candidates: [], matchMethod: method, reason };
}

export function chooseExternalVenueResolution(candidateIds: string[]): VenueResolution | null {
  const ids = [...new Set(candidateIds.filter(Boolean))];
  if (!ids.length) return null;
  if (ids.length === 1) return { status: "resolved", venueId: ids[0], candidateIds: ids, candidates: [], matchMethod: "source_external_id_exact", reason: "Existing source mapping resolved to one active canonical Venue" };
  return { status: "ambiguous", venueId: null, candidateIds: ids, candidates: [], matchMethod: "source_external_id_exact", reason: "External ID maps to multiple canonical Venues; human selection is required" };
}

export function chooseVenueResolution(input: VenueResolutionInput, candidates: VenueResolutionCandidate[]): VenueResolution {
  if (input.existingVenueId) return { status: "resolved", venueId: input.existingVenueId, candidateIds: [input.existingVenueId], candidates: [], matchMethod: "existing_canonical_relation_protected", reason: "Existing canonical Venue relation was preserved" };
  if (!normalizeVenueSearchKey(input.sourceName) && !normalizeVenueSearchKey(input.officialUrl)) return unresolved("Venue name and official URL are missing");
  if (hasMultipleVenueLikeValues(input.sourceName)) return unresolved("Source value appears to contain multiple venues; human separation is required", "multiple_venue_values");

  const unique = [...candidates.reduce((byId, candidate) => {
    const prior = byId.get(candidate.id);
    if (!prior || KEY_PRIORITY[candidate.keyType] < KEY_PRIORITY[prior.keyType]) byId.set(candidate.id, candidate);
    return byId;
  }, new Map<string, VenueResolutionCandidate>()).values()];
  if (!unique.length) return unresolved("No exact active canonical Venue candidate was found");
  const bestPriority = Math.min(...unique.map((candidate) => KEY_PRIORITY[candidate.keyType]));
  let best = unique.filter((candidate) => KEY_PRIORITY[candidate.keyType] === bestPriority);
  const address = normalizeVenueSearchKey(input.address);
  if (best.length > 1 && address) {
    const addressMatches = best.filter((candidate) => normalizeVenueSearchKey(candidate.address) === address);
    if (addressMatches.length === 1) best = addressMatches;
  }
  const method = best[0]?.keyType === "name" ? "japanese_normalized_exact"
    : best[0]?.keyType === "name_en" ? "english_normalized_exact"
      : best[0]?.keyType === "alias" ? "alias_normalized_exact" : "official_url_exact";
  if (best.length === 1) return { status: "resolved", venueId: best[0].id, candidateIds: [best[0].id], candidates: best, matchMethod: address && unique.length > 1 ? `${method}_address_confirmed` : method, reason: "One exact active canonical Venue candidate was found by indexed DB search" };
  return { status: "ambiguous", venueId: null, candidateIds: best.map((candidate) => candidate.id), candidates: best, matchMethod: method, reason: "Multiple equal-priority exact canonical Venue candidates were found; human selection is required" };
}

function inputKey(input: VenueResolutionInput) {
  return JSON.stringify([normalizeVenueSearchKey(input.sourceName), input.sourceKey || null, input.externalId || null, normalizeVenueSearchKey(input.officialUrl), normalizeVenueSearchKey(input.address), input.existingVenueId || null]);
}

export async function resolveVenues(db: SupabaseClient, inputs: VenueResolutionInput[]) {
  const uniqueInputs = [...new Map(inputs.map((input) => [inputKey(input), input])).values()];
  const results = new Map<string, VenueResolution>();
  const unresolvedInputs = uniqueInputs.filter((input) => {
    if (input.existingVenueId) { results.set(inputKey(input), chooseVenueResolution(input, [])); return false; }
    if (hasMultipleVenueLikeValues(input.sourceName)) { results.set(inputKey(input), chooseVenueResolution(input, [])); return false; }
    return true;
  });

  const externalInputs = unresolvedInputs.filter((input) => input.sourceKey && input.externalId);
  const externalRows: Array<Record<string, unknown>> = [];
  const sourceGroups = externalInputs.reduce((groups, input) => {
    const sourceKey = input.sourceKey as string;
    groups.set(sourceKey, [...(groups.get(sourceKey) || []), input]);
    return groups;
  }, new Map<string, VenueResolutionInput[]>());
  for (const [sourceKey, sourceInputs] of sourceGroups) {
    const externalIds = [...new Set(sourceInputs.map((input) => input.externalId as string))];
    for (let index = 0; index < externalIds.length; index += 100) {
      const { data, error } = await db.from("source_records")
        .select("external_id,venue_id,data_sources!inner(key),venues!source_records_venue_id_fkey(id,name,name_en,address,is_active,merged_into_venue_id)")
        .in("external_id", externalIds.slice(index, index + 100)).eq("data_sources.key", sourceKey)
        .not("venue_id", "is", null);
      if (error) throw error;
      externalRows.push(...(data || []).map((row) => ({ ...row, source_key: sourceKey })));
    }
  }
  for (const input of externalInputs) {
    const valid = externalRows.filter((row) => row.source_key === input.sourceKey && row.external_id === input.externalId).filter((row) => {
      const venue = (Array.isArray(row.venues) ? row.venues[0] : row.venues) as { is_active?: boolean; merged_into_venue_id?: string | null } | null;
      return row.venue_id && venue && venue.is_active !== false && !venue.merged_into_venue_id;
    });
    const ids = [...new Set(valid.map((row) => row.venue_id as string))];
    const externalResolution = chooseExternalVenueResolution(ids);
    if (externalResolution) results.set(inputKey(input), externalResolution);
  }

  const remaining = unresolvedInputs.filter((input) => !results.has(inputKey(input)));
  const searchValues = [...new Set(remaining.flatMap((input) => [normalizeVenueSearchKey(input.sourceName), normalizeVenueSearchKey(input.officialUrl)].filter(Boolean) as string[]))];
  const rows: Array<Record<string, unknown>> = [];
  for (let index = 0; index < searchValues.length; index += 100) {
    const { data, error } = await db.from("venue_search_keys")
      .select("venue_id,key_type,normalized_value,venues!inner(id,name,name_en,address,is_active,merged_into_venue_id)")
      .in("normalized_value", searchValues.slice(index, index + 100));
    if (error) throw error;
    rows.push(...(data || []));
  }
  for (const input of remaining) {
    const names = new Set([normalizeVenueSearchKey(input.sourceName), normalizeVenueSearchKey(input.officialUrl)].filter(Boolean));
    const candidates = rows.filter((row) => names.has(String(row.normalized_value))).map((row) => {
      const venue = row.venues as unknown as { id: string; name: string; name_en: string | null; address: string | null };
      return { id: venue.id, name: venue.name, nameEn: venue.name_en, address: venue.address, keyType: row.key_type as VenueResolutionCandidate["keyType"] };
    });
    results.set(inputKey(input), chooseVenueResolution(input, candidates));
  }
  return new Map(inputs.map((input) => [inputKey(input), results.get(inputKey(input)) || unresolved("No resolver result")]));
}

export async function resolveVenue(db: SupabaseClient, input: VenueResolutionInput) {
  return (await resolveVenues(db, [input])).get(inputKey(input))!;
}

export function venueResolutionKey(input: VenueResolutionInput) { return inputKey(input); }
