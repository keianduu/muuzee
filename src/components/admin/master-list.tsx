"use client";

/* eslint-disable @next/next/no-img-element */

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { MasterDetailDrawer } from "./master-detail-drawer";
import type { CsvPreviewRow } from "@/lib/admin/master-csv";
import { MASTER_CONFIGS, type MasterEntity } from "@/lib/admin/master-config";
import { displayStatus } from "@/lib/admin/master-labels";
import { MASTER_IMPORTERS } from "@/lib/admin/master-importers";
import type { MasterListResult } from "@/lib/admin/master-repository";
import { mergeUniqueRows, pageQuery, selectedQuery } from "@/lib/admin/master-list-state";

type ListRow = MasterListResult["rows"][number];
type Preview = { rows: CsvPreviewRow[]; summary: { total: number; new: number; update: number; unchanged: number; invalid: number; conflicts: number } };
type WikidataSummary = { processed: number; fetched: number; discoveryPages: number; retryCount: number; newVenues: number; linkedExisting: number; updated: number; unchanged: number; needsReview: number; imageCandidatesAdded: number; errors: unknown[]; before: { total: number; averageCompleteness: number }; after: { total: number; averageCompleteness: number } };

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
      ((row.venue_external_match_candidates || []) as Array<{ status?: string }>).some((item) => item.status === "needs_review" || item.status === "candidate") ? "Needs Review" : ((row.venue_external_match_candidates || []) as Array<{ status?: string }>).some((item) => item.status === "matched") ? "Linked" : "未設定",
      `${((row.exhibition_occurrences || []) as unknown[]).length} exhibitions / ${((row.collection_holdings || []) as unknown[]).length} works`],
  }));
  if (entity === "artists") return rows.map((row) => ({
    row,
    cells: [String(row.name || "未設定"), [row.birth_year || row.birth_date || "?", row.death_year || row.death_date || "?"].join(" – "),
      String(row.nationality_country_code || row.birth_country_code || "未設定"),
      `${((row.exhibition_artists || []) as unknown[]).length} exhibitions / ${((row.work_artists || []) as unknown[]).length} works`],
  }));
  return rows.map((row) => ({
    row,
    cells: [String(row.title || "未設定"), relationLabel(row.work_artists, "artists", "name"), String(row.year_text || row.created_year_from || "未設定"), relationLabel(row.collection_holdings, "venues", "name")],
  }));
}

const headings: Record<MasterEntity, string[]> = {
  venues: ["Venue（会場）", "Type（種別）", "Address（住所）", "Coordinates（座標）", "Source（出典）", "Wikidata（照合）", "Relations（関連）"],
  artists: ["Artist（作家）", "Birth / Death（生没年）", "Country（国）", "Relations（関連）"],
  works: ["Work（作品）", "Artist（作家）", "Year（制作年）", "Holding Venue（所蔵先）"],
};

export function MasterList({ entity, result, queryString }: { entity: MasterEntity; result: MasterListResult; queryString: string }) {
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
  const [preview, setPreview] = useState<Preview | null>(null);
  const [csvText, setCsvText] = useState("");
  const [wikidataCount, setWikidataCount] = useState(20);
  const [wikidataSummary, setWikidataSummary] = useState<WikidataSummary | null>(null);
  const displayRows = useMemo(() => rowsFor(entity, rows), [entity, rows]);
  const hasMore = rows.length < result.total;

  useEffect(() => { setRows(latestInitialRows.current); setPage(1); setLoadError(""); }, [queryString]);

  useEffect(() => {
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
  }, [entity, hasMore, loadingMore, loadError, page, queryString, retryKey]);

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

  async function previewCsv(file: File) {
    setBusy(true); setMessage(""); setPreview(null);
    try {
      const text = await file.text(); setCsvText(text);
      const form = new FormData(); form.set("file", file);
      const response = await fetch(`/api/admin/masters/${entity}/csv/preview`, { method: "POST", body: form });
      const body = await response.json(); if (!response.ok) throw new Error(body.error || "Preview failed");
      setPreview(body); setMessage("Parse / Validationが完了しました。内容を確認してConfirmしてください。");
    } catch (error) { setMessage(error instanceof Error ? error.message : "Preview failed"); }
    finally { setBusy(false); }
  }

  async function executeCsv() {
    if (!preview) return;
    if (preview.summary.invalid) { setMessage("Invalid行を修正してから再度Previewしてください。"); return; }
    const allowConflicts = preview.summary.conflicts > 0 && window.confirm(`${preview.summary.conflicts}件のManual / Approved値との競合があります。明示的に上書きしますか？`);
    if (preview.summary.conflicts && !allowConflicts) { setMessage("競合値は上書きしていません。"); return; }
    if (!window.confirm(`New ${preview.summary.new} / Update ${preview.summary.update} をImportしますか？`)) return;
    const body = await jsonRequest(`/api/admin/masters/${entity}/csv/execute`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ csv: csvText, allowConflicts }) });
    if (body) { setPreview(null); setCsvText(""); }
  }

  async function sampleImport(limit: number, importerKey = "wikidata-enrichment") {
    if (entity !== "venues") return;
    const body = await jsonRequest(importerKey === "wikidata-venue-import" ? "/api/admin/venues/import/wikidata" : "/api/admin/venues/enrich", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(importerKey === "wikidata-venue-import" ? { mode: "count", count: limit } : { limit }) });
    if (importerKey === "wikidata-venue-import" && body) setWikidataSummary(body as WikidataSummary);
  }

  async function fullWikidataSync() {
    if (!window.confirm("日本の対象VenueをWikidataから全件Scanします。画面を閉じずに続行しますか？")) return;
    const poll = window.setInterval(async () => {
      try {
        const response = await fetch("/api/admin/venues/import/wikidata", { cache: "no-store" });
        const body = await response.json();
        if (body?.metrics) setWikidataSummary(body.metrics as WikidataSummary);
      } catch { /* Final request reports any actionable error. */ }
    }, 2_000);
    try {
      const body = await jsonRequest("/api/admin/venues/import/wikidata", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ mode: "full" }) });
      if (body) setWikidataSummary(body as WikidataSummary);
    } finally {
      window.clearInterval(poll);
    }
  }

  return <>
    <div className="master-action-bar">
      <Link className="button" href={`/admin/${entity}/new`}>Manual Input（手動追加）</Link>
      <details className="action-menu"><summary className="button secondary">CSV（入出力）</summary><div className="action-popover">
        <strong>CSV Export / Import（書出・取込）</strong>
        <a href={`/api/admin/masters/${entity}/csv?mode=all`}>全件Download（ダウンロード）</a>
        <a href={`/api/admin/masters/${entity}/csv?mode=template`}>Template CSV（ひな型）</a>
        <label className="field"><span>Upload CSV（Previewのみ）</span><input type="file" accept=".csv,text/csv" disabled={busy} onChange={(event) => event.target.files?.[0] && previewCsv(event.target.files[0])}/></label>
      </div></details>
      <details className="action-menu"><summary className="button secondary">API Import（API取込）</summary><div className="action-popover">
        <strong>Master Source（マスターデータ出典）</strong>
        {MASTER_IMPORTERS[entity].map((importer) => <div key={importer.key}><p>{importer.label}</p><small className="muted">{importer.description}</small>{importer.key === "wikidata-venue-import" && <label className="field"><span>Count（1–500）</span><input type="number" min="1" max="500" value={wikidataCount} onChange={(event) => setWikidataCount(Math.max(1, Math.min(500, Number(event.target.value) || 1)))}/></label>}<div className="actions"><button className="button secondary" disabled={busy || !importer.sampleAvailable} onClick={() => sampleImport(importer.key === "wikidata-venue-import" ? wikidataCount : 5, importer.key)}>{importer.key === "wikidata-venue-import" ? "Import" : "Sample 5"}</button><button className="button secondary" disabled={busy || !importer.fullSyncAvailable} onClick={importer.key === "wikidata-venue-import" ? fullWikidataSync : undefined}>{importer.fullSyncAvailable ? "Wikidata 全件同期" : "Full Sync（未実装）"}</button></div></div>)}
        {!MASTER_IMPORTERS[entity].length && <p className="muted">利用可能な外部データソースは未接続です。架空のImportは実行しません。</p>}
      </div></details>
      <span className="action-spacer"/><button className="button secondary" disabled={busy || !selected.length} onClick={() => bulk("publish")}>選択をPublish（公開）</button><button className="button secondary" disabled={busy || !selected.length} onClick={() => bulk("unpublish")}>選択をUnpublish（非公開）</button>
    </div>

    {preview && <section className="card csv-preview"><h2>CSV Preview</h2><div className="preview-counts">
      {Object.entries(preview.summary).map(([key, value]) => <span className={`status ${key === "invalid" || key === "conflicts" ? "rejected" : key === "new" ? "approved" : ""}`} key={key}>{key}: {value}</span>)}
    </div><div className="table-wrap"><table><thead><tr><th>Line</th><th>Record</th><th>Classification</th><th>Changed fields</th><th>Conflict / Error</th></tr></thead><tbody>{preview.rows.map((row) => <tr key={row.line}><td>{row.line}</td><td>{row.label}</td><td><span className={`status ${row.status === "invalid" ? "rejected" : row.status === "new" ? "approved" : ""}`}>{row.status}</span></td><td>{row.changedFields.join("、") || "なし"}</td><td>{[...row.conflicts.map((field) => `${field}: Manual/Approved`), ...row.errors].join(" / ") || "なし"}</td></tr>)}</tbody></table></div><div className="actions"><button className="button" disabled={busy || preview.summary.invalid > 0} onClick={executeCsv}>Confirm Import</button><button className="button secondary" onClick={() => { setPreview(null); setCsvText(""); }}>Cancel</button></div></section>}

    {wikidataSummary && <section className="card"><h2>Wikidata Import Summary</h2><div className="preview-counts">{[
      ["Processed", wikidataSummary.processed], ["Fetched", wikidataSummary.fetched], ["Pages", wikidataSummary.discoveryPages], ["Retries", wikidataSummary.retryCount],
      ["New Venue", wikidataSummary.newVenues], ["Linked Existing", wikidataSummary.linkedExisting],
      ["Updated", wikidataSummary.updated], ["Unchanged", wikidataSummary.unchanged], ["Needs Review", wikidataSummary.needsReview],
      ["Image Candidate Added", wikidataSummary.imageCandidatesAdded], ["Errors", wikidataSummary.errors.length],
    ].map(([label, value]) => <span className="status" key={String(label)}>{label}: {String(value)}</span>)}</div><p className="muted">Venue: {wikidataSummary.before.total} → {wikidataSummary.after.total} / Average completeness: {wikidataSummary.before.averageCompleteness}% → {wikidataSummary.after.averageCompleteness}%</p></section>}

    {message && <div className={message.includes("失敗") || message.includes("Invalid") || message.includes("不足") ? "error" : "notice"}>{message}</div>}
    <div className="list-summary"><strong>{result.total}</strong>件{result.allTotal !== result.total ? `（全${result.allTotal}件中）` : ""} · 表示中 {rows.length}件</div>
    <div className="table-wrap"><table><thead><tr><th><input aria-label="表示中の項目をすべて選択" type="checkbox" checked={Boolean(displayRows.length) && displayRows.every(({ row }) => selected.includes(row.id))} onChange={(event) => setSelected(event.target.checked ? displayRows.map(({ row }) => row.id) : [])}/></th><th>Image（画像）</th>{headings[entity].map((heading) => <th key={heading}>{heading}</th>)}<th>Completeness（充足率）</th><th>Publication（公開状態）</th><th>Updated（更新日時）</th></tr></thead><tbody>
      {displayRows.map(({ row, cells }) => <tr className="master-row" tabIndex={0} role="button" aria-label={`${String(row[config.titleKey] || row.id)}の詳細を開く`} key={row.id} onClick={() => openDrawer(row.id)} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); openDrawer(row.id); } }}><td><input aria-label={`Select ${String(row[config.titleKey] || row.id)}`} type="checkbox" checked={selected.includes(row.id)} onClick={(event) => event.stopPropagation()} onChange={(event) => setSelected(event.target.checked ? [...selected, row.id] : selected.filter((id) => id !== row.id))}/></td><td>{row.signedImageUrl ? <img className="thumb" src={row.signedImageUrl} alt=""/> : <span className="thumb"/>}</td>{cells.map((cell, index) => <td key={`${row.id}-${headings[entity][index]}`}>{index === 0 ? <strong>{cell}</strong> : cell}</td>)}<td><div className="completeness"><span style={{ width: `${row.completeness.percent}%` }}/></div><small>{row.completeness.percent}%</small></td><td><span className={`status ${row.publication_status}`}>{displayStatus(row.publication_status)}</span></td><td>{new Date(row.updated_at).toLocaleString("ja-JP")}</td></tr>)}
      {!displayRows.length && <tr><td colSpan={headings[entity].length + 6} className="empty-state">条件に合う{config.label}はありません。Filterを変更するか、Manual Input / CSV Importから追加できます。</td></tr>}
    </tbody></table></div>
    <div ref={sentinel} className="infinite-scroll-status" aria-live="polite">{loadingMore ? "Loading...（追加読み込み中）" : loadError ? <><span>{loadError}</span><button className="button secondary" onClick={() => { setLoadError(""); setRetryKey((value) => value + 1); }}>Retry（再試行）</button></> : hasMore ? "下へスクロールすると次の50件を読み込みます" : `全${result.total}件を表示しました`}</div>
    <MasterDetailDrawer entity={entity} selectedId={searchParams.get("selected") || undefined}/>
  </>;
}
