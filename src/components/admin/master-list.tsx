"use client";

/* eslint-disable @next/next/no-img-element */

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { AdminFloatingBulkActions } from "./admin-floating-bulk-actions";
import { AdminRelationCount } from "./admin-relation-count";
import { MasterDetailDrawer } from "./master-detail-drawer";
import { MASTER_CONFIGS, type MasterEntity } from "@/lib/admin/master-config";
import type { MasterListResult } from "@/lib/admin/master-repository";
import { applyBulkPublicationState, mergeUniqueRows, normalizePublicationStatus, pageQuery, rebuildLoadedRows, replaceRowInPlace, selectedQuery, shouldActivateListRowFromKeyboard, type WorkListView } from "@/lib/admin/master-list-state";
import { MASTER_LIST_COLUMNS, venueCoordinatePresentation } from "@/lib/admin/admin-list-presentation";
import { hasWorkTitle, workDisplayTitleJa } from "@/lib/work-title";
import { workCandidateAdoptionReasons } from "@/lib/work-collection/adoption";

type ListRow = MasterListResult["rows"][number];
type WorkCandidateRow = { id: string; artist_id: string | null; matched_work_id: string | null; title: string; title_ja: string | null; title_en: string | null; title_original: string | null; original_language: string | null; year_text: string | null; source_artist_name: string | null; source_venue_name: string | null; matched_venue_id: string | null; holding_type: string | null; presentation_type: string | null; presentation_status: string | null; match_status: string; representative_reason: string; source_url: string | null; data_sources?: { name?: string; key?: string } | Array<{ name?: string; key?: string }> };
type WorkTargetedResult = { dryRun: boolean; artists: number; artistFound: number; candidates: number; saved: number; autoApplied: number; needsReview: number; duplicates: number; ambiguous: number; coverage: Array<{ artistName: string; candidateCount: number; venueMatchCount: number; yearCount: number; permanentCount: number; currentDisplayCount: number; sourceErrors: string[] }>; candidateRows: WorkCandidateRow[] };

function relationLabel(value: unknown, relation: string, key: string) {
  const list = (value || []) as Array<Record<string, unknown>>;
  return list.map((item) => {
    const linked = item[relation];
    const record = Array.isArray(linked) ? linked[0] : linked;
    return record && typeof record === "object" ? String((record as Record<string, unknown>)[key] || "") : "";
  }).filter(Boolean).join(" / ") || "未設定";
}

function rowsFor(entity: MasterEntity, rows: ListRow[]) {
  if (entity === "venues") return rows.map((row) => {
    const coordinates = venueCoordinatePresentation(row.latitude, row.longitude);
    return {
      row,
      cells: [String(row.name || "未設定"), String(row.venue_type || "未設定"),
        coordinates
          ? <a key="coordinates" className="admin-coordinate-link" href={coordinates.href} target="_blank" rel="noreferrer" aria-label={`${String(row.name || "会場")}をGoogle Mapsで開く`} onClick={(event) => event.stopPropagation()}>{coordinates.label} <span aria-hidden="true">↗</span></a>
          : "—",
        <AdminRelationCount key="relations" items={[
          { kind: "exhibitions", count: ((row.exhibition_occurrences || []) as unknown[]).length },
          { kind: "works", count: ((row.collection_holdings || []) as unknown[]).length },
        ]}/>],
    };
  });
  if (entity === "artists") return rows.map((row) => ({
    row,
    cells: [String(row.name || "未設定"), String(row.name_en || "未設定"), String(row.nationality_country_code || "未設定"), [row.birth_year || row.birth_date || "?", row.death_year || row.death_date || "?"].join(" – "),
      <AdminRelationCount key="relations" items={[
        { kind: "exhibitions", count: ((row.exhibition_artists || []) as unknown[]).length },
        { kind: "works", count: ((row.work_artists || []) as unknown[]).length },
      ]}/>],
  }));
  return rows.map((row) => ({
    row,
    cells: [workDisplayTitleJa(row) || "未設定", relationLabel(row.work_artists, "artists", "name"), String(row.year_text || row.created_year_from || "未設定"), relationLabel(row.collection_holdings, "venues", "name")],
  }));
}

const headings: Record<MasterEntity, readonly string[]> = {
  venues: MASTER_LIST_COLUMNS.venues.slice(0, -1),
  artists: MASTER_LIST_COLUMNS.artists.slice(0, -1),
  works: MASTER_LIST_COLUMNS.works.slice(0, -1),
};

export function MasterList({ entity, result, queryString, workView = "adopted" }: { entity: MasterEntity; result: MasterListResult; queryString: string; workView?: WorkListView }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const config = MASTER_CONFIGS[entity];
  const [rows, setRows] = useState(result.rows);
  const [page, setPage] = useState(1);
  const [loadingMore, setLoadingMore] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [retryKey, setRetryKey] = useState(0);
  const sentinel = useRef<HTMLDivElement>(null);
  const latestInitialRows = useRef(result.rows);
  latestInitialRows.current = result.rows;
  const [selected, setSelected] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [workTargetedResult, setWorkTargetedResult] = useState<WorkTargetedResult | null>(null);
  const [workCandidateSelected, setWorkCandidateSelected] = useState<string[]>([]);
  const [workCandidatesLoading, setWorkCandidatesLoading] = useState(entity === "works");
  const [workCandidatesError, setWorkCandidatesError] = useState("");
  const displayRows = useMemo(() => rowsFor(entity, rows), [entity, rows]);
  const hasMore = rows.length < result.total;
  const bulkAvailable = entity !== "works" || workView === "adopted";

  useEffect(() => { setRows(latestInitialRows.current); setPage(1); setLoadError(""); setSelected([]); }, [queryString]);

  useEffect(() => {
    setSelected((current) => current.filter((id) => rows.some((row) => row.id === id)));
  }, [rows]);

  useEffect(() => {
    const active = bulkAvailable && selected.length > 0;
    document.body.classList.toggle("is-master-selection-active", active);
    return () => document.body.classList.remove("is-master-selection-active");
  }, [bulkAvailable, selected.length]);

  useEffect(() => {
    if (entity !== "works") return;
    setWorkCandidatesLoading(true);
    setWorkCandidatesError("");
    fetch("/api/admin/works/targeted-import", { cache: "no-store" }).then((response) => response.json()).then((body) => {
      if (Array.isArray(body.candidateRows)) setWorkTargetedResult({ dryRun: false, artists: 0, artistFound: 0, candidates: body.candidateRows.length, saved: 0, autoApplied: 0, needsReview: body.candidateRows.filter((row: WorkCandidateRow) => row.match_status !== "imported").length, duplicates: body.candidateRows.filter((row: WorkCandidateRow) => row.match_status === "duplicate").length, ambiguous: body.candidateRows.filter((row: WorkCandidateRow) => row.match_status === "ambiguous").length, coverage: [], candidateRows: body.candidateRows });
      else setWorkCandidatesError(body.error || "作品候補を取得できませんでした。");
    }).catch(() => setWorkCandidatesError("作品候補を取得できませんでした。")).finally(() => setWorkCandidatesLoading(false));
  }, [entity]);

  useEffect(() => {
    const reloadList = async (event: Event) => {
      try {
        const detail = event instanceof CustomEvent ? event.detail as { entity?: MasterEntity; id?: string; preserveListOrder?: boolean } : null;
        if (detail?.preserveListOrder && detail.entity === entity && detail.id) {
          const response = await fetch(`/api/admin/masters/${entity}/${detail.id}`, { cache: "no-store" });
          const body = await response.json() as ListRow & { error?: string };
          if (!response.ok || body.error) throw new Error(body.error || "一覧の更新に失敗しました。");
          setRows((current) => replaceRowInPlace(current, body));
          return;
        }
        const response = await fetch(`/api/admin/masters/${entity}?${pageQuery(queryString, 1)}`, { cache: "no-store" });
        const body = await response.json() as MasterListResult;
        if (!response.ok || body.error) throw new Error(body.error || "一覧の更新に失敗しました。");
        setRows(body.rows); setPage(1); setLoadError("");
      } catch (error) { setLoadError(error instanceof Error ? error.message : "一覧の更新に失敗しました。"); }
    };
    window.addEventListener("muuzee:master-updated", reloadList);
    return () => window.removeEventListener("muuzee:master-updated", reloadList);
  }, [entity, queryString]);

  useEffect(() => {
    if (entity === "works" && workView !== "adopted") return;
    const target = sentinel.current;
    if (!target || !hasMore || loadingMore || loadError || busy) return;
    const observer = new IntersectionObserver(async ([entry]) => {
      if (!entry.isIntersecting || loadingMore || busy) return;
      setLoadingMore(true); setLoadError("");
      try {
        const nextPage = page + 1;
        const response = await fetch(`/api/admin/masters/${entity}?${pageQuery(queryString, nextPage)}`, { cache: "no-store" });
        const body = await response.json() as MasterListResult;
        if (!response.ok || body.error) throw new Error(body.error || "追加読み込みに失敗しました。");
        setRows((current) => mergeUniqueRows(current, body.rows));
        setPage(nextPage);
      } catch (error) { setLoadError(error instanceof Error ? error.message : "追加読み込みに失敗しました。"); }
      finally { setLoadingMore(false); }
    }, { rootMargin: "320px 0px" });
    observer.observe(target);
    return () => observer.disconnect();
  }, [entity, hasMore, loadingMore, loadError, page, queryString, retryKey, workView, busy]);

  function openDrawer(id: string) {
    router.push(`${pathname}?${selectedQuery(searchParams.toString(), id)}`, { scroll: false });
  }

  async function jsonRequest(url: string, init: RequestInit) {
    setBusy(true); setMessage("");
    try {
      const response = await fetch(url, init); const body = await response.json();
      if (!response.ok) throw new Error(body.error || "Request failed");
      setMessage(body.message || JSON.stringify(body)); router.refresh(); return body;
    } catch (error) { setMessage(error instanceof Error ? error.message : "Request failed"); return null; }
    finally { setBusy(false); }
  }

  async function bulk(action: "publish" | "unpublish") {
    if (!selected.length) { setMessage("対象を選択してください。"); return; }
    const label = action === "publish" ? "公開" : "非公開";
    if (!window.confirm(`${selected.length}件を${label}にしますか？`)) return;
    setBusy(true); setMessage("");
    try {
      const pageDepth = page;
      const scrollTop = window.scrollY;
      const restoreScroll = () => requestAnimationFrame(() => window.scrollTo({ top: scrollTop, behavior: "auto" }));
      const response = await fetch(`/api/admin/masters/${entity}/bulk-publication`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ids: selected, action }) });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "一括更新に失敗しました。");
      const activeStatus = normalizePublicationStatus(searchParams.get("status"));
      setRows((current) => applyBulkPublicationState(current, selected, action, activeStatus));
      setSelected([]);
      restoreScroll();
      try {
        const loadedPages = await Promise.all(Array.from({ length: pageDepth }, async (_, index) => {
          const listResponse = await fetch(`/api/admin/masters/${entity}?${pageQuery(queryString, index + 1)}`, { cache: "no-store" });
          const listBody = await listResponse.json() as MasterListResult;
          if (!listResponse.ok || listBody.error) throw new Error(listBody.error || "一覧の再取得に失敗しました。");
          return listBody.rows;
        }));
        setRows(rebuildLoadedRows(loadedPages));
        setPage(pageDepth);
        setLoadError("");
        restoreScroll();
      } catch (error) {
        setLoadError(error instanceof Error ? `一括更新は完了しました。${error.message}` : "一括更新は完了しました。一覧の再取得に失敗しました。");
      }
      setMessage(body.message || `${body.count ?? selected.length}件を${label}にしました。`);
      router.refresh();
    } catch (error) { setMessage(error instanceof Error ? error.message : "一括更新に失敗しました。"); }
    finally { setBusy(false); }
  }

  async function adoptWorkCandidates(candidateIds: string[]) {
    if (!candidateIds.length || !window.confirm(`${candidateIds.length}件をDraft Workとして採用しますか？`)) return;
    const body = await jsonRequest("/api/admin/works/candidates/adopt", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ candidateIds }) });
    if (body?.candidateRows) {
      setWorkTargetedResult((current) => current ? { ...current, candidateRows: body.candidateRows } : current);
      setWorkCandidateSelected([]);
      window.dispatchEvent(new CustomEvent("muuzee:master-updated"));
    }
  }

  const masterTable = <>
    <div className="list-summary"><strong>{result.total}</strong>件{result.allTotal !== result.total ? `（全${result.allTotal}件中）` : ""} · 表示中 {rows.length}件</div>
    <div className="table-wrap"><table className={`admin-master-table admin-master-table--${entity}`}><thead><tr><th><input aria-label="表示中の項目をすべて選択" type="checkbox" checked={Boolean(displayRows.length) && displayRows.every(({ row }) => selected.includes(row.id))} onChange={(event) => setSelected(event.target.checked ? displayRows.map(({ row }) => row.id) : [])}/></th><th>画像</th>{headings[entity].map((heading) => <th key={heading}>{heading}</th>)}<th>更新</th></tr></thead><tbody>
      {displayRows.map(({ row, cells }) => <tr className="master-row" tabIndex={0} role="button" aria-label={`${String(row[config.titleKey] || row.id)}の詳細を開く`} key={row.id} onClick={() => openDrawer(row.id)} onKeyDown={(event) => { if (shouldActivateListRowFromKeyboard(event.key, event.target === event.currentTarget)) { event.preventDefault(); openDrawer(row.id); } }}><td><input aria-label={`Select ${String(row[config.titleKey] || row.id)}`} type="checkbox" checked={selected.includes(row.id)} onClick={(event) => event.stopPropagation()} onChange={(event) => setSelected(event.target.checked ? [...selected, row.id] : selected.filter((id) => id !== row.id))}/></td><td>{row.signedImageUrl ? <img className="thumb" src={row.signedImageUrl} alt=""/> : <span className="thumb"/>}</td>{(cells as ReactNode[]).map((cell, index) => <td key={`${row.id}-${headings[entity][index]}`}>{index === 0 ? <strong>{cell}</strong> : cell}</td>)}<td>{new Date(row.updated_at).toLocaleString("ja-JP")}</td></tr>)}
      {!displayRows.length && <tr><td colSpan={headings[entity].length + 3} className="empty-state">条件に合う{config.label}はありません。絞り込みを変更するか、新規追加 / CSVから追加できます。</td></tr>}
    </tbody></table></div>
    <div ref={sentinel} className="infinite-scroll-status" aria-live="polite">{loadingMore ? "追加読み込み中..." : loadError ? <><span>{loadError}</span><button className="button secondary" onClick={() => { setLoadError(""); setRetryKey((value) => value + 1); }}>再試行</button></> : hasMore ? "下へスクロールすると次の50件を読み込みます" : `全${result.total}件を表示しました`}</div>
  </>;

  return <>
    {bulkAvailable && <AdminFloatingBulkActions selectedCount={selected.length} busy={busy} onPublish={() => bulk("publish")} onUnpublish={() => bulk("unpublish")} onClear={() => setSelected([])}/>}

    {entity === "works" && workView === "candidates" && <section id="works-candidates-panel" role="tabpanel" aria-labelledby="works-candidates-tab" className="card work-candidates-panel"><h2>作品候補</h2><p className="muted">Core 3/3とSource Policyを満たすArtist / Holding relationは自動反映します。曖昧・未解決Candidateは採用せず、Presentation情報は候補に保持したままReview対象とします。</p>{workCandidatesLoading ? <p className="empty-state" aria-live="polite">Loading...（作品候補を読み込み中）</p> : workCandidatesError ? <div className="error">{workCandidatesError}</div> : workTargetedResult ? <><div className="preview-counts"><span className="status">Artists: {workTargetedResult.artists || "—"}</span><span className="status approved">Artist found: {workTargetedResult.artistFound || "—"}</span><span className="status">Candidates: {workTargetedResult.candidates}</span><span className="status">Saved: {workTargetedResult.saved}</span><span className="status approved">Auto applied: {workTargetedResult.autoApplied}</span><span className="status">Needs review: {workTargetedResult.needsReview}</span><span className="status">Duplicates: {workTargetedResult.duplicates}</span><span className="status rejected">Ambiguous: {workTargetedResult.ambiguous}</span></div>{workTargetedResult.coverage.length > 0 && <div className="table-wrap"><table><thead><tr><th>Artist</th><th>Candidates</th><th>Venue match</th><th>Year</th><th>Permanent</th><th>Current</th><th>Source issue</th></tr></thead><tbody>{workTargetedResult.coverage.map((row) => <tr key={row.artistName}><td>{row.artistName}</td><td>{row.candidateCount}</td><td>{row.venueMatchCount}</td><td>{row.yearCount}</td><td>{row.permanentCount}</td><td>{row.currentDisplayCount}</td><td>{row.sourceErrors.join(" / ") || "—"}</td></tr>)}</tbody></table></div>}<div className="actions"><button className="button secondary" disabled={busy || !workCandidateSelected.length} onClick={() => adoptWorkCandidates(workCandidateSelected)}>確認後に選択Candidateを採用</button></div><div className="table-wrap"><table><thead><tr><th>Select</th><th>Candidate</th><th>Artist / Match</th><th>Holding Venue / Match</th><th>Core</th><th>Year</th><th>Source</th><th>Holding / Display</th><th>Status</th><th>採用できない理由</th><th>Action</th></tr></thead><tbody>{workTargetedResult.candidateRows.map((row) => { const adoptionReasons = workCandidateAdoptionReasons(row); const adoptable = adoptionReasons.length === 0; const displayTitle = workDisplayTitleJa(row) || "未設定"; const source = Array.isArray(row.data_sources) ? row.data_sources[0] : row.data_sources; return <tr key={row.id}><td><input type="checkbox" aria-label={`${displayTitle}を選択`} disabled={!adoptable} checked={workCandidateSelected.includes(row.id)} onChange={(event) => setWorkCandidateSelected(event.target.checked ? [...workCandidateSelected, row.id] : workCandidateSelected.filter((id) => id !== row.id))}/></td><td>{row.source_url ? <a href={row.source_url} target="_blank" rel="noreferrer">{displayTitle}</a> : displayTitle}<br/><small className="muted">日本語: {row.title_ja || "—"} / 英語: {row.title_en || "—"} / 原題: {row.title_original || "—"}{row.original_language ? ` (${row.original_language})` : ""}</small><br/><small className="muted">{row.representative_reason || "代表性は要確認"}</small></td><td>{row.source_artist_name || "—"}<br/><small className="muted">{row.artist_id ? "Matched" : "Unmatched"}</small></td><td>{row.source_venue_name || "—"}<br/><small className="muted">{row.matched_venue_id ? "Matched" : "Unmatched"}</small></td><td>{hasWorkTitle(row) && row.artist_id && row.matched_venue_id ? "3/3" : "不足"}</td><td>{row.year_text || "—"}</td><td>{source?.name || source?.key || "—"}</td><td>{row.holding_type || "Not stated"} / {row.presentation_type || row.presentation_status || "Not stated"}</td><td>{row.match_status}{row.matched_work_id ? <><br/><small>{row.matched_work_id}</small></> : null}</td><td>{adoptionReasons.length ? adoptionReasons.join(" / ") : "—"}{busy && adoptable ? <><br/><small className="muted">別処理を実行中</small></> : null}</td><td><button className="button secondary" disabled={busy || !adoptable} onClick={() => adoptWorkCandidates([row.id])}>{row.match_status === "imported" ? "採用済み" : "この作品を採用"}</button></td></tr>; })}</tbody></table></div></> : <p className="empty-state">作品候補はありません。</p>}</section>}

    {message && <div className={message.includes("失敗") || message.includes("Invalid") || message.includes("不足") ? "error" : "notice"}>{message}</div>}
    {entity === "works" ? workView === "adopted" && <section id="works-adopted-panel" role="tabpanel" aria-labelledby="works-adopted-tab">{masterTable}</section> : masterTable}
    <MasterDetailDrawer entity={entity} selectedId={searchParams.get("selected") || undefined}/>
  </>;
}
