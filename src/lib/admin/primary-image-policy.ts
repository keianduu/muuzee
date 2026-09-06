export type PrimaryImageCandidate = {
  id: string;
  discovery_source?: string | null;
  is_active?: boolean | null;
  review_status?: string | null;
  rights_status?: string | null;
};

export type AutoPrimaryDecision =
  | { candidateId: string; reason: "wikidata_p18" | "single_candidate" }
  | { candidateId: null; reason: "primary_exists" | "no_candidates" | "multiple_candidates_without_p18" };

export function isPrimaryCandidateUsable(candidate: PrimaryImageCandidate) {
  return candidate.is_active !== false
    && candidate.review_status !== "rejected"
    && candidate.rights_status !== "rejected";
}

export function chooseAutoPrimaryCandidate(input: {
  primaryCount: number;
  candidates: PrimaryImageCandidate[];
}): AutoPrimaryDecision {
  if (input.primaryCount > 0) return { candidateId: null, reason: "primary_exists" };

  const candidates = input.candidates.filter(isPrimaryCandidateUsable);
  const p18 = candidates.find((candidate) => candidate.discovery_source === "wikidata_p18");
  if (p18) return { candidateId: p18.id, reason: "wikidata_p18" };
  if (candidates.length === 1) return { candidateId: candidates[0].id, reason: "single_candidate" };
  if (!candidates.length) return { candidateId: null, reason: "no_candidates" };
  return { candidateId: null, reason: "multiple_candidates_without_p18" };
}

export function mediaAssetMetadataFromCandidate(candidate: Record<string, unknown>) {
  const provider = String(candidate.provider || "");
  return {
    source_type: provider === "wikimedia_commons" ? "wikimedia" : "other",
    source_url: candidate.source_url || candidate.image_url,
    credit: candidate.credit,
    usage_note: candidate.usage_terms,
    reported_license: candidate.license_short_name,
    reported_license_url: candidate.license_url,
    reported_author: candidate.author,
    reported_usage_terms: candidate.usage_terms,
    rights_status: candidate.rights_status || "needs_review",
  };
}
