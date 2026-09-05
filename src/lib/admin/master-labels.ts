import type { MasterEntity } from "./master-config";

export const MASTER_LABELS: Record<MasterEntity, { singular: string; plural: string }> = {
  venues: { singular: "Venue（会場）", plural: "Venues（会場）" },
  artists: { singular: "Artist（作家）", plural: "Artists（作家）" },
  works: { singular: "Work（作品）", plural: "Works（作品）" },
};

export const FIELD_LABELS: Record<string, string> = {
  name: "Name（名称）",
  name_en: "English Name（英語名）",
  name_native: "Native Name（現地語名）",
  name_kana: "Kana（読み仮名）",
  aliases: "Aliases（別名・ | 区切り）",
  venue_type: "Venue Type（会場種別）",
  country_code: "Country Code（国コード）",
  region: "Region（地域）",
  prefecture: "Prefecture（都道府県）",
  city: "City（市区町村）",
  district: "District（地区）",
  postal_code: "Postal Code（郵便番号）",
  address: "Address（住所）",
  latitude: "Latitude（緯度）",
  longitude: "Longitude（経度）",
  official_url: "Official URL（公式URL）",
  inception_year: "Opening Year（開館年）",
  description: "Description（概要）",
  access_text: "Access（アクセス）",
  opening_hours_text: "Opening Hours（開館時間）",
  closed_days_text: "Closed Days（休館日）",
  opening_note: "Opening Note（開館補足）",
  is_active: "Active（運用中）",
  birth_date: "Birth Date（生年月日）",
  birth_year: "Birth Year（生年）",
  death_date: "Death Date（没年月日）",
  death_year: "Death Year（没年）",
  nationality_country_code: "Nationality（国籍コード）",
  birth_country_code: "Birth Country（出生国コード）",
  birth_place: "Birth Place（出生地）",
  style_summary: "Style / Genre（作風・ジャンル）",
  title: "Title（作品名）",
  title_en: "English Title（英語作品名）",
  title_original: "Original Title（原題）",
  year_text: "Year（制作年表記）",
  created_year_from: "Created From（制作年・開始）",
  created_year_to: "Created To（制作年・終了）",
  medium: "Medium（技法・素材）",
  dimensions: "Dimensions（寸法）",
};

export const STATUS_LABELS: Record<string, string> = {
  draft: "Draft（下書き）",
  ready: "Ready（公開準備完了）",
  published: "Published（公開中）",
  archived: "Archived（アーカイブ）",
  approved: "Approved（承認済み）",
  rejected: "Rejected（却下）",
  needs_review: "Needs Review（要確認）",
  candidate: "Candidate（候補）",
  matched: "Linked（紐付け済み）",
  missing: "Missing（未設定）",
  manual: "Manual（手動）",
};

export function displayStatus(value: unknown) {
  const key = String(value || "missing");
  return STATUS_LABELS[key] || key;
}
