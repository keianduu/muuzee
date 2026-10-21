"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { AdminListControls } from "./admin-list-controls";
import { ExhibitionList } from "./exhibition-list";
import { EXHIBITION_LIST_UPDATED_EVENT, type ExhibitionListResult } from "@/lib/admin/exhibition-list-state";
import {
  exhibitionClientListQuery,
  exhibitionFirstPageCacheKey,
  exhibitionFirstPageRequestQuery,
  exhibitionListPath,
  isLatestExhibitionListRequest,
} from "@/lib/admin/exhibition-publication-client-state";
import { normalizePublicationStatus, type PublicationListStatus } from "@/lib/admin/master-list-state";

type ValidListState = { query: string; result: ExhibitionListResult };

export function ExhibitionListShell({
  initialResult,
  initialQueryString,
  initialSelectedId,
}: {
  initialResult: ExhibitionListResult;
  initialQueryString: string;
  initialSelectedId?: string;
}) {
  const initialQuery = exhibitionClientListQuery(initialQueryString);
  const [queryString, setQueryString] = useState(initialQuery);
  const [result, setResult] = useState(initialResult);
  const [pendingStatus, setPendingStatus] = useState<PublicationListStatus | null>(null);
  const [switchError, setSwitchError] = useState("");
  const [retryQuery, setRetryQuery] = useState<string | null>(null);
  const queryRef = useRef(initialQuery);
  const resultRef = useRef(initialResult);
  const cacheRef = useRef(new Map([[exhibitionFirstPageCacheKey(initialQuery), initialResult]]));
  const requestGeneration = useRef(0);
  const requestController = useRef<AbortController | null>(null);

  const applyListState = useCallback((next: ValidListState) => {
    queryRef.current = next.query;
    resultRef.current = next.result;
    setQueryString(next.query);
    setResult(next.result);
  }, []);

  useEffect(() => {
    const nextQuery = exhibitionClientListQuery(initialQueryString);
    requestController.current?.abort();
    requestGeneration.current += 1;
    cacheRef.current.clear();
    cacheRef.current.set(exhibitionFirstPageCacheKey(nextQuery), initialResult);
    applyListState({ query: nextQuery, result: initialResult });
    setPendingStatus(null);
    setSwitchError("");
    setRetryQuery(null);
  }, [applyListState, initialQueryString, initialResult]);

  const fetchFirstPage = useCallback(async (
    requestedQuery: string,
    previous: ValidListState,
    hasCachedResult: boolean,
  ) => {
    requestController.current?.abort();
    const controller = new AbortController();
    requestController.current = controller;
    const generation = ++requestGeneration.current;
    try {
      const response = await fetch(`/api/admin/exhibitions?${exhibitionFirstPageRequestQuery(requestedQuery)}`, {
        cache: "no-store",
        signal: controller.signal,
      });
      const body = await response.json() as ExhibitionListResult;
      if (!response.ok || body.error) throw new Error(body.error || "展覧会一覧の取得に失敗しました。");
      if (!isLatestExhibitionListRequest(generation, requestGeneration.current)) return;
      cacheRef.current.set(exhibitionFirstPageCacheKey(requestedQuery), body);
      applyListState({ query: requestedQuery, result: body });
      setPendingStatus(null);
      setSwitchError("");
      setRetryQuery(null);
    } catch (error) {
      if (controller.signal.aborted || !isLatestExhibitionListRequest(generation, requestGeneration.current)) return;
      setPendingStatus(null);
      setSwitchError(error instanceof Error ? error.message : "展覧会一覧の取得に失敗しました。");
      setRetryQuery(requestedQuery);
      if (!hasCachedResult) {
        applyListState(previous);
        window.history.replaceState(null, "", exhibitionListPath(window.location.pathname, previous.query));
      }
    }
  }, [applyListState]);

  const switchToQuery = useCallback((requestedQuery: string, pushHistory: boolean) => {
    const nextQuery = exhibitionClientListQuery(requestedQuery);
    if (nextQuery === queryRef.current && !switchError) return;
    const previous = { query: queryRef.current, result: resultRef.current };
    const cached = cacheRef.current.get(exhibitionFirstPageCacheKey(nextQuery));
    if (pushHistory) window.history.pushState(null, "", exhibitionListPath(window.location.pathname, nextQuery));
    applyListState({ query: nextQuery, result: cached ?? previous.result });
    setPendingStatus(normalizePublicationStatus(new URLSearchParams(nextQuery).get("status")));
    setSwitchError("");
    setRetryQuery(null);
    void fetchFirstPage(nextQuery, previous, Boolean(cached));
  }, [applyListState, fetchFirstPage, switchError]);

  const switchPublicationStatus = useCallback((status: PublicationListStatus) => {
    switchToQuery(exhibitionClientListQuery(window.location.search.slice(1), status), true);
  }, [switchToQuery]);

  useEffect(() => {
    const restorePublicationState = () => {
      const nextQuery = exhibitionClientListQuery(window.location.search.slice(1));
      if (nextQuery === queryRef.current) return;
      switchToQuery(nextQuery, false);
    };
    window.addEventListener("popstate", restorePublicationState);
    return () => window.removeEventListener("popstate", restorePublicationState);
  }, [switchToQuery]);

  useEffect(() => {
    const invalidateFirstPages = () => cacheRef.current.clear();
    window.addEventListener(EXHIBITION_LIST_UPDATED_EVENT, invalidateFirstPages);
    return () => window.removeEventListener(EXHIBITION_LIST_UPDATED_EVENT, invalidateFirstPages);
  }, []);

  const params = Object.fromEntries(new URLSearchParams(queryString));

  return <>
    <AdminListControls
      entity="exhibitions"
      params={params}
      publicationStatus={normalizePublicationStatus(new URLSearchParams(queryString).get("status"))}
      publicationPendingStatus={pendingStatus}
      onPublicationStatusChange={switchPublicationStatus}
    />
    <div className="admin-publication-switch-feedback" aria-live="polite">
      {pendingStatus && <span className="muted">一覧を更新中...</span>}
      {switchError && <span className="error admin-publication-switch-error">{switchError}<button className="button secondary" type="button" onClick={() => retryQuery && switchToQuery(retryQuery, exhibitionClientListQuery(window.location.search.slice(1)) !== retryQuery)}>再試行</button></span>}
    </div>
    <ExhibitionList result={result} queryString={queryString} initialSelectedId={initialSelectedId}/>
  </>;
}
