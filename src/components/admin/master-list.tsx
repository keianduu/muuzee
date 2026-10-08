"use client";

/* eslint-disable @next/next/no-img-element */

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { MasterDetailDrawer } from "./master-detail-drawer";
import { MASTER_CONFIGS, type MasterEntity } from "@/lib/admin/master-config";
import { displayStatus } from "@/lib/admin/master-labels";
import type { MasterListResult } from "@/lib/admin/master-repository";
import { mergeUniqueRows, pageQuery, replaceRowInPlace, selectedQuery, type WorkListView } from "@/lib/admin/master-list-state";
import { effectiveVenueTier, venueImageStatus } from "@/lib/admin/venue-priority";
import { artistImageStatus, effectiveArtistTier } from "@/lib/admin/artist-priority";
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
  if (entity === "venues") return rows.map((row) => ({
    row,
    // Source and match state are kept visible after an API import so a reviewer
    // can immediately isolate new Wikidata records and possible duplicates.
    cells: [String(row.name || "未設定"), String(row.venue_type || "未設定"), String(row.address || "未設定"),
      row.latitude != null && row.longitude != null ? `${row.latitude}, ${row.longitude}` : "未設定",
      [...new Set(((row.source_records || []) as Array<{ data_sources?: { key?: string } | Array<{ key?: string }> }>).flatMap((source) => {
        const values = Array.isArray(source.data_sources) ? source.data_sources : source.data_sources ? [source.data_sources] : [];
        return values.map((value) => value.key).filter(Boolean);
      }))].join(" / ") || "未設定",
      ((row.source_records || []) as Array<{ data_sources?: { key?: string } | Array<{ key?: string }> }>).some((source) => (Array.isArray(source.data_sources) ? source.data_sources : source.data_sources ? [source.data_sources] : []).some((item) => item.key === "wikidata"))
        ? "Linked"
        : ((row.venue_external_match_candidates || []) as Array<{ status?: string }>).filter((item) => item.status === "candidate").length > 1
          ? `Source selection (${((row.venue_external_match_candidates || []) as Array<{ status?: string }>).filter((item) => item.status === "candidate").length})`
          : "No source link",
      `${((row.exhibition_occurrences || []) as unknown[]).length} exhibitions / ${((row.collection_holdings || []) as unknown[]).length} works`],
  }));
  if (entity === "artists") return rows.map((row) => ({
    row,
    cells: [String(row.name || "未設定"), String(row.name_en || "未設定"), String(row.nationality_country_code || "未設定"), [row.birth_year || row.birth_date || "?", row.death_year || row.death_date || "?"].join(" – "),
      `${((row.exhibition_artists || []) as unknown[]).length} exhibitions / ${((row.work_artists || []) as unknown[]).length} works`],
  }));
  return rows.map((row) => ({
    row,
    cells: [workDisplayTitleJa(row) || "未設定", relationLabel(row.work_artists, "artists", "name"), String(row.year_text || row.created_year_from || "未設定"), relationLabel(row.collection_holdings, "venues", "name")],
  }));
}

const headings: Record<MasterEntity, string[]> = {
  venues: ["Venue（会場）", "Type（種別）", "Address（住所）", "Coordinates（座標）", "Source（出典）", "Wikidata（照合）", "Relations（関連）"],
  artists: ["Artist（作家）", "Name EN（英語名）", "Nationality（国籍）", "Birth / Death（生没年）", "Relations（関連）"],
  works: ["Work（作品）", "Artist（作家）", "Year（制作年）", "Holding Venue（所蔵先）"],
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

  useEffect(() => { setRows(latestInitialRows.current); setPage(1); setLoadError(""); }, [queryString]);

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
    if (!target || !hasMore || loadingMore || loadError) return;
    const observer = new IntersectionObserver(async ([entry]) => {
      if (!entry.isIntersecting || loadingMore) return;
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
  }, [entity, hasMore, loadingMore, loadError, page, queryString, retryKey, workView]);

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
    if (!window.confirm(`${selected.length}件を${action}しますか？`)) return;
    await jsonRequest(`/api/admin/masters/${entity}/bulk-publication`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ids: selected, action }) });
    setSelected([]);
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
    <div className="table-wrap"><table><thead><tr><th><input aria-label="表示中の項目をすべて選択" type="checkbox" checked={Boolean(displayRows.length) && displayRows.every(({ row }) => selected.includes(row.id))} onChange={(event) => setSelected(event.target.checked ? displayRows.map(({ row }) => row.id) : [])}/></th><th>Image（画像）</th>{(entity === "venues" || entity === "artists") && <><th>Tier</th><th>Image Status</th></>}{headings[entity].map((heading) => <th key={heading}>{heading}</th>)}<th>{entity === "artists" ? "Core Quality" : "Completeness（充足率）"}</th><th>Publication（公開状態）</th><th>Updated（更新日時）</th></tr></thead><tbody>
      {displayRows.map(({ row, cells }) => <tr className="master-row" tabIndex={0} role="button" aria-label={`${String(row[config.titleKey] || row.id)}の詳細を開く`} key={row.id} onClick={() => openDrawer(row.id)} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); openDrawer(row.id); } }}><td><input aria-label={`Select ${String(row[config.titleKey] || row.id)}`} type="checkbox" checked={selected.includes(row.id)} onClick={(event) => event.stopPropagation()} onChange={(event) => setSelected(event.target.checked ? [...selected, row.id] : selected.filter((id) => id !== row.id))}/></td><td>{row.signedImageUrl ? <img className="thumb" src={row.signedImageUrl} alt=""/> : <span className="thumb"/>}</td>{entity === "venues" && <><td>{effectiveVenueTier(row) ? <span className={`tier-badge tier-${effectiveVenueTier(row)!.toLowerCase()}`}>{effectiveVenueTier(row)}</span> : <span className="tier-badge">未分類</span>}</td><td><small>{venueImageStatus(row)}</small></td></>}{entity === "artists" && <><td>{effectiveArtistTier(row) ? <span className={`tier-badge tier-${effectiveArtistTier(row)!.toLowerCase()}`}>{effectiveArtistTier(row)}</span> : <span className="tier-badge">未分類</span>}</td><td><small>{artistImageStatus(row)}</small></td></>}{cells.map((cell, index) => <td key={`${row.id}-${headings[entity][index]}`}>{index === 0 ? <strong>{cell}</strong> : cell}</td>)}<td><div className="completeness"><span style={{ width: `${row.completeness.percent}%` }}/></div><small>{row.completeness.met}/{row.completeness.total} · {row.completeness.percent}%</small></td><td><span className={`status ${row.publication_status}`}>{displayStatus(row.publication_status)}</span></td><td>{new Date(row.updated_at).toLocaleString("ja-JP")}</td></tr>)}
      {!displayRows.length && <tr><td colSpan={headings[entity].length + ((entity === "venues" || entity === "artists") ? 8 : 6)} className="empty-state">条件に合う{config.label}はありません。絞り込みを変更するか、新規追加 / CSVから追加できます。</td></tr>}
    </tbody></table></div>
    <div ref={sentinel} className="infinite-scroll-status" aria-live="polite">{loadingMore ? "追加読み込み中..." : loadError ? <><span>{loadError}</span><button className="button secondary" onClick={() => { setLoadError(""); setRetryKey((value) => value + 1); }}>再試行</button></> : hasMore ? "下へスクロールすると次の50件を読み込みます" : `全${result.total}件を表示しました`}</div>
  </>;

  return <>
    {(entity !== "works" || workView === "adopted") && <div className="master-action-bar"><button className="button secondary" disabled={busy || !selected.length} onClick={() => bulk("publish")}>選択した項目を公開</button><button className="button secondary" disabled={busy || !selected.length} onClick={() => bulk("unpublish")}>選択した項目を非公開</button></div>}

    {entity === "venues" && result.qualityDashboard?.kind === "venue" && <section className="card venue-quality-dashboard"><div className="section-head"><div><p className="eyebrow">Data Quality</p><h2>Venue Priority Tier</h2></div><p><strong>{result.qualityDashboard.selected.label}</strong> {result.qualityDashboard.selected.count}件 · Average Completeness {result.qualityDashboard.selected.averageCompleteness}%</p></div><div className="quality-tier-grid">{result.qualityDashboard.tiers.map((item) => <div className="quality-tier" key={item.tier}><span className={`tier-badge tier-${item.tier.toLowerCase()}`}>{item.tier}</span><strong>{item.count}件</strong><span>平均 {item.averageCompleteness}%</span><span>Target {item.target}%</span><span>達成 {item.met} / 未達 {item.unmet}</span></div>)}</div><h3>A〜C Workload</h3><div className="preview-counts"><span className="status">Total {result.qualityDashboard.priorityTotal}</span><span className="status rejected">Target未達 {result.qualityDashboard.priorityTargetUnmet}</span><span className="status">Multiple QID {result.qualityDashboard.multipleQidCandidates}</span>{Object.entries(result.qualityDashboard.missing).map(([key, value]) => <span className="status" key={key}>{key} Missing: {value}</span>)}</div><h3>A〜C Image</h3><div className="preview-counts">{Object.entries(result.qualityDashboard.images).map(([key, value]) => <span className="status" key={key}>{key}: {value}</span>)}</div><details><summary>次に整備すべきVenue</summary><ol className="quality-queue">{result.qualityDashboard.queue.map((item) => <li key={item.id}><button type="button" onClick={() => openDrawer(item.id)}><span className={`tier-badge tier-${item.tier.toLowerCase()}`}>{item.tier}</span> <strong>{item.name}</strong> · {item.completeness}% · Missing: {item.missing.join(" / ")}</button></li>)}</ol></details></section>}
    {entity === "artists" && result.qualityDashboard?.kind === "artist" && <section className="card venue-quality-dashboard"><div className="section-head"><div><p className="eyebrow">Data Quality</p><h2>Artist Priority Tier</h2></div><p><strong>{result.qualityDashboard.selected.label}</strong> {result.qualityDashboard.selected.count}件 · Average Core Quality {result.qualityDashboard.selected.averageCompleteness}%</p></div><div className="quality-tier-grid">{result.qualityDashboard.tiers.map((item) => <div className="quality-tier" key={item.tier}><span className={`tier-badge tier-${item.tier.toLowerCase()}`}>{item.tier}</span><strong>{item.count}件</strong><span>平均 {item.averageCompleteness}%</span><span>4/4 {item.complete}</span><span>未達 {item.incomplete}</span></div>)}</div><h3>Missing Core Fields</h3><div className="preview-counts">{Object.entries(result.qualityDashboard.missing).map(([key, value]) => <span className="status" key={key}>{key} Missing: {value}</span>)}</div></section>}
    {entity === "works" && workView === "candidates" && <section id="works-candidates-panel" role="tabpanel" aria-labelledby="works-candidates-tab" className="card work-candidates-panel"><h2>作品候補</h2><p className="muted">Core 3/3とSource Policyを満たすArtist / Holding relationは自動反映します。曖昧・未解決Candidateは採用せず、Presentation情報は候補に保持したままReview対象とします。</p>{workCandidatesLoading ? <p className="empty-state" aria-live="polite">Loading...（作品候補を読み込み中）</p> : workCandidatesError ? <div className="error">{workCandidatesError}</div> : workTargetedResult ? <><div className="preview-counts"><span className="status">Artists: {workTargetedResult.artists || "—"}</span><span className="status approved">Artist found: {workTargetedResult.artistFound || "—"}</span><span className="status">Candidates: {workTargetedResult.candidates}</span><span className="status">Saved: {workTargetedResult.saved}</span><span className="status approved">Auto applied: {workTargetedResult.autoApplied}</span><span className="status">Needs review: {workTargetedResult.needsReview}</span><span className="status">Duplicates: {workTargetedResult.duplicates}</span><span className="status rejected">Ambiguous: {workTargetedResult.ambiguous}</span></div>{workTargetedResult.coverage.length > 0 && <div className="table-wrap"><table><thead><tr><th>Artist</th><th>Candidates</th><th>Venue match</th><th>Year</th><th>Permanent</th><th>Current</th><th>Source issue</th></tr></thead><tbody>{workTargetedResult.coverage.map((row) => <tr key={row.artistName}><td>{row.artistName}</td><td>{row.candidateCount}</td><td>{row.venueMatchCount}</td><td>{row.yearCount}</td><td>{row.permanentCount}</td><td>{row.currentDisplayCount}</td><td>{row.sourceErrors.join(" / ") || "—"}</td></tr>)}</tbody></table></div>}<div className="actions"><button className="button secondary" disabled={busy || !workCandidateSelected.length} onClick={() => adoptWorkCandidates(workCandidateSelected)}>確認後に選択Candidateを採用</button></div><div className="table-wrap"><table><thead><tr><th>Select</th><th>Candidate</th><th>Artist / Match</th><th>Holding Venue / Match</th><th>Core</th><th>Year</th><th>Source</th><th>Holding / Display</th><th>Status</th><th>採用できない理由</th><th>Action</th></tr></thead><tbody>{workTargetedResult.candidateRows.map((row) => { const adoptionReasons = workCandidateAdoptionReasons(row); const adoptable = adoptionReasons.length === 0; const displayTitle = workDisplayTitleJa(row) || "未設定"; const source = Array.isArray(row.data_sources) ? row.data_sources[0] : row.data_sources; return <tr key={row.id}><td><input type="checkbox" aria-label={`${displayTitle}を選択`} disabled={!adoptable} checked={workCandidateSelected.includes(row.id)} onChange={(event) => setWorkCandidateSelected(event.target.checked ? [...workCandidateSelected, row.id] : workCandidateSelected.filter((id) => id !== row.id))}/></td><td>{row.source_url ? <a href={row.source_url} target="_blank" rel="noreferrer">{displayTitle}</a> : displayTitle}<br/><small className="muted">日本語: {row.title_ja || "—"} / 英語: {row.title_en || "—"} / 原題: {row.title_original || "—"}{row.original_language ? ` (${row.original_language})` : ""}</small><br/><small className="muted">{row.representative_reason || "代表性は要確認"}</small></td><td>{row.source_artist_name || "—"}<br/><small className="muted">{row.artist_id ? "Matched" : "Unmatched"}</small></td><td>{row.source_venue_name || "—"}<br/><small className="muted">{row.matched_venue_id ? "Matched" : "Unmatched"}</small></td><td>{hasWorkTitle(row) && row.artist_id && row.matched_venue_id ? "3/3" : "不足"}</td><td>{row.year_text || "—"}</td><td>{source?.name || source?.key || "—"}</td><td>{row.holding_type || "Not stated"} / {row.presentation_type || row.presentation_status || "Not stated"}</td><td>{row.match_status}{row.matched_work_id ? <><br/><small>{row.matched_work_id}</small></> : null}</td><td>{adoptionReasons.length ? adoptionReasons.join(" / ") : "—"}{busy && adoptable ? <><br/><small className="muted">別処理を実行中</small></> : null}</td><td><button className="button secondary" disabled={busy || !adoptable} onClick={() => adoptWorkCandidates([row.id])}>{row.match_status === "imported" ? "採用済み" : "この作品を採用"}</button></td></tr>; })}</tbody></table></div></> : <p className="empty-state">作品候補はありません。</p>}</section>}

    {message && <div className={message.includes("失敗") || message.includes("Invalid") || message.includes("不足") ? "error" : "notice"}>{message}</div>}
    {entity === "works" ? workView === "adopted" && <section id="works-adopted-panel" role="tabpanel" aria-labelledby="works-adopted-tab">{masterTable}</section> : masterTable}
    <MasterDetailDrawer entity={entity} selectedId={searchParams.get("selected") || undefined}/>
  </>;
}
