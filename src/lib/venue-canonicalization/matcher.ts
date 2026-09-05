export type VenueMatchRecord = {
  id: string;
  name: string;
  nameEn?: string | null;
  aliases?: string[];
  address?: string | null;
  prefecture?: string | null;
  city?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  officialUrl?: string | null;
  venueType?: string | null;
  qids?: string[];
  manualFieldCount?: number;
  officialFieldCount?: number;
  relationCount?: number;
  mediaCount?: number;
  primaryMediaCount?: number;
};

export type VenueCanonicalMatch = {
  sourceVenueId: string;
  candidateVenueId: string;
  confidence: number;
  category: "HIGH" | "POSSIBLE" | "NONE";
  reasons: string[];
  canonicalVenueId: string;
  canonicalPriorityReason: string;
  recommendedAction: "auto_merge" | "human_review" | "keep_separate";
  distanceMeters: number | null;
  autoMergeEligible: boolean;
};

export function normalizeVenueIdentity(value: string | null | undefined) {
  return (value || "")
    .normalize("NFKC")
    .toLowerCase()
    .replace(/https?:\/\/|www\./g, "")
    .replace(/公益財団法人|一般財団法人|独立行政法人|国立研究開発法人/g, "")
    .replace(/[\s・･.,_\-‐‑‒–—―ー()（）「」『』【】\[\]\/]/g, "");
}

export function normalizeAddress(value: string | null | undefined) {
  return (value || "").normalize("NFKC").toLowerCase().replace(/[\s〒,，・\-‐‑‒–—―ー]/g, "");
}

export function normalizeDomain(value: string | null | undefined) {
  if (!value) return null;
  try { return new URL(value).hostname.toLowerCase().replace(/^www\./, ""); } catch { return null; }
}

function bigrams(value: string) {
  const normalized = normalizeVenueIdentity(value);
  if (normalized.length < 2) return new Set(normalized ? [normalized] : []);
  return new Set(Array.from({ length: normalized.length - 1 }, (_, index) => normalized.slice(index, index + 2)));
}

export function diceSimilarity(left: string, right: string) {
  const a = bigrams(left);
  const b = bigrams(right);
  if (!a.size || !b.size) return 0;
  let overlap = 0;
  for (const item of a) if (b.has(item)) overlap += 1;
  return (2 * overlap) / (a.size + b.size);
}

export function distanceMeters(a: VenueMatchRecord, b: VenueMatchRecord) {
  if (a.latitude == null || a.longitude == null || b.latitude == null || b.longitude == null) return null;
  const toRadians = (degrees: number) => degrees * Math.PI / 180;
  const dLat = toRadians(b.latitude - a.latitude);
  const dLon = toRadians(b.longitude - a.longitude);
  const lat1 = toRadians(a.latitude);
  const lat2 = toRadians(b.latitude);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return 6371000 * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

function canonicalPreference(record: VenueMatchRecord) {
  return (record.manualFieldCount || 0) * 100
    + (record.officialFieldCount || 0) * 20
    + (record.qids?.length ? 30 : 0)
    + (record.officialUrl ? 8 : 0)
    + (record.address ? 5 : 0)
    + (record.latitude != null && record.longitude != null ? 5 : 0)
    + (record.mediaCount || 0) * 2
    + (record.relationCount || 0);
}

export function scoreCanonicalCandidate(source: VenueMatchRecord, candidate: VenueMatchRecord): VenueCanonicalMatch {
  const reasons: string[] = [];
  const sourceNames = [source.name, source.nameEn, ...(source.aliases || [])].filter(Boolean).map(normalizeVenueIdentity);
  const candidateNames = [candidate.name, candidate.nameEn, ...(candidate.aliases || [])].filter(Boolean).map(normalizeVenueIdentity);
  const exactName = sourceNames.some((name) => name && candidateNames.includes(name));
  const exactPrimaryName = normalizeVenueIdentity(source.name) === normalizeVenueIdentity(candidate.name);
  const nameSimilarity = Math.max(...sourceNames.flatMap((left) => candidateNames.map((right) => diceSimilarity(left, right))), 0);
  const sourceDomain = normalizeDomain(source.officialUrl);
  const candidateDomain = normalizeDomain(candidate.officialUrl);
  const exactDomain = Boolean(sourceDomain && candidateDomain && sourceDomain === candidateDomain);
  const sourceQids = new Set(source.qids || []);
  const candidateQids = new Set(candidate.qids || []);
  const qidMatch = [...sourceQids].some((qid) => candidateQids.has(qid));
  const qidConflict = sourceQids.size > 0 && candidateQids.size > 0 && !qidMatch;
  const exactAddress = Boolean(normalizeAddress(source.address) && normalizeAddress(source.address) === normalizeAddress(candidate.address));
  const samePrefecture = Boolean(source.prefecture && candidate.prefecture && source.prefecture === candidate.prefecture);
  const sameCity = Boolean(source.city && candidate.city && source.city === candidate.city);
  const sameType = Boolean(source.venueType && candidate.venueType && source.venueType === candidate.venueType);
  const distance = distanceMeters(source, candidate);
  let score = 0;

  if (qidMatch) { score += 0.7; reasons.push("Wikidata QID exact match"); }
  if (exactDomain) { score += 0.4; reasons.push("official domain exact match"); }
  if (exactPrimaryName) { score += 0.35; reasons.push("normalized primary name exact match"); }
  else if (exactName) { score += 0.3; reasons.push("name / name_en / alias exact match"); }
  else if (nameSimilarity >= 0.82) { score += 0.2; reasons.push(`strong normalized name similarity ${nameSimilarity.toFixed(2)}`); }
  else if (nameSimilarity >= 0.68) { score += 0.1; reasons.push(`moderate normalized name similarity ${nameSimilarity.toFixed(2)}`); }
  if (exactAddress) { score += 0.2; reasons.push("normalized address exact match"); }
  if (distance != null && distance <= 100) { score += 0.25; reasons.push(`coordinates within ${Math.round(distance)}m`); }
  else if (distance != null && distance <= 500) { score += 0.18; reasons.push(`coordinates within ${Math.round(distance)}m`); }
  else if (distance != null && distance <= 2000) { score += 0.08; reasons.push(`coordinates within ${Math.round(distance)}m`); }
  if (samePrefecture) { score += 0.05; reasons.push("prefecture match"); }
  if (sameCity) { score += 0.06; reasons.push("city match"); }
  if (sameType) { score += 0.03; reasons.push("venue type match"); }
  if (qidConflict) { score -= 0.5; reasons.push("conflicting Wikidata QIDs"); }
  if (sourceDomain && candidateDomain && !exactDomain) { score -= 0.15; reasons.push("official domain mismatch"); }
  if (source.prefecture && candidate.prefecture && !samePrefecture) { score -= 0.1; reasons.push("prefecture mismatch"); }
  const confidence = Math.max(0, Math.min(1, Number(score.toFixed(2))));

  const corroboratedHigh = !qidConflict && (
    qidMatch
    || (exactDomain && exactName)
    || (exactName && distance != null && distance <= 500 && (samePrefecture || sameCity))
    || (exactName && exactAddress)
  );
  const category = corroboratedHigh ? "HIGH" : (exactName || confidence >= 0.45 || (nameSimilarity >= 0.72 && (samePrefecture || sameCity))) ? "POSSIBLE" : "NONE";
  const sourcePreference = canonicalPreference(source);
  const candidatePreference = canonicalPreference(candidate);
  const canonical = candidatePreference >= sourcePreference ? candidate : source;
  const canonicalPriorityReason = canonical.id === candidate.id
    ? "candidate has equal or stronger Manual/Official provenance, identifiers, completeness, media, or relations"
    : "source has stronger Manual/Official provenance, completeness, media, or relations";
  const multiplePrimaryImages = (source.primaryMediaCount || 0) > 0 && (candidate.primaryMediaCount || 0) > 0;
  const autoMergeEligible = category === "HIGH" && !qidConflict && !multiplePrimaryImages;
  if (multiplePrimaryImages) reasons.push("both venues have Primary media; human review required");

  return {
    sourceVenueId: source.id,
    candidateVenueId: candidate.id,
    confidence,
    category,
    reasons,
    canonicalVenueId: canonical.id,
    canonicalPriorityReason,
    recommendedAction: autoMergeEligible ? "auto_merge" : category === "NONE" ? "keep_separate" : "human_review",
    distanceMeters: distance == null ? null : Math.round(distance),
    autoMergeEligible,
  };
}

export function rankCanonicalCandidates(source: VenueMatchRecord, candidates: VenueMatchRecord[], limit = 3) {
  return candidates
    .filter((candidate) => candidate.id !== source.id)
    .map((candidate) => scoreCanonicalCandidate(source, candidate))
    .sort((a, b) => b.confidence - a.confidence || a.candidateVenueId.localeCompare(b.candidateVenueId))
    .slice(0, limit);
}
