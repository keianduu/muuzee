"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { resolutionEntityLabel, resolutionStatusLabel } from "@/lib/admin/data-acquisition-presentation";

export function TargetedResolutionForm({ overview }: { overview: { counts: Record<string, number>; items: Array<Record<string, unknown>> } }) {
  const router = useRouter(); const [busy, setBusy] = useState(false); const [result, setResult] = useState("");
  async function run(dryRun: boolean) {
    setBusy(true); setResult("");
    try {
      const response = await fetch("/api/admin/imports/targeted-resolution", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ dryRun, batchSize: 10 }) });
      const body = await response.json(); if (!response.ok) throw new Error(body.error || "Targeted resolution failed");
      setResult(JSON.stringify(body, null, 2)); router.refresh();
    } catch (error) { setResult(error instanceof Error ? error.message : "Targeted resolution failed"); } finally { setBusy(false); }
  }
  return <section className="card data-acquisition-operation resolution-worker" id="targeted-master-resolution">
    <p className="eyebrow">Targeted Master Resolution</p><h2>Venue / Artist情報を確認する</h2>
    <p className="muted">展示会データに書かれたVenue名・Artist名を、Muuzeeの正規データに紐づける処理です。Daily Syncが保存した項目だけを1回10件処理し、自動で決められないものは要確認として残します。</p>
    <div className="metrics">
      <div className="metric"><strong>{overview.counts.venuePending || 0}</strong><span>未処理のVenue</span></div>
      <div className="metric"><strong>{overview.counts.artistPending || 0}</strong><span>未処理のArtist</span></div>
      {(["ambiguous", "no_candidate", "failed", "resolved"] as const).map((key) => <div className="metric" key={key}><strong>{overview.counts[key] || 0}</strong><span>{resolutionStatusLabel(key)}</span></div>)}
    </div>
    <div className="actions"><button className="button secondary" disabled={busy} onClick={() => run(true)}>事前確認</button><button className="button" disabled={busy} onClick={() => run(false)}>{busy ? "処理中…" : "未処理を解決する"}</button></div>
    {result && <pre className="result">{result}</pre>}
    <h3>Venue / Artistの要確認項目</h3>
    <p className="muted">候補が複数、候補なし、取得・処理エラーなど、自動で正規データへ紐づけられなかった項目です。</p>
    <div className="table-wrap"><table><thead><tr><th>Entity</th><th>Source値</th><th>Exhibition</th><th>状態</th><th>候補 / External ID</th><th>判定方法</th><th>解決先Master</th><th>理由 / Diagnostics</th></tr></thead><tbody>
      {overview.items.map((item) => { const diagnostics = (item.resolution_diagnostics || {}) as Record<string, unknown>; const status = String(item.resolution_status); return <tr key={String(item.id)}><td>{resolutionEntityLabel(item.entity_type)}</td><td>{String(item.source_value)}</td><td>{String((item.exhibitions as { title?: string } | null)?.title || "-")}</td><td><span className={`status ${status}`} title={status}>{resolutionStatusLabel(status)}</span></td><td>{String(diagnostics.candidate || diagnostics.externalId || "-")}</td><td>{String(item.match_method || diagnostics.matchMethod || "-")}</td><td>{String(item.resolved_master_id || "-")}</td><td>{String(item.match_reason || diagnostics.reason || "-")}</td></tr>; })}
      {!overview.items.length && <tr><td colSpan={8} className="muted">Venue / Artistの要確認項目はありません。</td></tr>}
    </tbody></table></div>
  </section>;
}
