"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";

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
  return <section className="card resolution-worker">
    <p className="eyebrow">Targeted Master Resolution</p><h2>Venue / Artist unresolved handoff</h2>
    <p className="muted">Daily Syncが保存したhandoffのみを1回10件処理します。曖昧な候補は自動採用しません。</p>
    <div className="metrics">
      <div className="metric"><strong>{overview.counts.venuePending || 0}</strong><span>Venue Pending</span></div>
      <div className="metric"><strong>{overview.counts.artistPending || 0}</strong><span>Artist Pending</span></div>
      {(["ambiguous", "no_candidate", "failed", "resolved"] as const).map((key) => <div className="metric" key={key}><strong>{overview.counts[key] || 0}</strong><span>{key}</span></div>)}
    </div>
    <div className="actions"><button className="button secondary" disabled={busy} onClick={() => run(true)}>Dry Run</button><button className="button" disabled={busy} onClick={() => run(false)}>{busy ? "Running…" : "Resolve Pending"}</button></div>
    {result && <pre className="result">{result}</pre>}
    <h3>Unresolved items</h3>
    <div className="table-wrap"><table><thead><tr><th>Entity</th><th>Source value</th><th>Exhibition</th><th>Status</th><th>Candidate / external ID</th><th>Method</th><th>Resolved master</th><th>Reason / diagnostics</th></tr></thead><tbody>
      {overview.items.map((item) => { const diagnostics = (item.resolution_diagnostics || {}) as Record<string, unknown>; return <tr key={String(item.id)}><td>{String(item.entity_type)}</td><td>{String(item.source_value)}</td><td>{String((item.exhibitions as { title?: string } | null)?.title || "-")}</td><td><span className={`status ${String(item.resolution_status)}`}>{String(item.resolution_status)}</span></td><td>{String(diagnostics.candidate || diagnostics.externalId || "-")}</td><td>{String(item.match_method || diagnostics.matchMethod || "-")}</td><td>{String(item.resolved_master_id || "-")}</td><td>{String(item.match_reason || diagnostics.reason || "-")}</td></tr>; })}
      {!overview.items.length && <tr><td colSpan={8} className="muted">未解決Itemはありません。</td></tr>}
    </tbody></table></div>
  </section>;
}
