"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { isHumanResolutionStatus, resolutionEntityLabel, resolutionOperatorQueues, resolutionStatusLabel } from "@/lib/admin/data-acquisition-presentation";

type ResolutionCounts = {
  resolved_existing?: number;
  resolved_new_master?: number;
  ambiguous?: number;
  no_candidate?: number;
  failed?: number;
  skipped?: number;
};

type ResolutionResult = {
  dryRun: boolean;
  scanned: number;
  venue: ResolutionCounts;
  artist: ResolutionCounts;
};

export function TargetedResolutionForm({ overview }: { overview: { counts: Record<string, number>; items: Array<Record<string, unknown>> } }) {
  const router = useRouter(); const [busy, setBusy] = useState(false); const [result, setResult] = useState<ResolutionResult | null>(null); const [error, setError] = useState("");
  async function run(dryRun: boolean) {
    setBusy(true); setResult(null); setError("");
    try {
      const response = await fetch("/api/admin/imports/targeted-resolution", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ dryRun, batchSize: 10 }) });
      const body = await response.json(); if (!response.ok) throw new Error(body.error || "Targeted resolution failed");
      setResult(body); router.refresh();
    } catch { setError("紐づけ処理を実行できませんでした。時間をおいて再度お試しください。"); } finally { setBusy(false); }
  }
  const { automatic, human, showAutomaticActions } = resolutionOperatorQueues(overview.counts);
  const humanGateItems = overview.items.filter((item) => isHumanResolutionStatus(item.resolution_status));
  return <div className="exhibition-resolution-operation" id="targeted-master-resolution">
    <div><h3>Venue / Artistの紐づけ</h3><p>自動処理できる項目と、人の判断が必要な項目を分けて確認します。</p></div>
    {automatic > 0 || human > 0 ? <>
      <div className="exhibition-resolution-counts"><span>自動処理待ち <strong>{automatic}</strong>件</span><span>要確認 <strong>{human}</strong>件</span></div>
      {showAutomaticActions && <div className="actions"><button className="button secondary" disabled={busy} onClick={() => run(true)}>解決内容を確認</button><button className="button" disabled={busy} onClick={() => run(false)}>{busy ? "処理中…" : "自動で解決する"}</button></div>}
    </> : <p className="data-acquisition-empty-state">Venue / Artistの要確認項目はありません。</p>}
    {result && <div className="master-refresh-result" role="status"><strong>{result.dryRun ? "解決内容" : "解決結果"}</strong><p>確認件数 {result.scanned}件 · 解決 {Number(result.venue.resolved_existing || 0) + Number(result.venue.resolved_new_master || 0) + Number(result.artist.resolved_existing || 0) + Number(result.artist.resolved_new_master || 0)}件 · 要確認 {Number(result.venue.ambiguous || 0) + Number(result.venue.no_candidate || 0) + Number(result.artist.ambiguous || 0) + Number(result.artist.no_candidate || 0)}件 · エラー {Number(result.venue.failed || 0) + Number(result.artist.failed || 0)}件</p></div>}
    {error && <div className="error" role="alert">{error}</div>}
    {human > 0 && humanGateItems.length > 0 && <details className="exhibition-resolution-details"><summary>要確認の内容を見る</summary><div className="table-wrap"><table><thead><tr><th>Entity</th><th>対象名</th><th>Exhibition</th><th>状態</th></tr></thead><tbody>
      {humanGateItems.map((item) => { const status = String(item.resolution_status); return <tr key={String(item.id)}><td>{resolutionEntityLabel(item.entity_type)}</td><td>{String(item.source_value)}</td><td>{String((item.exhibitions as { title?: string } | null)?.title || "-")}</td><td><span className={`status ${status}`} title={status}>{resolutionStatusLabel(status)}</span></td></tr>; })}
    </tbody></table></div></details>}
  </div>;
}
