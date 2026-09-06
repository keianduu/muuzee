import { calculateCompleteness, hasValue } from "./master-completeness";
import { masterImageQuality, masterImageStatus } from "./master-image";

export const VENUE_PRIORITY_TIERS = ["A", "B", "C", "D", "E"] as const;
export type VenuePriorityTier = (typeof VENUE_PRIORITY_TIERS)[number];
export type VenueTierFilter = VenuePriorityTier | "A-B" | "A-C";

// Draft targets: operational guidance, not publication requirements.
export const VENUE_TIER_TARGETS: Record<VenuePriorityTier, number> = {
  A: 100,
  B: 83,
  C: 67,
  D: 50,
  E: 17,
};

export function tiersForFilter(value?: string): VenuePriorityTier[] | null {
  if (value === "A-B") return ["A", "B"];
  if (value === "A-C") return ["A", "B", "C"];
  return (VENUE_PRIORITY_TIERS as readonly string[]).includes(value || "") ? [value as VenuePriorityTier] : null;
}

export function effectiveVenueTier(row: Record<string, unknown>): VenuePriorityTier | null {
  const value = row.manual_priority_tier || row.effective_priority_tier || row.auto_priority_tier;
  return (VENUE_PRIORITY_TIERS as readonly unknown[]).includes(value) ? value as VenuePriorityTier : null;
}

export function venueTierRank(row: Record<string, unknown>) {
  const tier = effectiveVenueTier(row);
  return tier ? VENUE_PRIORITY_TIERS.indexOf(tier) : VENUE_PRIORITY_TIERS.length;
}

export function venueQuality(row: Record<string, unknown>) {
  const completeness = calculateCompleteness("venues", row);
  const image = masterImageQuality(row);
  return {
    completeness,
    missing: {
      address: !hasValue(row.address),
      postalCode: !hasValue(row.postal_code),
      coordinates: row.latitude == null || row.longitude == null,
      officialUrl: !hasValue(row.official_url),
      openingHours: !hasValue(row.opening_hours_text),
      closedDays: !hasValue(row.closed_days_text),
      access: !hasValue(row.access_text),
      description: !hasValue(row.description),
      imageCandidate: image.candidates.length === 0,
      primaryImage: !image.primary,
      approvedImage: !image.approvedPrimary,
    },
    candidateCount: image.candidates.length,
    primary: image.primary,
    approvedPrimary: image.approvedPrimary,
    rightsNeedsReview: image.rightsNeedsReview,
  };
}

export function compareVenueQuality(a: Record<string, unknown>, b: Record<string, unknown>) {
  const qualityA = venueQuality(a);
  const qualityB = venueQuality(b);
  const tierA = effectiveVenueTier(a);
  const tierB = effectiveVenueTier(b);
  const targetA = tierA ? VENUE_TIER_TARGETS[tierA] : 101;
  const targetB = tierB ? VENUE_TIER_TARGETS[tierB] : 101;
  const unmetA = qualityA.completeness.percent < targetA;
  const unmetB = qualityB.completeness.percent < targetB;
  const compareMissingFirst = (missingA: boolean, missingB: boolean) => Number(missingB) - Number(missingA);

  return venueTierRank(a) - venueTierRank(b)
    || compareMissingFirst(unmetA, unmetB)
    || compareMissingFirst(qualityA.missing.openingHours, qualityB.missing.openingHours)
    || compareMissingFirst(qualityA.missing.closedDays, qualityB.missing.closedDays)
    || compareMissingFirst(qualityA.missing.access, qualityB.missing.access)
    || compareMissingFirst(qualityA.missing.description, qualityB.missing.description)
    || compareMissingFirst(qualityA.missing.address, qualityB.missing.address)
    || qualityA.completeness.percent - qualityB.completeness.percent
    || String(a.name || "").localeCompare(String(b.name || ""), "ja")
    || String(a.id || "").localeCompare(String(b.id || ""));
}

export function venueImageStatus(row: Record<string, unknown>) {
  return masterImageStatus(row);
}
