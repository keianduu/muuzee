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
import { VENUE_AI_ENRICHMENT_PROMPT } from "@/lib/admin/venue-ai-enrichment-prompt";
import type { MasterListResult } from "@/lib/admin/master-repository";
import { mergeUniqueRows, pageQuery, replaceRowInPlace, selectedQuery } from "@/lib/admin/master-list-state";
import { VenueCanonicalReview } from "./venue-canonical-review";
import { effectiveVenueTier, venueImageStatus } from "@/lib/admin/venue-priority";
import { artistImageStatus, effectiveArtistTier } from "@/lib/admin/artist-priority";
import { hasWorkTitle, workDisplayTitleJa } from "@/lib/work-title";

type ListRow = MasterListResult["rows"][number];
type Preview = { rows: CsvPreviewRow[]; summary: { total: number; new: number; update: number; unchanged: number; invalid: number; conflicts: number } };
type WikidataSummary = { processed: number; fetched: number; discoveryPages?: number; retryCount?: number; newVenues?: number; newArtists?: number; linkedExisting: number; updated: number; unchanged: number; sourceSelectionRequired: number; imageCandidatesAdded: number; errors: unknown[]; before?: { total: number; averageCompleteness: number }; after?: { total: number; averageCompleteness: number }; coverage?: Record<string, { filled: number; missing: number; percent: number }>; imageCoverage?: Record<string, number>; averageCompleteness?: number; coreComplete?: number };
type OfficialCrawlRow = { venue_id: string; name: string; crawl_status: string; address: string; postal_code: string; opening_hours_text: string; closed_days_text: string; access_text: string; description_source_text: string; notes: string };
type OfficialCrawlResult = { runId: string; rows: OfficialCrawlRow[]; summary: { requested: number; processed: number; success: number; partial: number; blocked: number; failed: number; coverage: Record<string, number> } };
type WikipediaAddressResult = { dryRun: boolean; requested: number; processed: number; wikipediaArticleFound: number; addressFound: number; addressAdded: number; unchanged: number; noArticle: number; addressNotFound: number; conflict: number; error: number };
type WikipediaArtistResult = { dryRun: boolean; requested: number; processed: number; before: Record<string, number>; after: Record<string, number>; explicitSingleNationality: number; noExplicitNationality: number; ambiguousNationality: number; errors: number };
type ArtistMatchResult = { dryRun: boolean; exhibitionsScanned: number; mentions: number; structuredMentions: number; titleMentions: number; matched: number; ambiguous: number; unmatched: number; targetedImports: number; relationsCreated: number; relationsExisting: number; errors: unknown[] };
type ArtistTargetedResult = { dryRun: boolean; before: Record<string, number>; after: Record<string, number>; apjMatches: number; gettyMatches: number; nationalityApplied: number; imageCandidatesFound: number; primaryImagesAdded: number; nationalityTargets: Array<Record<string, unknown>>; imageTargets: Array<Record<string, unknown>> };
type WorkCandidateRow = { id: string; artist_id: string | null; matched_work_id: string | null; title: string; title_ja: string | null; title_en: string | null; title_original: string | null; original_language: string | null; year_text: string | null; source_artist_name: string | null; source_venue_name: string | null; matched_venue_id: string | null; holding_type: string | null; presentation_type: string | null; presentation_status: string | null; match_status: string; representative_reason: string; source_url: string | null; data_sources?: { name?: string; key?: string } | Array<{ name?: string; key?: string }> };
type WorkTargetedResult = { dryRun: boolean; artists: number; artistFound: number; candidates: number; saved: number; duplicates: number; ambiguous: number; coverage: Array<{ artistName: string; candidateCount: number; venueMatchCount: number; yearCount: number; permanentCount: number; currentDisplayCount: number; sourceErrors: string[] }>; candidateRows: WorkCandidateRow[] };

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
  const [officialCount, setOfficialCount] = useState(5);
  const [officialMissingField, setOfficialMissingField] = useState("");
  const [officialResult, setOfficialResult] = useState<OfficialCrawlResult | null>(null);
  const [officialTarget, setOfficialTarget] = useState("A-C");
  const [imageSearchCount, setImageSearchCount] = useState(20);
  const [imageResult, setImageResult] = useState<{ dryRun: boolean; processed: number; candidateFound: number; noCandidate: number; added?: number; coverage?: { wikidataP18: number; commonsCategory: number; wikipediaArticle: number; uniqueCandidates: number }; errors: unknown[] } | null>(null);
  const [wikipediaTarget, setWikipediaTarget] = useState("A-C");
  const [wikipediaCount, setWikipediaCount] = useState(20);
  const [wikipediaResult, setWikipediaResult] = useState<WikipediaAddressResult | null>(null);
  const [wikipediaArtistResult, setWikipediaArtistResult] = useState<WikipediaArtistResult | null>(null);
  const [artistMatchResult, setArtistMatchResult] = useState<ArtistMatchResult | null>(null);
  const [artistTargetedResult, setArtistTargetedResult] = useState<ArtistTargetedResult | null>(null);
  const [workTargetedResult, setWorkTargetedResult] = useState<WorkTargetedResult | null>(null);
  const [workCandidateSelected, setWorkCandidateSelected] = useState<string[]>([]);
  const displayRows = useMemo(() => rowsFor(entity, rows), [entity, rows]);
  const hasMore = rows.length < result.total;

  useEffect(() => { setRows(latestInitialRows.current); setPage(1); setLoadError(""); }, [queryString]);

  useEffect(() => {
    if (entity !== "works") return;
    fetch("/api/admin/works/targeted-import", { cache: "no-store" }).then((response) => response.json()).then((body) => {
      if (Array.isArray(body.candidateRows)) setWorkTargetedResult({ dryRun: false, artists: 0, artistFound: 0, candidates: body.candidateRows.length, saved: 0, duplicates: body.candidateRows.filter((row: WorkCandidateRow) => row.match_status === "duplicate").length, ambiguous: body.candidateRows.filter((row: WorkCandidateRow) => row.match_status === "ambiguous").length, coverage: [], candidateRows: body.candidateRows });
    }).catch(() => { /* API action reports errors; list remains usable. */ });
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
    const allowConflicts = false;
    if (!window.confirm(`New ${preview.summary.new} / Update ${preview.summary.update} をImportしますか？${preview.summary.conflicts ? `\n${preview.summary.conflicts}件の高優先度Fieldは保護し、それ以外を反映します。` : ""}`)) return;
    const body = await jsonRequest(`/api/admin/masters/${entity}/csv/execute`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ csv: csvText, allowConflicts }) });
    if (body) { setPreview(null); setCsvText(""); }
  }

  async function sampleImport(limit: number, importerKey = "wikidata-enrichment") {
    if (entity === "works" && importerKey === "targeted-work-candidates") {
      const body = await jsonRequest("/api/admin/works/targeted-import", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ limit: Math.min(20, limit), saveCandidates: true }) });
      if (body) setWorkTargetedResult(body as WorkTargetedResult);
      return;
    }
    if (entity !== "venues" && entity !== "artists") return;
    const isSourceImport = importerKey === "wikidata-venue-import" || importerKey === "wikidata-artist-import";
    const url = importerKey === "wikidata-artist-import" ? "/api/admin/artists/import/wikidata" : importerKey === "wikidata-venue-import" ? "/api/admin/venues/import/wikidata" : "/api/admin/venues/enrich";
    const body = await jsonRequest(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(isSourceImport ? { mode: "count", count: limit } : { limit }) });
    if (isSourceImport && body) setWikidataSummary(body as WikidataSummary);
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

  async function fullWikidataSync() {
    if (!window.confirm(entity === "artists" ? "Global Visual Artistを全件Scanします。Production運用向けの長時間処理です。続行しますか？" : "日本の対象VenueをWikidataから全件Scanします。画面を閉じずに続行しますか？")) return;
    const endpoint = entity === "artists" ? "/api/admin/artists/import/wikidata" : "/api/admin/venues/import/wikidata";
    const poll = window.setInterval(async () => {
      try {
        const response = await fetch(endpoint, { cache: "no-store" });
        const body = await response.json();
        if (body?.metrics) setWikidataSummary(body.metrics as WikidataSummary);
      } catch { /* Final request reports any actionable error. */ }
    }, 2_000);
    try {
      const body = await jsonRequest(endpoint, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ mode: "full" }) });
      if (body) setWikidataSummary(body as WikidataSummary);
    } finally {
      window.clearInterval(poll);
    }
  }

  async function officialCrawl(mode: "selected" | "filtered" | "count") {
    if (entity !== "venues") return;
    if (mode === "selected" && !selected.length) { setMessage("対象Venueを選択してください。"); return; }
    const filters = Object.fromEntries([...new URLSearchParams(queryString).entries()].filter(([key]) => key !== "page" && key !== "selected"));
    const body = await jsonRequest("/api/admin/venues/crawl/official", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mode, target: mode === "selected" ? "selected" : officialTarget, ids: mode === "selected" ? selected : undefined, limit: officialCount, missingField: officialMissingField, filters }),
    });
    if (body) {
      setOfficialResult(body as OfficialCrawlResult);
      setMessage("公式サイトの取得が完了しました。Masterはまだ変更されていません。CSVをDownloadし、必要なら編集後にCSV Previewへ進んでください。");
    }
  }

  async function targetedImageSearch(dryRun = false) {
    const endpoint = entity === "artists" ? "/api/admin/artists/images/search" : "/api/admin/venues/images/search";
    const body = await jsonRequest(endpoint, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ tier: "A-C", limit: imageSearchCount, artistIds: entity === "artists" && selected.length ? selected : undefined, dryRun }) });
    if (body) setImageResult(body);
  }

  async function wikipediaArtistEnrichment(scope = wikipediaTarget, dryRun = false) {
    if (scope === "selected" && !selected.length) { setMessage("対象Artistを選択してください。"); return; }
    const body = await jsonRequest("/api/admin/artists/wikipedia-enrichment", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ scope, artistIds: scope === "selected" ? selected : undefined, limit: scope === "selected" ? selected.length : wikipediaCount, dryRun }) });
    if (body) setWikipediaArtistResult(body as WikipediaArtistResult);
  }

  async function matchExhibitions(dryRun = false) {
    if (!dryRun && !window.confirm("明確なArtist MentionだけをRelationへ保存し、Tierを再計算します。続行しますか？")) return;
    const body = await jsonRequest("/api/admin/artists/match-exhibitions", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ limit: 500, dryRun }) });
    if (body) setArtistMatchResult(body as ArtistMatchResult);
  }

  async function targetedArtistEnrichment(dryRun = false) {
    if (!dryRun && !window.confirm("Tier Aの不足ArtistだけをAPJ / Getty / 公式画像Sourceで補完します。Global Full Syncは行いません。続行しますか？")) return;
    const body = await jsonRequest("/api/admin/artists/targeted-enrichment", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ dryRun }) });
    if (body) setArtistTargetedResult(body as ArtistTargetedResult);
  }

  async function wikipediaAddressEnrichment(scope = wikipediaTarget, dryRun = false) {
    if (scope === "selected" && !selected.length) { setMessage("対象Venueを選択してください。"); return; }
    const body = await jsonRequest("/api/admin/venues/wikipedia-address", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ scope, venueIds: scope === "selected" ? selected : undefined, limit: scope === "selected" ? selected.length : wikipediaCount, dryRun }),
    });
    if (body) setWikipediaResult(body as WikipediaAddressResult);
  }

  function openCsvImport() {
    const menu = document.getElementById("master-csv-menu") as HTMLDetailsElement | null;
    if (!menu) return;
    menu.open = true;
    menu.scrollIntoView({ behavior: "smooth", block: "center" });
  }

  return <>
    <div className="master-action-bar">
      <Link className="button" href={`/admin/${entity}/new`}>Manual Input（手動追加）</Link>
      <details className="action-menu" id="master-csv-menu"><summary className="button secondary">CSV（入出力）</summary><div className="action-popover">
        <strong>CSV Export / Import（書出・取込）</strong>
        <a href={`/api/admin/masters/${entity}/csv?mode=all`}>全件Download（ダウンロード）</a>
        <a href={`/api/admin/masters/${entity}/csv?mode=template`}>Template CSV（ひな型）</a>
        <label className="field"><span>Upload CSV（Previewのみ）</span><input type="file" accept=".csv,text/csv" disabled={busy} onChange={(event) => event.target.files?.[0] && previewCsv(event.target.files[0])}/></label>
      </div></details>
      <details className="action-menu"><summary className="button secondary">API Import（API取込）</summary><div className="action-popover">
        <strong>Master Source（マスターデータ出典）</strong>
        {MASTER_IMPORTERS[entity].map((importer) => { const isWikidataSource = importer.key === "wikidata-venue-import" || importer.key === "wikidata-artist-import"; const isWorkTargeted = importer.key === "targeted-work-candidates"; return <div key={importer.key}><p>{importer.label}</p><small className="muted">{importer.description}</small>{isWikidataSource && <label className="field"><span>Count（1–500）</span><input type="number" min="1" max="500" value={wikidataCount} onChange={(event) => setWikidataCount(Math.max(1, Math.min(500, Number(event.target.value) || 1)))}/></label>}<div className="actions"><button className="button secondary" disabled={busy || !importer.sampleAvailable} onClick={() => sampleImport(isWikidataSource ? wikidataCount : isWorkTargeted ? 20 : 5, importer.key)}>{isWikidataSource ? "Import" : isWorkTargeted ? "Tier A候補を取得" : "Sample 5"}</button><button className="button secondary" disabled={busy || !importer.fullSyncAvailable} onClick={isWikidataSource ? fullWikidataSync : undefined}>{importer.fullSyncAvailable ? "Wikidata 全件同期" : "Full Sync（未実装）"}</button></div></div>; })}
        {!MASTER_IMPORTERS[entity].length && <p className="muted">利用可能な外部データソースは未接続です。架空のImportは実行しません。</p>}
      </div></details>
      {entity === "venues" && <details className="action-menu"><summary className="button secondary">公式サイト情報取得</summary><div className="action-popover official-crawl-menu">
        <strong>Official Website Crawler（Source B）</strong>
        <small className="muted">公式URLと同じdomain内を最大6ページ確認し、結果をCSV化します。この操作だけではMasterを更新しません。</small>
        <label className="field"><span>Target</span><select value={officialTarget} onChange={(event) => setOfficialTarget(event.target.value)}><option value="A">Aのみ</option><option value="A-B">A+B</option><option value="A-C">A〜C</option><option value="filtered">現在のFilter結果</option></select></label>
        <label className="field"><span>不足Fieldを優先</span><select value={officialMissingField} onChange={(event) => setOfficialMissingField(event.target.value)}>
          <option value="">指定なし</option><option value="address">Address</option><option value="postal_code">Postal code</option><option value="opening_hours_text">Opening hours</option><option value="closed_days_text">Closed days</option><option value="access_text">Access</option><option value="description">Description source</option>
        </select></label>
        <label className="field"><span>Count（1–50 / local test）</span><input type="number" min="1" max="50" value={officialCount} onChange={(event) => setOfficialCount(Math.max(1, Math.min(50, Number(event.target.value) || 1)))}/></label>
        <div className="actions"><button className="button secondary" disabled={busy || !selected.length} onClick={() => officialCrawl("selected")}>選択中をCrawl</button><button className="button secondary" disabled={busy} onClick={() => officialCrawl("filtered")}>{officialTarget === "filtered" ? "現在のFilter" : officialTarget}から{officialCount}件</button></div>
      </div></details>}
      {entity === "venues" && <details className="action-menu"><summary className="button secondary">画像候補を取得</summary><div className="action-popover"><strong>A〜C / Image Candidateなし</strong><small className="muted">確定QIDからP18、Commons Category、Wikipedia Articleの順に最大3件を探索します。</small><label className="field"><span>Count（1–50 / LOCAL）</span><input type="number" min="1" max="50" value={imageSearchCount} onChange={(event) => setImageSearchCount(Math.max(1, Math.min(50, Number(event.target.value) || 1)))}/></label><div className="actions"><button className="button secondary" disabled={busy} onClick={() => targetedImageSearch(true)}>Coverage Dry Run</button><button className="button secondary" disabled={busy} onClick={() => targetedImageSearch(false)}>画像候補を取得</button></div></div></details>}
      {entity === "artists" && <details className="action-menu"><summary className="button secondary">Artist画像候補</summary><div className="action-popover"><strong>P18 → Wikipedia → Commons</strong><small className="muted">確定QIDから最大3件を再探索します。既存CandidateとPrimaryは上書きしません。</small><label className="field"><span>Count（1–200 / LOCAL）</span><input type="number" min="1" max="200" value={imageSearchCount} onChange={(event) => setImageSearchCount(Math.max(1, Math.min(200, Number(event.target.value) || 1)))}/></label><div className="actions"><button className="button secondary" disabled={busy} onClick={() => targetedImageSearch(true)}>Dry Run</button><button className="button secondary" disabled={busy} onClick={() => targetedImageSearch(false)}>画像候補を再探索</button></div></div></details>}
      {entity === "venues" && <details className="action-menu"><summary className="button secondary">Wikipedia住所補完</summary><div className="action-popover"><strong>Address Fallback（LOCAL）</strong><small className="muted">確定QIDのWikipedia記事にある明示的な住所だけを補完します。Manual / Official Websiteの住所は上書きしません。</small><label className="field"><span>Target</span><select value={wikipediaTarget} onChange={(event) => setWikipediaTarget(event.target.value)}><option value="A">Aのみ</option><option value="A-B">A+B</option><option value="A-C">A〜C</option></select></label><label className="field"><span>Count（1–200 / LOCAL）</span><input type="number" min="1" max="200" value={wikipediaCount} onChange={(event) => setWikipediaCount(Math.max(1, Math.min(200, Number(event.target.value) || 1)))}/></label><div className="actions"><button className="button secondary" disabled={busy} onClick={() => wikipediaAddressEnrichment(wikipediaTarget, true)}>Dry Run</button><button className="button secondary" disabled={busy} onClick={() => wikipediaAddressEnrichment(wikipediaTarget, false)}>住所を補完</button><button className="button secondary" disabled={busy || !selected.length} onClick={() => wikipediaAddressEnrichment("selected", false)}>選択Venueを補完</button></div></div></details>}
      {entity === "artists" && <details className="action-menu"><summary className="button secondary">Wikipedia基本情報</summary><div className="action-popover"><strong>Nationality Fallback（LOCAL）</strong><small className="muted">Infoboxに明記された単一Nationalityのみ適用します。出生地・活動国から推測しません。</small><label className="field"><span>Target</span><select value={wikipediaTarget} onChange={(event) => setWikipediaTarget(event.target.value)}><option value="A">Aのみ</option><option value="A-B">A+B</option><option value="A-C">A〜C</option></select></label><label className="field"><span>Count（1–200）</span><input type="number" min="1" max="200" value={wikipediaCount} onChange={(event) => setWikipediaCount(Math.max(1, Math.min(200, Number(event.target.value) || 1)))}/></label><div className="actions"><button className="button secondary" disabled={busy} onClick={() => wikipediaArtistEnrichment(wikipediaTarget, true)}>Dry Run</button><button className="button secondary" disabled={busy} onClick={() => wikipediaArtistEnrichment(wikipediaTarget, false)}>明示情報を補完</button><button className="button secondary" disabled={busy || !selected.length} onClick={() => wikipediaArtistEnrichment("selected", false)}>選択Artistを補完</button></div></div></details>}
      {entity === "artists" && <details className="action-menu"><summary className="button secondary">Tier A Targeted補完</summary><div className="action-popover"><strong>APJ / Getty / Official Image（LOCAL）</strong><small className="muted">現在のTier A不足対象だけを補完します。国籍はGettyの明示値のみ、画像Rightsは自動承認しません。</small><div className="actions"><button className="button secondary" disabled={busy} onClick={() => targetedArtistEnrichment(true)}>Dry Run</button><button className="button secondary" disabled={busy} onClick={() => targetedArtistEnrichment(false)}>Targeted Enrichment</button></div></div></details>}
      {entity === "artists" && <details className="action-menu"><summary className="button secondary">Exhibition照合</summary><div className="action-popover"><strong>Exhibition → Artist Master</strong><small className="muted">構造化Artist Field、または既存Master名のタイトル内明示一致だけを使います。曖昧候補はRelation化しません。</small><div className="actions"><button className="button secondary" disabled={busy} onClick={() => matchExhibitions(true)}>Dry Run</button><button className="button secondary" disabled={busy} onClick={() => matchExhibitions(false)}>Relationを作成</button></div></div></details>}
      <span className="action-spacer"/><button className="button secondary" disabled={busy || !selected.length} onClick={() => bulk("publish")}>選択をPublish（公開）</button><button className="button secondary" disabled={busy || !selected.length} onClick={() => bulk("unpublish")}>選択をUnpublish（非公開）</button>
    </div>

    {entity === "venues" && <VenueCanonicalReview/>}

    {entity === "venues" && result.qualityDashboard?.kind === "venue" && <section className="card venue-quality-dashboard"><div className="section-head"><div><p className="eyebrow">Data Quality</p><h2>Venue Priority Tier</h2></div><p><strong>{result.qualityDashboard.selected.label}</strong> {result.qualityDashboard.selected.count}件 · Average Completeness {result.qualityDashboard.selected.averageCompleteness}%</p></div><div className="quality-tier-grid">{result.qualityDashboard.tiers.map((item) => <div className="quality-tier" key={item.tier}><span className={`tier-badge tier-${item.tier.toLowerCase()}`}>{item.tier}</span><strong>{item.count}件</strong><span>平均 {item.averageCompleteness}%</span><span>Target {item.target}%</span><span>達成 {item.met} / 未達 {item.unmet}</span></div>)}</div><h3>A〜C Workload</h3><div className="preview-counts"><span className="status">Total {result.qualityDashboard.priorityTotal}</span><span className="status rejected">Target未達 {result.qualityDashboard.priorityTargetUnmet}</span><span className="status">Multiple QID {result.qualityDashboard.multipleQidCandidates}</span>{Object.entries(result.qualityDashboard.missing).map(([key, value]) => <span className="status" key={key}>{key} Missing: {value}</span>)}</div><h3>A〜C Image</h3><div className="preview-counts">{Object.entries(result.qualityDashboard.images).map(([key, value]) => <span className="status" key={key}>{key}: {value}</span>)}</div><details><summary>Data Quality Queue（次に整備すべきVenue）</summary><ol className="quality-queue">{result.qualityDashboard.queue.map((item) => <li key={item.id}><button type="button" onClick={() => openDrawer(item.id)}><span className={`tier-badge tier-${item.tier.toLowerCase()}`}>{item.tier}</span> <strong>{item.name}</strong> · {item.completeness}% · Missing: {item.missing.join(" / ")}</button></li>)}</ol></details></section>}
    {entity === "artists" && result.qualityDashboard?.kind === "artist" && <section className="card venue-quality-dashboard"><div className="section-head"><div><p className="eyebrow">Data Quality</p><h2>Artist Priority Tier</h2></div><p><strong>{result.qualityDashboard.selected.label}</strong> {result.qualityDashboard.selected.count}件 · Average Core Quality {result.qualityDashboard.selected.averageCompleteness}%</p></div><div className="quality-tier-grid">{result.qualityDashboard.tiers.map((item) => <div className="quality-tier" key={item.tier}><span className={`tier-badge tier-${item.tier.toLowerCase()}`}>{item.tier}</span><strong>{item.count}件</strong><span>平均 {item.averageCompleteness}%</span><span>4/4 {item.complete}</span><span>未達 {item.incomplete}</span></div>)}</div><h3>Missing Core Fields</h3><div className="preview-counts">{Object.entries(result.qualityDashboard.missing).map(([key, value]) => <span className="status" key={key}>{key} Missing: {value}</span>)}</div></section>}
    {artistTargetedResult && <section className="card"><h2>Tier A Artist Targeted Enrichment {artistTargetedResult.dryRun && "(Dry Run)"}</h2><div className="preview-counts"><span className="status">APJ exact: {artistTargetedResult.apjMatches}</span><span className="status">Getty exact: {artistTargetedResult.gettyMatches}</span><span className="status approved">Nationality applied: {artistTargetedResult.nationalityApplied}</span><span className="status">Image candidates: {artistTargetedResult.imageCandidatesFound}</span><span className="status approved">Primary added: {artistTargetedResult.primaryImagesAdded}</span></div><div className="table-wrap"><table><thead><tr><th>Metric</th><th>Before</th><th>After</th></tr></thead><tbody>{Object.keys(artistTargetedResult.before).map((key) => <tr key={key}><td>{key}</td><td>{artistTargetedResult.before[key]}</td><td>{artistTargetedResult.after[key]}</td></tr>)}</tbody></table></div></section>}
    {workTargetedResult && <section className="card"><h2>Work / Collection Targeted Candidates</h2><p className="muted">代表作品候補です。Source順は代表性の根拠ではないため、人が確認したCandidateだけをDraft Workへ採用します。所蔵と展示状態は別Relationです。</p><div className="preview-counts"><span className="status">Artists: {workTargetedResult.artists || "—"}</span><span className="status approved">Artist found: {workTargetedResult.artistFound || "—"}</span><span className="status">Candidates: {workTargetedResult.candidates}</span><span className="status">Saved: {workTargetedResult.saved}</span><span className="status">Duplicates: {workTargetedResult.duplicates}</span><span className="status rejected">Ambiguous: {workTargetedResult.ambiguous}</span></div>{workTargetedResult.coverage.length > 0 && <div className="table-wrap"><table><thead><tr><th>Artist</th><th>Candidates</th><th>Venue match</th><th>Year</th><th>Permanent</th><th>Current</th><th>Source issue</th></tr></thead><tbody>{workTargetedResult.coverage.map((row) => <tr key={row.artistName}><td>{row.artistName}</td><td>{row.candidateCount}</td><td>{row.venueMatchCount}</td><td>{row.yearCount}</td><td>{row.permanentCount}</td><td>{row.currentDisplayCount}</td><td>{row.sourceErrors.join(" / ") || "—"}</td></tr>)}</tbody></table></div>}<div className="actions"><button className="button secondary" disabled={busy || !workCandidateSelected.length} onClick={() => adoptWorkCandidates(workCandidateSelected)}>選択したCandidateを採用</button></div><div className="table-wrap"><table><thead><tr><th>Select</th><th>Candidate</th><th>Artist / Match</th><th>Holding Venue / Match</th><th>Core</th><th>Year</th><th>Source</th><th>Holding / Display</th><th>Status</th><th>Action</th></tr></thead><tbody>{workTargetedResult.candidateRows.map((row) => { const adoptable = Boolean(hasWorkTitle(row) && row.artist_id && row.matched_venue_id && row.match_status !== "imported"); const displayTitle = workDisplayTitleJa(row) || "未設定"; const source = Array.isArray(row.data_sources) ? row.data_sources[0] : row.data_sources; return <tr key={row.id}><td><input type="checkbox" aria-label={`${displayTitle}を選択`} disabled={!adoptable} checked={workCandidateSelected.includes(row.id)} onChange={(event) => setWorkCandidateSelected(event.target.checked ? [...workCandidateSelected, row.id] : workCandidateSelected.filter((id) => id !== row.id))}/></td><td>{row.source_url ? <a href={row.source_url} target="_blank" rel="noreferrer">{displayTitle}</a> : displayTitle}<br/><small className="muted">日本語: {row.title_ja || "—"} / 英語: {row.title_en || "—"} / 原題: {row.title_original || "—"}{row.original_language ? ` (${row.original_language})` : ""}</small><br/><small className="muted">{row.representative_reason || "代表性は要確認"}</small></td><td>{row.source_artist_name || "—"}<br/><small className="muted">{row.artist_id ? "Matched" : "Unmatched"}</small></td><td>{row.source_venue_name || "—"}<br/><small className="muted">{row.matched_venue_id ? "Matched" : "Unmatched"}</small></td><td>{hasWorkTitle(row) && row.artist_id && row.matched_venue_id ? "3/3" : "不足"}</td><td>{row.year_text || "—"}</td><td>{source?.name || source?.key || "—"}</td><td>{row.holding_type || "Not stated"} / {row.presentation_type || row.presentation_status || "Not stated"}</td><td>{row.match_status}{row.matched_work_id ? <><br/><small>{row.matched_work_id}</small></> : null}</td><td><button className="button secondary" disabled={busy || !adoptable} onClick={() => adoptWorkCandidates([row.id])}>{row.match_status === "imported" ? "採用済み" : "この作品を採用"}</button></td></tr>; })}</tbody></table></div></section>}

    {officialResult && <section className="card csv-preview"><h2>Official Website Crawl Result</h2><p className="muted">Run ID: {officialResult.runId}。この結果は未反映です。CSV Preview / Confirm後にのみMasterへ保存されます。</p><div className="preview-counts">
      <span className="status">Processed: {officialResult.summary.processed}</span><span className="status approved">Success: {officialResult.summary.success}</span><span className="status">Partial: {officialResult.summary.partial}</span><span className="status rejected">Blocked: {officialResult.summary.blocked}</span><span className="status rejected">Failed: {officialResult.summary.failed}</span>
      {Object.entries(officialResult.summary.coverage).map(([key, value]) => <span className="status" key={key}>{key}: {value}</span>)}
    </div><div className="table-wrap"><table><thead><tr><th>Venue</th><th>Status</th><th>Address</th><th>Hours</th><th>Closed</th><th>Access</th><th>Description source</th><th>Notes</th></tr></thead><tbody>{officialResult.rows.map((row) => <tr key={row.venue_id}><td><strong>{row.name}</strong></td><td><span className="status">{row.crawl_status}</span></td><td>{row.address || row.postal_code || "—"}</td><td>{row.opening_hours_text || "—"}</td><td>{row.closed_days_text || "—"}</td><td>{row.access_text || "—"}</td><td>{row.description_source_text || "—"}</td><td>{row.notes || "—"}</td></tr>)}</tbody></table></div><div className="actions"><a className="button" href={`/api/admin/venues/crawl/official/${officialResult.runId}/csv`}>Crawler CSV Download</a><a className="button" href={`/api/admin/venues/crawl/official/${officialResult.runId}/ai-csv`}>AI補完用CSV Download</a><button className="button secondary" onClick={() => navigator.clipboard.writeText(VENUE_AI_ENRICHMENT_PROMPT).then(() => setMessage("AI補完Promptをコピーしました。"))}>AI補完Promptをコピー</button><button className="button secondary" onClick={openCsvImport}>Structured CSVをImport</button><button className="button secondary" onClick={() => setOfficialResult(null)}>Close</button></div></section>}

    {preview && <section className="card csv-preview"><h2>CSV Preview</h2><div className="preview-counts">
      {Object.entries(preview.summary).map(([key, value]) => <span className={`status ${key === "invalid" || key === "conflicts" ? "rejected" : key === "new" ? "approved" : ""}`} key={key}>{key}: {value}</span>)}
    </div><div className="table-wrap"><table><thead><tr><th>Line</th><th>Record</th><th>Classification</th><th>Before → After</th><th>Conflict / Error</th></tr></thead><tbody>{preview.rows.map((row) => <tr key={row.line}><td>{row.line}</td><td>{row.label}</td><td><span className={`status ${row.status === "invalid" ? "rejected" : row.status === "new" ? "approved" : ""}`}>{row.status}</span></td><td>{row.changes.map((change) => `${change.field}: ${String(change.before ?? "—")} → ${String(change.after ?? "—")}`).join(" / ") || "なし"}</td><td>{[...row.conflicts.map((field) => `${field}: higher-priority source`), ...row.errors].join(" / ") || "なし"}</td></tr>)}</tbody></table></div><div className="actions"><button className="button" disabled={busy || preview.summary.invalid > 0} onClick={executeCsv}>Confirm Import</button><button className="button secondary" onClick={() => { setPreview(null); setCsvText(""); }}>Cancel</button></div></section>}

    {wikidataSummary && <section className="card"><h2>Wikidata Import Summary</h2><div className="preview-counts">{[
      ["Processed", wikidataSummary.processed], ["Fetched", wikidataSummary.fetched], ["Pages", wikidataSummary.discoveryPages ?? "—"], ["Retries", wikidataSummary.retryCount ?? "—"],
      [entity === "artists" ? "New Artist" : "New Venue", wikidataSummary.newArtists ?? wikidataSummary.newVenues ?? 0], ["Linked Existing", wikidataSummary.linkedExisting],
      ["Updated", wikidataSummary.updated], ["Unchanged", wikidataSummary.unchanged], ["Source Selection", wikidataSummary.sourceSelectionRequired],
      ["Image Candidate Added", wikidataSummary.imageCandidatesAdded], ["Errors", wikidataSummary.errors.length],
    ].map(([label, value]) => <span className="status" key={String(label)}>{label}: {String(value)}</span>)}</div>{wikidataSummary.coverage && <div className="preview-counts">{Object.entries(wikidataSummary.coverage).map(([key, value]) => <span className="status" key={key}>{key}: {value.filled}/{value.filled + value.missing} ({value.percent}%)</span>)}</div>}{wikidataSummary.imageCoverage && <><h3>Artist Image Coverage</h3><div className="preview-counts">{Object.entries(wikidataSummary.imageCoverage).map(([key, value]) => <span className="status" key={key}>{key}: {value}</span>)}</div></>}<p className="muted">{wikidataSummary.before && wikidataSummary.after ? `Venue: ${wikidataSummary.before.total} → ${wikidataSummary.after.total} / Average completeness: ${wikidataSummary.before.averageCompleteness}% → ${wikidataSummary.after.averageCompleteness}%` : `Average completeness: ${wikidataSummary.averageCompleteness ?? 0}% / Name + Nationality + Image: ${wikidataSummary.coreComplete ?? 0}件`}</p></section>}
    {imageResult && <section className="card"><h2>Targeted Image Search Result {imageResult.dryRun && "(Dry Run)"}</h2><div className="preview-counts"><span className="status">Processed: {imageResult.processed}</span><span className="status approved">Candidate Found: {imageResult.candidateFound}</span>{imageResult.coverage && <><span className="status">P18: {imageResult.coverage.wikidataP18}</span><span className="status">Commons: {imageResult.coverage.commonsCategory}</span><span className="status">Wikipedia: {imageResult.coverage.wikipediaArticle}</span><span className="status">Unique Candidates: {imageResult.coverage.uniqueCandidates}</span></>}<span className="status">Added: {imageResult.added ?? "—"}</span><span className="status">No Candidate: {imageResult.noCandidate}</span><span className="status rejected">Error: {imageResult.errors.length}</span></div></section>}
    {wikipediaResult && <section className="card"><h2>Wikipedia Address Result {wikipediaResult.dryRun && "(Dry Run)"}</h2><div className="preview-counts"><span className="status">Requested: {wikipediaResult.requested}</span><span className="status">Processed: {wikipediaResult.processed}</span><span className="status">Wikipedia Found: {wikipediaResult.wikipediaArticleFound}</span><span className="status">Address Found: {wikipediaResult.addressFound}</span><span className="status approved">Address Added: {wikipediaResult.addressAdded}</span><span className="status">Unchanged: {wikipediaResult.unchanged}</span><span className="status">No Article: {wikipediaResult.noArticle}</span><span className="status">Address Not Found: {wikipediaResult.addressNotFound}</span><span className="status rejected">Conflict: {wikipediaResult.conflict}</span><span className="status rejected">Error: {wikipediaResult.error}</span></div></section>}
    {wikipediaArtistResult && <section className="card"><h2>Wikipedia Artist Result {wikipediaArtistResult.dryRun && "(Dry Run)"}</h2><div className="preview-counts"><span className="status">Processed: {wikipediaArtistResult.processed}</span><span className="status approved">Explicit Nationality: {wikipediaArtistResult.explicitSingleNationality}</span><span className="status">No explicit: {wikipediaArtistResult.noExplicitNationality}</span><span className="status">Ambiguous: {wikipediaArtistResult.ambiguousNationality}</span><span className="status rejected">Errors: {wikipediaArtistResult.errors}</span></div><div className="table-wrap"><table><thead><tr><th>Field</th><th>Before</th><th>After</th></tr></thead><tbody>{Object.keys(wikipediaArtistResult.before).map((key) => <tr key={key}><td>{key}</td><td>{wikipediaArtistResult.before[key]}</td><td>{wikipediaArtistResult.after[key]}</td></tr>)}</tbody></table></div></section>}
    {artistMatchResult && <section className="card"><h2>Exhibition → Artist Result {artistMatchResult.dryRun && "(Dry Run)"}</h2><div className="preview-counts">{Object.entries(artistMatchResult).filter(([key]) => !["dryRun", "errors"].includes(key)).map(([key, value]) => <span className="status" key={key}>{key}: {String(value)}</span>)}<span className="status rejected">errors: {artistMatchResult.errors.length}</span></div></section>}

    {message && <div className={message.includes("失敗") || message.includes("Invalid") || message.includes("不足") ? "error" : "notice"}>{message}</div>}
    <div className="list-summary"><strong>{result.total}</strong>件{result.allTotal !== result.total ? `（全${result.allTotal}件中）` : ""} · 表示中 {rows.length}件</div>
    <div className="table-wrap"><table><thead><tr><th><input aria-label="表示中の項目をすべて選択" type="checkbox" checked={Boolean(displayRows.length) && displayRows.every(({ row }) => selected.includes(row.id))} onChange={(event) => setSelected(event.target.checked ? displayRows.map(({ row }) => row.id) : [])}/></th><th>Image（画像）</th>{(entity === "venues" || entity === "artists") && <><th>Tier</th><th>Image Status</th></>}{headings[entity].map((heading) => <th key={heading}>{heading}</th>)}<th>{entity === "artists" ? "Core Quality" : "Completeness（充足率）"}</th><th>Publication（公開状態）</th><th>Updated（更新日時）</th></tr></thead><tbody>
      {displayRows.map(({ row, cells }) => <tr className="master-row" tabIndex={0} role="button" aria-label={`${String(row[config.titleKey] || row.id)}の詳細を開く`} key={row.id} onClick={() => openDrawer(row.id)} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); openDrawer(row.id); } }}><td><input aria-label={`Select ${String(row[config.titleKey] || row.id)}`} type="checkbox" checked={selected.includes(row.id)} onClick={(event) => event.stopPropagation()} onChange={(event) => setSelected(event.target.checked ? [...selected, row.id] : selected.filter((id) => id !== row.id))}/></td><td>{row.signedImageUrl ? <img className="thumb" src={row.signedImageUrl} alt=""/> : <span className="thumb"/>}</td>{entity === "venues" && <><td>{effectiveVenueTier(row) ? <span className={`tier-badge tier-${effectiveVenueTier(row)!.toLowerCase()}`}>{effectiveVenueTier(row)}</span> : <span className="tier-badge">未分類</span>}</td><td><small>{venueImageStatus(row)}</small></td></>}{entity === "artists" && <><td>{effectiveArtistTier(row) ? <span className={`tier-badge tier-${effectiveArtistTier(row)!.toLowerCase()}`}>{effectiveArtistTier(row)}</span> : <span className="tier-badge">未分類</span>}</td><td><small>{artistImageStatus(row)}</small></td></>}{cells.map((cell, index) => <td key={`${row.id}-${headings[entity][index]}`}>{index === 0 ? <strong>{cell}</strong> : cell}</td>)}<td><div className="completeness"><span style={{ width: `${row.completeness.percent}%` }}/></div><small>{row.completeness.met}/{row.completeness.total} · {row.completeness.percent}%</small></td><td><span className={`status ${row.publication_status}`}>{displayStatus(row.publication_status)}</span></td><td>{new Date(row.updated_at).toLocaleString("ja-JP")}</td></tr>)}
      {!displayRows.length && <tr><td colSpan={headings[entity].length + ((entity === "venues" || entity === "artists") ? 8 : 6)} className="empty-state">条件に合う{config.label}はありません。Filterを変更するか、Manual Input / CSV Importから追加できます。</td></tr>}
    </tbody></table></div>
    <div ref={sentinel} className="infinite-scroll-status" aria-live="polite">{loadingMore ? "Loading...（追加読み込み中）" : loadError ? <><span>{loadError}</span><button className="button secondary" onClick={() => { setLoadError(""); setRetryKey((value) => value + 1); }}>Retry（再試行）</button></> : hasMore ? "下へスクロールすると次の50件を読み込みます" : `全${result.total}件を表示しました`}</div>
    <MasterDetailDrawer entity={entity} selectedId={searchParams.get("selected") || undefined}/>
  </>;
}
