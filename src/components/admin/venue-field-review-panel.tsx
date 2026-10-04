"use client";

import { useEffect, useState } from "react";
import type { VenueFieldReviewRow } from "@/lib/admin/venue-data-review";

function displayValue(value: unknown) {
  if (value == null || String(value).trim() === "") return "未設定";
  return String(value);
}

export function VenueFieldReviewPanel({ venueId, source, runId }: { venueId: string; source: "wikidata" | "official"; runId?: string | null }) {
  const [rows, setRows] = useState<VenueFieldReviewRow[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [crawlStatus, setCrawlStatus] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const endpoint = source === "wikidata"
    ? `/api/admin/venues/${venueId}/wikidata-preview`
    : `/api/admin/venues/${venueId}/official-preview${runId ? `?run=${encodeURIComponent(runId)}` : ""}`;

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true); setMessage("");
    fetch(endpoint, { cache: "no-store", signal: controller.signal }).then(async (response) => {
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "Preview failed");
      const nextRows = (body.rows || []) as VenueFieldReviewRow[];
      setRows(nextRows);
      setCrawlStatus(typeof body.crawlStatus === "string" ? body.crawlStatus : null);
      setSelected(nextRows.filter((row) => row.defaultSelected).map((row) => row.key));
    }).catch((error) => { if (!controller.signal.aborted) setMessage(error instanceof Error ? error.message : "Preview failed"); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [endpoint]);

  async function apply() {
    setBusy(true); setMessage("");
    try {
      const url = source === "wikidata" ? endpoint : `/api/admin/venues/${venueId}/official-fields`;
      const response = await fetch(url, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(source === "wikidata" ? { fields: selected } : { runId, fields: selected }) });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "Apply failed");
      setMessage(body.message || "反映しました。");
      window.dispatchEvent(new CustomEvent("muuzee:master-updated", { detail: { entity: "venues", id: venueId, preserveListOrder: true } }));
    } catch (error) { setMessage(error instanceof Error ? error.message : "Apply failed"); }
    finally { setBusy(false); }
  }

  if (loading) return <p className="drawer-loading">候補を取得しています…</p>;
  if (message && !rows.length) return <div className="error">{message}</div>;
  return <div className="venue-field-review-panel">
    <p className="muted">Currentと候補を比較し、使用する項目だけ選択します。Manualなど優先度の高い現在値は保護されます。</p>
    {source === "official" && crawlStatus === "partial" && <div className="notice">一部のみ取得できました。取得できた項目だけ確認してください。</div>}
    <div className="venue-field-review-list">{rows.map((row) => {
      const disabled = row.unchanged || row.protected || row.candidateValue == null || String(row.candidateValue).trim() === "";
      return <label className={`venue-field-review-row${disabled ? " is-disabled" : ""}`} key={row.key}>
        <input type="checkbox" checked={selected.includes(row.key)} disabled={disabled || busy} onChange={(event) => setSelected((current) => event.target.checked ? [...current, row.key] : current.filter((key) => key !== row.key))}/>
        <span className="venue-field-review-copy"><strong>{row.label}</strong><code>{row.key}</code><span><small>現在</small>{displayValue(row.currentValue)} <em>{row.currentSourceLabel}</em></span><span><small>候補</small>{displayValue(row.candidateValue)} <em>{row.candidateSourceLabel}</em></span>{row.candidateSourceUrl && <a href={row.candidateSourceUrl} target="_blank" rel="noreferrer">データ元を開く ↗</a>}{row.protected && <b>{row.currentSourceLabel}値を保護</b>}{row.unchanged && <b>変更なし</b>}</span>
      </label>;
    })}</div>
    <div className="actions"><button type="button" className="button" disabled={busy || selected.length === 0} onClick={apply}>{busy ? "反映中…" : "選択した項目を反映"}</button></div>
    {message && <div className={message.includes("失敗") || message.includes("failed") ? "error" : "notice"}>{message}</div>}
  </div>;
}
