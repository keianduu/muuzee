import type { ScoredWikidataCandidate, WikidataVenueCandidate } from "./types";
import { ENTITY_AUTO_MATCH_THRESHOLD, ENTITY_REVIEW_THRESHOLD } from "@/lib/venue-enrichment/policy";

export const WIKIDATA_AUTO_MATCH_THRESHOLD = ENTITY_AUTO_MATCH_THRESHOLD;
export const WIKIDATA_CANDIDATE_THRESHOLD = ENTITY_REVIEW_THRESHOLD;

export function normalizeVenueName(value: string | null | undefined) {
  return (value || "").normalize("NFKC").toLowerCase().replace(/公益財団法人|一般財団法人|独立行政法人|国立研究開発法人/g, "").replace(/[\s・･._‐‑‒–—―ー()（）「」『』]/g, "");
}

export function normalizeUrlDomain(value: string | null | undefined) {
  if (!value) return null;
  try { return new URL(value).hostname.toLowerCase().replace(/^www\./, ""); } catch { return null; }
}

export function scoreWikidataCandidate(venue: { name: string; official_url?: string | null; prefecture?: string | null; city?: string | null }, candidate: WikidataVenueCandidate): ScoredWikidataCandidate {
  const reasons: string[] = [];
  let confidence = 0;
  const venueName = normalizeVenueName(venue.name);
  const labels = [candidate.labelJa, candidate.labelEn, ...candidate.aliases].map(normalizeVenueName);
  if (labels.includes(venueName)) { confidence += 0.6; reasons.push("normalized name exact match"); }
  const venueDomain = normalizeUrlDomain(venue.official_url);
  const candidateDomain = normalizeUrlDomain(candidate.officialUrl);
  if (venueDomain && candidateDomain && venueDomain === candidateDomain) { confidence += 0.25; reasons.push("official domain exact match"); }
  else if (venueDomain && candidateDomain && venueDomain !== candidateDomain) { confidence -= 0.15; reasons.push("official domain mismatch"); }
  const description = candidate.description || "";
  if (/美術館|博物館|museum|gallery/i.test(description)) { confidence += 0.1; reasons.push("entity description identifies a museum or gallery"); }
  if (candidate.countryId === "Q17" || /日本|東京都|北海道|府|県|市|区/.test(description)) { confidence += 0.1; reasons.push("Japan location signal"); }
  if (venue.prefecture && description.includes(venue.prefecture)) { confidence += 0.08; reasons.push("prefecture match"); }
  if (venue.city && description.includes(venue.city)) { confidence += 0.07; reasons.push("city match"); }
  confidence = Math.max(0, Math.min(1, Number(confidence.toFixed(2))));
  return { ...candidate, confidence, reasons, suggestedStatus: confidence >= WIKIDATA_AUTO_MATCH_THRESHOLD ? "matched" : "candidate" };
}

export function rankWikidataCandidates(venue: { name: string; official_url?: string | null; prefecture?: string | null; city?: string | null }, candidates: WikidataVenueCandidate[]) {
  return candidates.map((candidate) => scoreWikidataCandidate(venue, candidate)).sort((a, b) => b.confidence - a.confidence);
}
