export const RESOLUTION_STATUS_LABELS = {
  pending: "未処理",
  resolved: "解決済み",
  ambiguous: "候補が複数",
  no_candidate: "候補なし",
  failed: "取得・処理エラー",
} as const;

export function resolutionStatusLabel(status: unknown) {
  const value = String(status || "");
  return RESOLUTION_STATUS_LABELS[value as keyof typeof RESOLUTION_STATUS_LABELS] || value || "—";
}

export function resolutionEntityLabel(entity: unknown) {
  if (entity === "venue") return "Venue";
  if (entity === "artist") return "Artist";
  return String(entity || "—");
}
