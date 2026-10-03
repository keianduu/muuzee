export type SubdivisionMode = "jp" | "region";

export type CountryOption = {
  code: string;
  label: string;
  flag: string;
  subdivisionMode: SubdivisionMode;
};

export const COUNTRY_OPTIONS: readonly CountryOption[] = [
  { code: "JP", label: "日本", flag: "🇯🇵", subdivisionMode: "jp" },
] as const;

export const JP_PREFECTURES = [
  "北海道", "青森県", "岩手県", "宮城県", "秋田県", "山形県", "福島県",
  "茨城県", "栃木県", "群馬県", "埼玉県", "千葉県", "東京都", "神奈川県",
  "新潟県", "富山県", "石川県", "福井県", "山梨県", "長野県", "岐阜県",
  "静岡県", "愛知県", "三重県", "滋賀県", "京都府", "大阪府", "兵庫県",
  "奈良県", "和歌山県", "鳥取県", "島根県", "岡山県", "広島県", "山口県",
  "徳島県", "香川県", "愛媛県", "高知県", "福岡県", "佐賀県", "長崎県",
  "熊本県", "大分県", "宮崎県", "鹿児島県", "沖縄県",
] as const;

// Region catalogs are intentionally empty until a country is explicitly
// added to COUNTRY_OPTIONS. This keeps the current JP-only scope curated.
export const REGIONS_BY_COUNTRY: Readonly<Record<string, readonly string[]>> = {};

export function countryOption(code: string | null | undefined) {
  return COUNTRY_OPTIONS.find((option) => option.code === code?.toUpperCase()) || null;
}
export function subdivisionModeForCountry(code: string | null | undefined): SubdivisionMode {
  return countryOption(code)?.subdivisionMode || "region";
}

export function countryOptionLabel(option: CountryOption) {
  return `${option.flag} ${option.code} — ${option.label}`;
}
