import type { MasterEntity } from "./master-config";

export const MASTER_LABELS: Record<MasterEntity, { singular: string; plural: string }> = {
  venues: { singular: "Venue（会場）", plural: "Venues（会場）" },
  artists: { singular: "Artist（作家）", plural: "Artists（作家）" },
  works: { singular: "Work（作品）", plural: "Works（作品）" },
};

export const FIELD_LABELS: Record<string, string> = {
  publication_status: "公開状態",
  name: "名称", name_en: "英語名", name_native: "現地語名", name_kana: "読み仮名", aliases: "別名（| 区切り）",
  venue_type: "会場種別", country_code: "国コード", region: "地域", prefecture: "都道府県", city: "市区町村", district: "地区",
  postal_code: "郵便番号", address: "住所", latitude: "緯度", longitude: "経度", official_url: "公式URL", inception_year: "開館年",
  description: "概要", access_text: "アクセス", opening_hours_text: "開館時間", closed_days_text: "休館日", opening_note: "開館補足", is_active: "運用状態",
  birth_date: "生年月日", birth_year: "生年", death_date: "没年月日", death_year: "没年", nationality_country_code: "国籍コード",
  birth_country_code: "出生国コード", birth_place: "出生地", style_summary: "作風・ジャンル",
  title: "後方互換用作品名", title_ja: "日本語タイトル", title_en: "英語タイトル", title_original: "原題", original_language: "原言語",
  year_text: "制作年表記", created_year_from: "制作年（開始）", created_year_to: "制作年（終了）", medium: "技法・素材", dimensions: "寸法",
};

export const STATUS_LABELS: Record<string, string> = {
  draft: "非公開",
  ready: "非公開",
  published: "公開中",
  archived: "アーカイブ",
  approved: "Approved（承認済み）",
  rejected: "Rejected（却下）",
  needs_review: "Needs Review（要確認）",
  candidate: "Candidate（候補）",
  matched: "Linked（紐付け済み）",
  missing: "Missing（未設定）",
  manual: "Manual（手動）",
  applied: "Applied（優先度により反映）",
  official_website: "Official Website（公式サイト）",
  trusted_api: "Trusted API（信頼済API）",
};

export function displayStatus(value: unknown) {
  const key = String(value || "missing");
  return STATUS_LABELS[key] || key;
}

const API_MATCH_LABELS: Record<string, string> = {
  matched: "照合済み",
  candidate: "候補あり",
  unmatched: "候補なし",
};

const CRAWL_STATUS_LABELS: Record<string, string> = {
  success: "取得成功",
  partial: "一部取得",
  no_official_url: "公式URLなし",
  robots_blocked: "取得不可",
  fetch_failed: "取得失敗",
  parse_failed: "解析失敗",
  no_relevant_page: "対象ページなし",
  timeout: "タイムアウト",
};

export function displayApiMatchStatus(value: unknown) {
  const key = String(value || "");
  return API_MATCH_LABELS[key] || "未照合";
}

export function displayCrawlStatus(value: unknown) {
  const key = String(value || "");
  return CRAWL_STATUS_LABELS[key] || "未取得";
}
