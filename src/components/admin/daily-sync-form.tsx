"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { dailySyncWindow } from "@/lib/exhibition-sync/policy";

export function DailySyncForm({ actionsEnabled = true }: { actionsEnabled?: boolean }) {
  const router = useRouter();
  const range = dailySyncWindow();
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<Record<string, unknown> | null>(null);
  const [error, setError] = useState("");
  async function run(dryRun: boolean) {
    if (!actionsEnabled) return;
    if (!dryRun && !window.confirm("展示会データを更新します。現在の条件で変更を反映します。続行しますか？")) return;
    setBusy(true); setResult(null); setError("");
    try {
      const response = await fetch("/api/admin/imports/daily-sync", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ dryRun, sampleLimit: 20, backfillExisting: !dryRun }) });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "Daily Sync failed");
      setResult(body); router.refresh();
    } catch { setError("展示会データを確認できませんでした。時間をおいて再度お試しください。"); }
    finally { setBusy(false); }
  }
  return <div className="exhibition-sync-operation" id="exhibition-daily-sync"><p className="data-acquisition-operation-meta">対象期間: {range.dateFrom} – {range.dateTo}</p><div className="actions"><button className="button secondary" type="button" disabled={busy || !actionsEnabled} onClick={() => run(true)}>変更内容を確認</button><button className="button" type="button" disabled={busy || !actionsEnabled} onClick={() => run(false)}>{busy ? "処理中…" : "展示会データを更新する"}</button></div>{!actionsEnabled && <p className="data-acquisition-empty-state">現在は更新操作を利用できません。</p>}{result && <div className="master-refresh-result" role="status"><strong>{result.dryRun ? "変更内容" : "更新結果"}</strong><p>確認件数 {String(result.scanned || 0)}件 · 新規 {String(result.newExhibitions || 0)}件 · 更新 {String(result.changedExhibitions || 0)}件 · 変更なし {String(result.unchangedExhibitions || 0)}件 · 要確認 {String(Number(result.venueTargetedHandoffs || 0) + Number(result.artistTargetedHandoffs || 0))}件 · エラー {Array.isArray(result.errors) ? result.errors.length : 0}件</p></div>}{error && <div className="error" role="alert">{error}</div>}</div>;
}
