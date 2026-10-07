export function mergeUniqueRows<T extends { id: string }>(current: T[], incoming: T[]) {
  const known = new Set(current.map((row) => row.id));
  return [...current, ...incoming.filter((row) => !known.has(row.id))];
}

export function replaceRowInPlace<T extends { id: string }>(current: T[], incoming: T) {
  return current.map((row) => row.id === incoming.id ? incoming : row);
}

export function selectedQuery(current: string, selectedId: string | null) {
  const params = new URLSearchParams(current);
  if (selectedId) params.set("selected", selectedId);
  else {
    params.delete("selected");
    params.delete("panel");
    params.delete("candidate");
    params.delete("run");
    params.delete("targetUrl");
    params.delete("venueEdit");
  }
  return params.toString();
}

export function legacyDetailDestination(basePath: string, id: string, returnTo?: string) {
  const destination = returnTo?.startsWith(basePath) ? new URL(returnTo, "http://admin.local") : new URL(basePath, "http://admin.local");
  destination.searchParams.set("selected", id);
  return `${destination.pathname}?${destination.searchParams}`;
}

export type DetailPanel = "image" | "wikidata-fields" | "official-fields" | "coordinates";

export function detailPanelQuery(current: string, panel: DetailPanel | null, options: { candidateId?: string | null; runId?: string | null; targetUrl?: string | null } = {}) {
  const params = new URLSearchParams(current);
  if (panel) {
    params.set("panel", panel);
    if (options.candidateId) params.set("candidate", options.candidateId);
    else params.delete("candidate");
    if (options.runId) params.set("run", options.runId);
    else params.delete("run");
    if (options.targetUrl) params.set("targetUrl", options.targetUrl);
    else params.delete("targetUrl");
  } else {
    params.delete("panel");
    params.delete("candidate");
    params.delete("run");
    params.delete("targetUrl");
  }
  return params.toString();
}

export function pageQuery(current: string, page: number, pageSize = 50) {
  const params = new URLSearchParams(current);
  params.delete("selected");
  params.delete("panel");
  params.delete("candidate");
  params.delete("run");
  params.delete("targetUrl");
  params.delete("venueEdit");
  params.set("page", String(page));
  params.set("pageSize", String(pageSize));
  return params.toString();
}

export type PublicationListStatus = "published" | "unpublished" | "archived";
export type AdminListEntity = "venues" | "artists" | "works" | "exhibitions";
export type WorkListView = "adopted" | "candidates";
export const EXHIBITION_SCHEDULE_VALUES = ["current_upcoming", "past", "unknown", "all"] as const;
export type ExhibitionSchedule = typeof EXHIBITION_SCHEDULE_VALUES[number];

const LIST_FILTER_KEYS = [
  "q",
  "type",
  "image",
  "coordinates",
  "artistRelation",
  "holdingRelation",
  "presentation",
  "schedule",
  // Compatibility parameters removed from the visible filter UI.
  "active",
  "source",
  "match",
  "completeness",
  "tier",
  "nationality",
] as const;

function clearListNavigationState(params: URLSearchParams) {
  params.delete("page");
  params.delete("pageSize");
  params.delete("selected");
  params.delete("panel");
  params.delete("candidate");
  params.delete("run");
  params.delete("targetUrl");
  params.delete("venueEdit");
}

export function normalizePublicationStatus(value?: string | null): PublicationListStatus {
  if (value === "published" || value === "archived") return value;
  return "unpublished";
}

export function normalizeExhibitionSchedule(value?: string | null): ExhibitionSchedule {
  return EXHIBITION_SCHEDULE_VALUES.find((schedule) => schedule === value) ?? "current_upcoming";
}

export function canonicalizeExhibitionScheduleQuery(current: string) {
  const params = new URLSearchParams(current);
  const schedule = normalizeExhibitionSchedule(params.get("schedule"));
  if (schedule === "current_upcoming") params.delete("schedule");
  else params.set("schedule", schedule);
  return params.toString();
}

export function publicationMatches(recordStatus: string | null | undefined, selected: PublicationListStatus) {
  if (selected === "published") return recordStatus === "published";
  if (selected === "archived") return recordStatus === "archived";
  return recordStatus !== "published" && recordStatus !== "archived";
}

export function publicationTabQuery(current: string, status: PublicationListStatus) {
  const params = new URLSearchParams(current);
  clearListNavigationState(params);
  params.set("status", status);
  return params.toString();
}

export function workListViewQuery(current: string, view: WorkListView) {
  const params = new URLSearchParams(current);
  clearListNavigationState(params);
  if (view === "candidates") params.set("view", view);
  else params.delete("view");
  return params.toString();
}

export function splitListValue(value?: string | null) {
  return [...new Set((value ?? "").split(",").map((entry) => entry.trim()).filter(Boolean))];
}

export function binaryListValue(present: boolean, missing: boolean) {
  if (present === missing) return undefined;
  return present ? "present" : "missing";
}

export type ListFilterValues = {
  q?: string;
  type?: string[];
  image?: string;
  coordinates?: string;
  artistRelation?: string;
  holdingRelation?: string;
  presentation?: string;
  schedule?: ExhibitionSchedule;
};

export function listFilterQuery(current: string, entity: AdminListEntity, values: ListFilterValues = {}) {
  const params = new URLSearchParams(current);
  clearListNavigationState(params);
  for (const key of LIST_FILTER_KEYS) params.delete(key);
  params.set("status", normalizePublicationStatus(params.get("status")));

  const setValue = (key: string, value?: string) => {
    const normalized = value?.trim();
    if (normalized) params.set(key, normalized);
  };

  setValue("q", values.q);
  setValue("image", values.image);
  if (entity === "venues") {
    if (values.type?.length) params.set("type", [...new Set(values.type)].join(","));
    setValue("coordinates", values.coordinates);
  }
  if (entity === "works") {
    setValue("artistRelation", values.artistRelation);
    setValue("holdingRelation", values.holdingRelation);
    setValue("presentation", values.presentation);
  }
  if (entity === "exhibitions") {
    const schedule = normalizeExhibitionSchedule(values.schedule);
    if (schedule !== "current_upcoming") params.set("schedule", schedule);
  }
  return params.toString();
}
