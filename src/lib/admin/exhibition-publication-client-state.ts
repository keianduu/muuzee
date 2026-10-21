import {
  canonicalizeExhibitionScheduleQuery,
  normalizeExhibitionSchedule,
  normalizePublicationStatus,
  pageQuery,
  publicationTabQuery,
  type PublicationListStatus,
} from "./master-list-state";

export function exhibitionClientListQuery(current: string, status?: PublicationListStatus) {
  const canonical = canonicalizeExhibitionScheduleQuery(current);
  return canonicalizeExhibitionScheduleQuery(publicationTabQuery(
    canonical,
    status ?? normalizePublicationStatus(new URLSearchParams(canonical).get("status")),
  ));
}

export function exhibitionFirstPageCacheKey(current: string) {
  const query = new URLSearchParams(exhibitionClientListQuery(current));
  return JSON.stringify([
    normalizePublicationStatus(query.get("status")),
    normalizeExhibitionSchedule(query.get("schedule")),
    query.get("image") ?? "",
    query.get("q") ?? "",
  ]);
}

export function exhibitionFirstPageRequestQuery(current: string) {
  return pageQuery(exhibitionClientListQuery(current), 1, 50);
}

export function exhibitionListPath(pathname: string, query: string) {
  return query ? `${pathname}?${query}` : pathname;
}

export function isLatestExhibitionListRequest(request: number, latest: number) {
  return request === latest;
}
