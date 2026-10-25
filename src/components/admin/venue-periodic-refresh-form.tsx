"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

type RefreshResult = {
  dryRun: boolean;
  scanned: number;
  reachedCorpusEnd: boolean;
  changed: number;
  unchanged: number;
  ambiguousIdentities: number;
  errors: Array<{ qid?: string; message: string }>;
};

export function VenuePeriodicRefreshForm() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<RefreshResult | null>(null);
  const [error, setError] = useState("");

  async function run(dryRun: boolean) {
    if (!dryRun && !window.confirm("Venueの情報を更新します。現在の条件で変更を反映します。続行しますか？")) return;
    setBusy(true);
    setResult(null);
    setError("");
    try {
      const response = await fetch("/api/admin/imports/master-refresh/venue", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dryRun, limit: 20 }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "Venue periodic refresh failed");
      setResult(body);
      if (!dryRun) router.refresh();
    } catch {
      setError("Venue情報を確認できませんでした。時間をおいて再度お試しください。");
    } finally {
      setBusy(false);
    }
  }

  return <div className="master-operator-action" id="venue-periodic-refresh">
    <p>登録済みのVenue情報に変更があるか確認できます。</p>
    <div className="actions"><button className="button secondary" type="button" disabled={busy} onClick={() => run(true)}>変更内容を確認</button><button className="button" type="button" disabled={busy} onClick={() => run(false)}>{busy ? "処理中…" : "情報を更新する"}</button></div>
    {result && <div className="master-refresh-result" role="status">
      <strong>{result.dryRun ? "変更内容" : "更新結果"}</strong>
      <p>確認件数 {result.scanned}件 · {result.dryRun ? "更新予定" : "更新件数"} {result.changed}件 · 変更なし {result.unchanged}件 · 要確認 {result.ambiguousIdentities}件 · エラー {result.errors.length}件</p>
      <small>{result.reachedCorpusEnd
        ? "今回で一巡しました。次回は先頭から確認します。"
        : "次回は続きから確認します。"}</small>
    </div>}
    {error && <div className="error" role="alert">{error}</div>}
  </div>;
}
