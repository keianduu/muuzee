"use client";

import { useEffect, useRef, useState } from "react";
import type { VenueFieldReviewRow } from "@/lib/admin/venue-data-review";
import { AdminFeedback } from "./admin-feedback";

function displayValue(value: unknown) {
  if (value == null || String(value).trim() === "") return "未設定";
  return String(value);
}

export function VenueFieldReviewList({ rows, selected, busy, onSelectedChange }: { rows: VenueFieldReviewRow[]; selected: string[]; busy: boolean; onSelectedChange: (next: string[]) => void }) {
  return <div className="venue-field-review-list">{rows.map((row) => {
    const disabled = row.resultState !== "fetched";
    return <label className={`venue-field-review-row${disabled ? " is-disabled" : ""}`} key={row.key}>
      <input type="checkbox" checked={selected.includes(row.key)} disabled={disabled || busy} onChange={(event) => onSelectedChange(event.target.checked ? [...selected, row.key] : selected.filter((key) => key !== row.key))}/>
      <span className="venue-field-review-copy"><strong>{row.label}</strong><code>{row.key}</code><span><small>現在</small>{displayValue(row.currentValue)} <em>{row.currentSourceLabel}</em></span><span><small>候補</small>{displayValue(row.candidateValue)} <em>{row.candidateSourceLabel}</em></span>{row.candidateSourceUrl && <a href={row.candidateSourceUrl} target="_blank" rel="noreferrer">データ元を開く ↗</a>}<b>{row.resultState === "missing" ? "取得なし" : row.resultState === "protected" ? `${row.currentSourceLabel}値を保護` : row.resultState === "unchanged" ? "変更なし" : "取得済み"}</b></span>
    </label>;
  })}</div>;
}

export function VenueFieldReviewPanel({ venueId, source, runId, targetUrl }: { venueId: string; source: "wikidata" | "official"; runId?: string | null; targetUrl?: string | null }) {
  const [rows, setRows] = useState<VenueFieldReviewRow[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [crawlStatus, setCrawlStatus] = useState<string | null>(null);
  const [resolvedRunId, setResolvedRunId] = useState(runId || null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [retryCount, setRetryCount] = useState(0);
  const lastRequestKey = useRef("");
  const endpoint = source === "wikidata"
    ? `/api/admin/venues/${venueId}/wikidata-preview`
    : `/api/admin/venues/${venueId}/official-preview${runId ? `?run=${encodeURIComponent(runId)}` : ""}`;

  useEffect(() => {
    const requestKey = `${endpoint}:${targetUrl || ""}:${retryCount}`;
    if (lastRequestKey.current === requestKey) return;
    lastRequestKey.current = requestKey;
    const controller = new AbortController();
    setLoading(true); setMessage("");
    const shouldStartOfficial = source === "official" && !runId;
    fetch(endpoint, shouldStartOfficial ? { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ targetUrl }), signal: controller.signal } : { cache: "no-store", signal: controller.signal }).then(async (response) => {
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "Preview failed");
      const nextRows = (body.rows || []) as VenueFieldReviewRow[];
      setRows(nextRows);
      setCrawlStatus(typeof body.crawlStatus === "string" ? body.crawlStatus : null);
      if (typeof body.runId === "string") setResolvedRunId(body.runId);
      setSelected(nextRows.filter((row) => row.defaultSelected).map((row) => row.key));
    }).catch((error) => { if (!controller.signal.aborted) setMessage(error instanceof Error ? error.message : "Preview failed"); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [endpoint, retryCount, runId, source, targetUrl]);

  async function apply() {
    setBusy(true); setMessage("");
    try {
      const url = source === "wikidata" ? endpoint : `/api/admin/venues/${venueId}/official-fields`;
      const response = await fetch(url, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(source === "wikidata" ? { fields: selected } : { runId: resolvedRunId, fields: selected }) });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "Apply failed");
      setMessage(body.message || "反映しました。");
      window.dispatchEvent(new CustomEvent("muuzee:master-updated", { detail: { entity: "venues", id: venueId, preserveListOrder: true } }));
    } catch (error) { setMessage(error instanceof Error ? error.message : "Apply failed"); }
    finally { setBusy(false); }
  }

  if (loading) return <p className="drawer-loading">候補を取得しています…</p>;
  if (message && !rows.length) return <><AdminFeedback variant="error" message={message}/>{source === "official" && <button type="button" className="button secondary" onClick={() => setRetryCount((current) => current + 1)}>再試行</button>}</>;
  const crawlFailed = source === "official" && crawlStatus && !["success", "partial", "completed"].includes(crawlStatus);
  return <div className="venue-field-review-panel">
    <p className="muted">Currentと候補を比較し、使用する項目だけ選択します。Manualなど優先度の高い現在値は保護されます。</p>
    {source === "official" && crawlStatus === "partial" && <AdminFeedback variant="warning" message="一部のみ取得できました。取得できた項目だけ確認してください。"/>}
    {crawlFailed && <AdminFeedback variant="error" message={`取得を完了できませんでした（${crawlStatus}）。URLを確認して再試行してください。`}/>}
    <VenueFieldReviewList rows={rows} selected={selected} busy={busy} onSelectedChange={setSelected}/>
    <div className="actions"><button type="button" className="button" disabled={busy || selected.length === 0} onClick={apply}>{busy ? "反映中…" : "選択した項目を反映"}</button></div>
    {crawlFailed && <button type="button" className="button secondary" onClick={() => setRetryCount((current) => current + 1)}>再試行</button>}
    <AdminFeedback variant={message.includes("失敗") || message.includes("failed") ? "error" : "success"} message={message}/>
  </div>;
}
