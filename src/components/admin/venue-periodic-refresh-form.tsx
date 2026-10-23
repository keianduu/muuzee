"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

type RefreshResult = {
  dryRun: boolean;
  runId: string | null;
  requested: number;
  scanned: number;
  sourceRowsScanned: number;
  scanTruncated: boolean;
  fetched: number;
  changed: number;
  unchanged: number;
  protected: number;
  protectedFields: number;
  ambiguousIdentities: number;
  identityAmbiguities: Array<{ venueId: string; venueName: string; qids: string[]; qidCount: number; status: "identity_ambiguous" }>;
  errors: Array<{ qid?: string; message: string }>;
};

export function VenuePeriodicRefreshForm() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<RefreshResult | null>(null);
  const [error, setError] = useState("");

  async function run(dryRun: boolean) {
    if (!dryRun && !window.confirm("既存のWikidata接続済みVenueを最大20件更新します。新規Venueの作成と公開状態の変更は行いません。続行しますか？")) return;
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
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Venue periodic refresh failed");
    } finally {
      setBusy(false);
    }
  }

  return <section className="card data-acquisition-operation" id="master-refresh">
    <p className="eyebrow">Master Refresh</p>
    <h2>Venue / Artist / Worksを定期更新する</h2>
    <p className="muted">初回同期後のMasterをEntityごとに更新します。現在は、既にWikidata QIDへ接続済みのVenueだけを最大20件ずつ安全に確認・反映できます。</p>
    <div className="master-refresh-entities">
      <div className="master-refresh-entity">
        <div><h3>Venue</h3><p>既存QIDの最新値を比較し、Manual / Official Websiteなど優先度の高い値を保護します。新規Venueや画像候補は作成せず、公開状態も変更しません。</p></div>
        <div className="actions"><button className="button secondary" type="button" disabled={busy} onClick={() => run(true)}>事前確認</button><button className="button" type="button" disabled={busy} onClick={() => run(false)}>{busy ? "処理中…" : "更新する"}</button></div>
      </div>
      <div className="master-refresh-entity master-refresh-entity--pending"><div><h3>Artist</h3><p>現在は定期更新の準備中</p><small>Full Sync / Diff Sync contract整備後に有効化します（Order 150）。</small></div></div>
      <div className="master-refresh-entity master-refresh-entity--pending"><div><h3>Works</h3><p>現在は定期更新の準備中</p><small>Source adapter / deterministic contract整備後に有効化します（Order 160）。</small></div></div>
    </div>
    {result && <div className="master-refresh-result" role="status">
      <strong>{result.dryRun ? "事前確認" : "更新結果"}</strong>
      <p>{result.scanned}件確認 · Source走査 {result.sourceRowsScanned}件{result.scanTruncated ? "（上限到達）" : ""} · 取得 {result.fetched}件 · 変更あり {result.changed}件 · 変更なし {result.unchanged}件 · ID要確認 {result.ambiguousIdentities}件 · 保護された項目あり {result.protected}件（{result.protectedFields}項目）· エラー {result.errors.length}件</p>
      {result.identityAmbiguities.length > 0 && <small>要確認: {result.identityAmbiguities.map((item) => `${item.venueName}（${item.qids.join(" / ")}${item.qidCount > item.qids.length ? ` / 他${item.qidCount - item.qids.length}件` : ""}）`).join("、")}</small>}
      {result.runId && <small>Run ID: {result.runId}</small>}
    </div>}
    {error && <div className="error" role="alert">{error}</div>}
  </section>;
}
