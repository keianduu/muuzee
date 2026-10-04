export type SubdivisionMode = "jp" | "region";

export type CountryOption = {
  code: string;
  label: string;
  flag: string;
  subdivisionMode: SubdivisionMode;
};

export const COUNTRY_OPTIONS: readonly CountryOption[] = [
  { code: "JP", label: "日本", flag: "🇯🇵", subdivisionMode: "jp" },
  { code: "FR", label: "フランス", flag: "🇫🇷", subdivisionMode: "region" },
  { code: "US", label: "アメリカ合衆国", flag: "🇺🇸", subdivisionMode: "region" },
  { code: "GB", label: "イギリス", flag: "🇬🇧", subdivisionMode: "region" },
  { code: "ES", label: "スペイン", flag: "🇪🇸", subdivisionMode: "region" },
  { code: "NL", label: "オランダ", flag: "🇳🇱", subdivisionMode: "region" },
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

export const SUBDIVISIONS_BY_COUNTRY: Readonly<Record<string, readonly string[]>> = {
  FR: [
    "Auvergne-Rhône-Alpes", "Bourgogne-Franche-Comté", "Bretagne", "Centre-Val de Loire",
    "Corse", "Grand Est", "Hauts-de-France", "Île-de-France", "Normandie",
    "Nouvelle-Aquitaine", "Occitanie", "Pays de la Loire", "Provence-Alpes-Côte d’Azur",
  ],
  US: [
    "Alabama", "Alaska", "Arizona", "Arkansas", "California", "Colorado", "Connecticut",
    "Delaware", "District of Columbia", "Florida", "Georgia", "Hawaii", "Idaho", "Illinois",
    "Indiana", "Iowa", "Kansas", "Kentucky", "Louisiana", "Maine", "Maryland", "Massachusetts",
    "Michigan", "Minnesota", "Mississippi", "Missouri", "Montana", "Nebraska", "Nevada",
    "New Hampshire", "New Jersey", "New Mexico", "New York", "North Carolina", "North Dakota",
    "Ohio", "Oklahoma", "Oregon", "Pennsylvania", "Rhode Island", "South Carolina",
    "South Dakota", "Tennessee", "Texas", "Utah", "Vermont", "Virginia", "Washington",
    "West Virginia", "Wisconsin", "Wyoming",
  ],
  GB: ["England", "Northern Ireland", "Scotland", "Wales"],
  ES: [
    "Andalucía", "Aragón", "Asturias", "Illes Balears", "Canarias", "Cantabria",
    "Castilla-La Mancha", "Castilla y León", "Cataluña", "Comunitat Valenciana",
    "Extremadura", "Galicia", "Comunidad de Madrid", "Región de Murcia", "Navarra",
    "País Vasco", "La Rioja", "Ceuta", "Melilla",
  ],
  NL: [
    "Drenthe", "Flevoland", "Friesland", "Gelderland", "Groningen", "Limburg",
    "Noord-Brabant", "Noord-Holland", "Overijssel", "Utrecht", "Zeeland", "Zuid-Holland",
  ],
};

export const SUBDIVISION_LABELS_BY_COUNTRY: Readonly<Record<string, string>> = {
  FR: "Region",
  US: "State",
  GB: "Country / region",
  ES: "Autonomous Community",
  NL: "Province",
};

export function countryOption(code: string | null | undefined) {
  return COUNTRY_OPTIONS.find((option) => option.code === code?.toUpperCase()) || null;
}
export function subdivisionModeForCountry(code: string | null | undefined): SubdivisionMode {
  return countryOption(code)?.subdivisionMode || "region";
}

export function countryOptionLabel(option: CountryOption) {
  return `${option.flag} ${option.code} — ${option.label}`;
}

export function subdivisionLabelForCountry(code: string | null | undefined) {
  return SUBDIVISION_LABELS_BY_COUNTRY[code?.toUpperCase() || ""] || "Region / subdivision";
}
