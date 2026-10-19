"use client";

/* eslint-disable @next/next/no-img-element */

import { usePathname } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { applyExhibitionPublicationUpdate, EXHIBITION_LIST_UPDATED_EVENT, isExhibitionListUpdate, nextFocusIdAfterRemoval, type ExhibitionListResult, type ExhibitionListRow } from "@/lib/admin/exhibition-list-state";
import { canonicalizeExhibitionScheduleQuery, mergeUniqueRows, normalizePublicationStatus, pageQuery, replaceRowInPlace, selectedQuery, shouldActivateListRowFromKeyboard } from "@/lib/admin/master-list-state";
import { formatAdminDateTime } from "@/lib/admin/admin-date-time";
import { AdminRelationCount } from "./admin-relation-count";
import { ExhibitionDetailDrawer } from "./exhibition-detail-drawer";

export function ExhibitionList({ result, queryString, initialSelectedId }: { result: ExhibitionListResult; queryString: string; initialSelectedId?: string }) {
  const pathname = usePathname();
  const [rows, setRows] = useState(result.rows);
  const [total, setTotal] = useState(result.total);
  const [page, setPage] = useState(1);
  const [loadingMore, setLoadingMore] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [retryKey, setRetryKey] = useState(0);
  const [activeSelectedId, setActiveSelectedId] = useState<string | undefined>(initialSelectedId);
  const sentinel = useRef<HTMLDivElement>(null);
  const rowsRef = useRef(rows);
  const latestResult = useRef(result);
  rowsRef.current = rows;
  latestResult.current = result;
  const activeStatus = useMemo(() => normalizePublicationStatus(new URLSearchParams(queryString).get("status")), [queryString]);
  const hasMore = rows.length < total;

  useEffect(() => {
    setRows(latestResult.current.rows);
    setTotal(latestResult.current.total);
    setPage(1);
    setLoadError("");
  }, [queryString]);

  const openDrawer = useCallback((id: string) => {
    setActiveSelectedId(id);
    const current = canonicalizeExhibitionScheduleQuery(window.location.search.slice(1));
    const query = selectedQuery(current, id);
    window.history.pushState(null, "", `${pathname}${query ? `?${query}` : ""}`);
  }, [pathname]);

  const clearSelected = useCallback(() => {
    setActiveSelectedId(undefined);
    const current = canonicalizeExhibitionScheduleQuery(window.location.search.slice(1));
    const query = selectedQuery(current, null);
    window.history.replaceState(null, "", `${pathname}${query ? `?${query}` : ""}`);
  }, [pathname]);

  useEffect(() => {
    const syncSelection = () => setActiveSelectedId(new URLSearchParams(window.location.search).get("selected") || undefined);
    window.addEventListener("popstate", syncSelection);
    return () => window.removeEventListener("popstate", syncSelection);
  }, []);

  useEffect(() => {
    const updateList = async (event: Event) => {
      const detail = event instanceof CustomEvent ? event.detail : null;
      if (!isExhibitionListUpdate(detail)) return;
      if (detail.publication_status) {
        const next = applyExhibitionPublicationUpdate(rowsRef.current, detail, activeStatus);
        const focusId = nextFocusIdAfterRemoval(next.rows, next.previousIndex);
        rowsRef.current = next.rows;
        setRows(next.rows);
        if (next.removed) {
          setTotal((current) => Math.max(0, current - 1));
          if (activeSelectedId === detail.id || new URLSearchParams(window.location.search).get("selected") === detail.id) clearSelected();
          window.requestAnimationFrame(() => window.requestAnimationFrame(() => {
            const target = focusId
              ? document.querySelector<HTMLElement>(`[data-exhibition-detail-trigger="${focusId}"]`)
              : document.querySelector<HTMLElement>('[aria-label="検索・絞り込み"]');
            target?.focus({ preventScroll: true });
          }));
        }
        return;
      }
      try {
        const response = await fetch(`/api/admin/exhibitions/${detail.id}/list-row?${pageQuery(queryString, 1)}`, { cache: "no-store" });
        const body = await response.json() as ExhibitionListRow & { error?: string };
        if (!response.ok || body.error) throw new Error(body.error || "一覧の更新に失敗しました。");
        setRows((current) => {
          const next = replaceRowInPlace(current, body);
          rowsRef.current = next;
          return next;
        });
      } catch (error) {
        setLoadError(error instanceof Error ? error.message : "一覧の更新に失敗しました。");
      }
    };
    window.addEventListener(EXHIBITION_LIST_UPDATED_EVENT, updateList);
    return () => window.removeEventListener(EXHIBITION_LIST_UPDATED_EVENT, updateList);
  }, [activeSelectedId, activeStatus, clearSelected, queryString]);

  useEffect(() => {
    const target = sentinel.current;
    if (!target || !hasMore || loadingMore || loadError) return;
    const observer = new IntersectionObserver(async ([entry]) => {
      if (!entry.isIntersecting || loadingMore) return;
      setLoadingMore(true);
      setLoadError("");
      try {
        const nextPage = page + 1;
        const response = await fetch(`/api/admin/exhibitions?${pageQuery(queryString, nextPage)}`, { cache: "no-store" });
        const body = await response.json() as ExhibitionListResult;
        if (!response.ok || body.error) throw new Error(body.error || "追加読み込みに失敗しました。");
        setRows((current) => {
          const next = mergeUniqueRows(current, body.rows);
          rowsRef.current = next;
          return next;
        });
        setTotal(body.total);
        setPage(nextPage);
      } catch (error) {
        setLoadError(error instanceof Error ? error.message : "追加読み込みに失敗しました。");
      } finally {
        setLoadingMore(false);
      }
    }, { rootMargin: "320px 0px" });
    observer.observe(target);
    return () => observer.disconnect();
  }, [hasMore, loadingMore, loadError, page, queryString, retryKey]);

  return <>
    <div className="list-summary"><strong>{total}</strong>件{result.allTotal !== total ? `（全${result.allTotal}件中）` : ""} · 表示中 {rows.length}件</div>
    <div className="table-wrap"><table className="admin-exhibition-table"><thead><tr><th>画像</th><th>展示会</th><th>会場 / 会期</th><th>会場照合</th><th>関連</th><th>画像状態</th><th>更新</th></tr></thead><tbody>
      {rows.map((item) => <tr className="master-row" tabIndex={0} role="button" aria-label={`${item.title}の詳細を開く`} key={item.id} data-exhibition-detail-trigger={item.id} onClick={() => openDrawer(item.id)} onKeyDown={(event) => { if (shouldActivateListRowFromKeyboard(event.key, event.target === event.currentTarget)) { event.preventDefault(); openDrawer(item.id); } }}>
        <td>{item.image.thumbnail_url ? <img className="thumb" alt="" src={item.image.thumbnail_url}/> : <span className="thumb"/>}</td>
        <td><strong>{item.title}</strong></td>
        <td>{item.occurrence?.venue?.name || "-"}<br/><span className="muted">{item.occurrence?.start_date || "?"} – {item.occurrence?.end_date || "?"}</span></td>
        <td><span className={`status ${item.venue_resolution_status}`}>{item.venue_resolution_status}</span></td>
        <td><AdminRelationCount items={[{ kind: "artists", count: item.artist_count }]}/>{item.has_unresolved_artist ? <><br/><small className="muted">未解決候補あり</small></> : null}</td>
        <td><span className={`status ${item.image.rights_status || ""}`}>{item.image.kind === "primary" ? item.image.rights_status : item.image.kind === "candidate" ? "API candidate" : "missing"}</span></td>
        <td>{formatAdminDateTime(item.updated_at)}</td>
      </tr>)}
      {!rows.length && <tr><td colSpan={7} className="empty-state">条件に合う展覧会はありません。</td></tr>}
    </tbody></table></div>
    <div ref={sentinel} className="infinite-scroll-status" aria-live="polite">{loadingMore ? "追加読み込み中..." : loadError ? <><span>{loadError}</span><button className="button secondary" onClick={() => { setLoadError(""); setRetryKey((value) => value + 1); }}>再試行</button></> : hasMore ? "下へスクロールすると次の50件を読み込みます" : `全${total}件を表示しました`}</div>
    <ExhibitionDetailDrawer selectedId={activeSelectedId} onRequestClose={() => setActiveSelectedId(undefined)}/>
  </>;
}
