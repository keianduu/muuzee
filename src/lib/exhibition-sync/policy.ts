export type EventStatus = "upcoming" | "ongoing" | "ended" | "unknown";

export function tokyoDate(now = new Date()) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Tokyo", year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
}

export function dailySyncWindow(now = new Date(), bufferDays = 45) {
  const today = tokyoDate(now);
  const from = new Date(`${today}T00:00:00Z`);
  from.setUTCDate(from.getUTCDate() - bufferDays);
  const to = new Date(`${today}T00:00:00Z`);
  to.setUTCFullYear(to.getUTCFullYear() + 1);
  return { dateFrom: from.toISOString().slice(0, 10), dateTo: to.toISOString().slice(0, 10) };
}

export function deriveEventStatus(startDate: string | null, endDate: string | null, today: string): EventStatus {
  if (!startDate && !endDate) return "unknown";
  const start = startDate || endDate as string;
  const end = endDate || startDate as string;
  if (end < today) return "ended";
  if (start > today) return "upcoming";
  return "ongoing";
}

export function sourcePriority(source: string | null | undefined) {
  return ({ manual: 500, official_website: 400, trusted_api: 300, art_commons: 300, wikipedia: 200, wikidata: 100 } as Record<string, number>)[source || ""] || 0;
}

export function mayApplySourceField(currentSource: string | null | undefined, incomingSource = "art_commons") {
  return !currentSource || sourcePriority(incomingSource) >= sourcePriority(currentSource);
}
