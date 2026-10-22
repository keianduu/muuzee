"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { dailySyncWindow } from "@/lib/exhibition-sync/policy";

export function DailySyncForm() {
  const router = useRouter();
  const range = dailySyncWindow();
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState("");
  async function run(dryRun: boolean) {
    setBusy(true); setResult("");
    try {
      const response = await fetch("/api/admin/imports/daily-sync", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ dryRun, sampleLimit: 20, backfillExisting: !dryRun }) });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "Daily Sync failed");
      setResult(JSON.stringify(body, null, 2)); router.refresh();
    } catch (error) { setResult(error instanceof Error ? error.message : "Daily Sync failed"); }
    finally { setBusy(false); }
  }
  return <section className="card data-acquisition-operation" id="exhibition-daily-sync"><p className="eyebrow">Exhibition Daily Sync</p><h2>展示会データを更新する</h2><p className="muted">Japan Search / Art Commonsから、最近終了した展示会と今後開催予定の展示会を確認し、変更があるデータだけを更新します。</p><p className="data-acquisition-operation-meta">対象期間: {range.dateFrom} – {range.dateTo}（Asia/Tokyo、終了後45日buffer）· LOCAL検証用は20件 · 反映時は既存Relationも安全にbackfill</p><div className="actions"><button className="button secondary" type="button" disabled={busy} onClick={() => run(true)}>事前確認</button><button className="button" type="button" disabled={busy} onClick={() => run(false)}>{busy ? "処理中…" : "反映する"}</button></div>{result && <pre className="result">{result}</pre>}</section>;
}
