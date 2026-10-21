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

export type ExhibitionPublicationClientState<T> = {
  requestedQuery: string;
  committed: {
    query: string;
    result: T;
  };
};

export function requestExhibitionPublicationState<T>(
  state: ExhibitionPublicationClientState<T>,
  requestedQuery: string,
  cachedResult?: T,
): ExhibitionPublicationClientState<T> {
  return {
    requestedQuery,
    committed: cachedResult === undefined
      ? state.committed
      : { query: requestedQuery, result: cachedResult },
  };
}

export function commitExhibitionPublicationState<T>(
  state: ExhibitionPublicationClientState<T>,
  requestedQuery: string,
  result: T,
): ExhibitionPublicationClientState<T> {
  return {
    ...state,
    requestedQuery,
    committed: { query: requestedQuery, result },
  };
}

export function failExhibitionPublicationState<T>(
  state: ExhibitionPublicationClientState<T>,
  usedCachedResult: boolean,
): ExhibitionPublicationClientState<T> {
  if (usedCachedResult) return state;
  return { ...state, requestedQuery: state.committed.query };
}

export function isCurrentExhibitionListRequest(
  requestQuery: string,
  currentQuery: string,
  request: number,
  latest: number,
) {
  return requestQuery === currentQuery && isLatestExhibitionListRequest(request, latest);
}
