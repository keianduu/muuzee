import { calculateCompleteness, hasValue } from "./master-completeness";
import { effectivePriorityTier, priorityTierRank, tiersForCoreFilter, type CorePriorityTier } from "./master-priority";
import { masterImageQuality, masterImageStatus } from "./master-image";

export const ARTIST_PRIORITY_TIERS = ["A", "B", "C"] as const;
export type ArtistPriorityTier = CorePriorityTier;
export const tiersForArtistFilter = tiersForCoreFilter;
export const effectiveArtistTier = effectivePriorityTier;

export function artistQuality(row: Record<string, unknown>) {
  const completeness = calculateCompleteness("artists", row);
  const image = masterImageQuality(row);
  return {
    completeness,
    missing: {
      name: !hasValue(row.name),
      nameEn: !hasValue(row.name_en),
      nationality: !hasValue(row.nationality_country_code),
      primaryImage: !image.primary,
    },
    ...image,
  };
}

export function compareArtistQuality(a: Record<string, unknown>, b: Record<string, unknown>) {
  return priorityTierRank(a) - priorityTierRank(b)
    || artistQuality(a).completeness.percent - artistQuality(b).completeness.percent
    || String(a.name || "").localeCompare(String(b.name || ""), "ja")
    || String(a.id || "").localeCompare(String(b.id || ""));
}

export const artistImageStatus = masterImageStatus;
