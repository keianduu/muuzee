export const VENUE_SOURCE_PRIORITY: Record<string, number> = {
  wikidata: 1,
  wikipedia: 2,
  trusted_api: 3,
  official_website: 4,
  manual: 5,
};

export const VENUE_REVIEW_FIELDS = [
  ["name", "名称"],
  ["name_en", "英語名"],
  ["venue_type", "会場種別"],
  ["country_code", "国"],
  ["region", "Region"],
  ["city", "市区町村 / City"],
  ["address", "住所"],
  ["postal_code", "郵便番号"],
  ["latitude", "緯度"],
  ["longitude", "経度"],
  ["official_url", "公式URL"],
  ["inception_year", "開館年"],
  ["opening_hours_text", "開館時間"],
  ["description", "概要"],
] as const;

export const OFFICIAL_REVIEW_FIELDS = [
  ["address", "住所"],
  ["postal_code", "郵便番号"],
  ["opening_hours_text", "開館時間"],
  ["closed_days_text", "休館日"],
  ["access_text", "アクセス"],
  ["description", "概要"],
] as const;

export const VENUE_PROVENANCE_FIELDS = [
  ["name", "名称"],
  ["name_en", "英語名"],
  ["venue_type", "会場種別"],
  ["country_code", "国"],
  ["postal_code", "郵便番号"],
  ["address", "住所"],
  ["prefecture", "都道府県"],
  ["city", "市区町村 / City"],
  ["region", "Region"],
  ["latitude", "緯度"],
  ["longitude", "経度"],
  ["official_url", "公式URL"],
  ["inception_year", "開館年"],
  ["description", "概要"],
  ["access_text", "アクセス"],
  ["opening_hours_text", "開館時間"],
  ["closed_days_text", "休館日"],
  ["opening_note", "開館補足"],
] as const;

export type VenueReviewField = typeof VENUE_REVIEW_FIELDS[number][0];
export type OfficialReviewField = typeof OFFICIAL_REVIEW_FIELDS[number][0];
export type ReviewSource = "wikidata" | "official_website";
export type CurrentVenueSource = { field_name: string; source: string; source_url?: string | null; is_current?: boolean };

export type VenueFieldReviewRow = {
  key: string;
  label: string;
  currentValue: unknown;
  candidateValue: unknown;
  currentSource: string | null;
  currentSourceLabel: string;
  candidateSource: ReviewSource;
  candidateSourceLabel: string;
  candidateSourceUrl: string | null;
  unchanged: boolean;
  protected: boolean;
  defaultSelected: boolean;
};

export const VENUE_SOURCE_LABELS: Record<string, string> = {
  manual: "Manual",
  wikidata: "Wikidata",
  wikipedia: "Wikipedia",
  official_website: "公式サイト",
  trusted_api: "Trusted API",
  csv_import: "CSV",
};

export function venueSourceLabel(source: string | null | undefined) {
  return source ? VENUE_SOURCE_LABELS[source] || "未記録" : "未記録";
}

export function reviewValueEmpty(value: unknown) {
  return value == null || String(value).trim() === "";
}

export function reviewValuesEqual(left: unknown, right: unknown) {
  if (reviewValueEmpty(left) && reviewValueEmpty(right)) return true;
  return JSON.stringify(left) === JSON.stringify(right);
}

export function buildVenueFieldReviewRows(
  venue: Record<string, unknown>,
  currentSources: CurrentVenueSource[],
  candidate: Record<string, unknown>,
  source: ReviewSource,
  sourceUrls: Record<string, string | null> = {},
  fields: ReadonlyArray<readonly [string, string]> = source === "wikidata" ? VENUE_REVIEW_FIELDS : OFFICIAL_REVIEW_FIELDS,
): VenueFieldReviewRow[] {
  const provenance = new Map(currentSources.filter((item) => item.is_current !== false).map((item) => [item.field_name, item]));
  return fields.map(([key, label]) => {
    const currentValue = venue[key];
    const candidateValue = candidate[key];
    const current = provenance.get(key);
    const unchanged = reviewValuesEqual(currentValue, candidateValue);
    const protectedField = (VENUE_SOURCE_PRIORITY[current?.source || ""] || 0) > (VENUE_SOURCE_PRIORITY[source] || 0);
    return {
      key,
      label,
      currentValue,
      candidateValue,
      currentSource: current?.source || null,
      currentSourceLabel: venueSourceLabel(current?.source),
      candidateSource: source,
      candidateSourceLabel: venueSourceLabel(source),
      candidateSourceUrl: sourceUrls[key] || null,
      unchanged,
      protected: protectedField,
      defaultSelected: !unchanged && !protectedField && reviewValueEmpty(currentValue) && !reviewValueEmpty(candidateValue),
    };
  });
}

export function eligibleSelectedVenueFields(rows: VenueFieldReviewRow[], selected: string[]) {
  const requested = new Set(selected);
  return rows.filter((row) => requested.has(row.key) && !row.unchanged && !row.protected && !reviewValueEmpty(row.candidateValue));
}
