import { normalizeExhibitionSchedule, normalizePublicationStatus, publicationMatches, type ExhibitionSchedule, type PublicationListStatus } from "./master-list-state";

export const EXHIBITION_LIST_UPDATED_EVENT = "muuzee:exhibition-updated";

export type ExhibitionListRow = {
  id: string;
  title: string;
  updated_at: string;
  publication_status: string;
  occurrence: {
    start_date: string | null;
    end_date: string | null;
    venue: { id: string; name: string } | null;
  } | null;
  venue_resolution_status: string;
  artist_count: number;
  has_unresolved_artist: boolean;
  image: {
    kind: "primary" | "candidate" | "missing";
    rights_status: string | null;
    thumbnail_url: string | null;
  };
};

export type ExhibitionListResult = {
  rows: ExhibitionListRow[];
  total: number;
  allTotal: number;
  page: number;
  pageSize: number;
  totalPages: number;
  configured: boolean;
  error: string | null;
};

export type ExhibitionListUpdate = {
  id: string;
  publication_status?: string;
  row?: ExhibitionListRow;
};

export type ExhibitionListRowMembershipResult =
  | { matches: true; row: ExhibitionListRow }
  | { matches: false };

type ScheduleOccurrence = {
  start_date: string | null;
  end_date: string | null;
};

export function occurrenceMatchesSchedule(occurrence: ScheduleOccurrence, schedule: ExhibitionSchedule, today: string) {
  const unknown = !occurrence.start_date && !occurrence.end_date;
  const past = Boolean(occurrence.end_date && occurrence.end_date < today);
  if (schedule === "unknown") return unknown;
  if (schedule === "past") return past;
  if (schedule === "current_upcoming") return !unknown && !past;
  return true;
}

export function exhibitionMatchesSchedule(occurrences: readonly ScheduleOccurrence[], schedule: ExhibitionSchedule, today: string) {
  if (schedule === "all") return true;
  if (!occurrences.length) return schedule === "unknown";
  return occurrences.some((occurrence) => occurrenceMatchesSchedule(occurrence, schedule, today));
}

export function exhibitionListRowMatchesFilters(
  row: ExhibitionListRow,
  filters: { q?: string; status?: string; image?: string; schedule?: string },
  today: string,
) {
  if (!publicationMatches(row.publication_status, normalizePublicationStatus(filters.status))) return false;
  const query = filters.q?.trim().toLocaleLowerCase();
  if (query && !row.title.toLocaleLowerCase().includes(query)) return false;
  if (filters.image === "present" && row.image.kind !== "primary") return false;
  if (filters.image === "missing" && row.image.kind === "primary") return false;
  const occurrences = row.occurrence ? [row.occurrence] : [];
  return exhibitionMatchesSchedule(occurrences, normalizeExhibitionSchedule(filters.schedule), today);
}

export function isExhibitionListUpdate(value: unknown): value is ExhibitionListUpdate {
  if (!value || typeof value !== "object") return false;
  const detail = value as Record<string, unknown>;
  return typeof detail.id === "string"
    && (detail.publication_status === undefined || typeof detail.publication_status === "string");
}

export function applyExhibitionPublicationUpdate(
  rows: ExhibitionListRow[],
  update: ExhibitionListUpdate,
  activeStatus: PublicationListStatus,
) {
  const index = rows.findIndex((row) => row.id === update.id);
  if (index < 0 || !update.publication_status) return { rows, removed: false, previousIndex: -1 };
  if (!publicationMatches(update.publication_status, activeStatus)) {
    return { rows: rows.filter((row) => row.id !== update.id), removed: true, previousIndex: index };
  }
  const incoming = update.row || { ...rows[index], publication_status: update.publication_status };
  return {
    rows: rows.map((row) => row.id === update.id ? incoming : row),
    removed: false,
    previousIndex: index,
  };
}

export function nextFocusIdAfterRemoval(rows: ExhibitionListRow[], removedIndex: number) {
  return rows[removedIndex]?.id || rows[removedIndex - 1]?.id;
}
