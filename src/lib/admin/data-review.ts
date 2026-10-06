export const ADMIN_SOURCE_LABELS: Record<string, string> = {
  manual: "手動",
  wikidata: "Wikidata",
  wikipedia: "Wikipedia",
  apj_daj: "APJ DAJ",
  getty_ulan: "Getty ULAN",
  official_website: "公式サイト",
  csv_import: "CSV",
  trusted_api: "Trusted API",
  geolonia: "Geolonia",
  japan_post: "日本郵便",
};

export function adminSourceLabel(source: string | null | undefined) {
  return source ? ADMIN_SOURCE_LABELS[source] || "不明" : "不明";
}
export function hasAdminFieldValue(value: unknown) {
  return value != null && String(value).trim() !== "";
}
