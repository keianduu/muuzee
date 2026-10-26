"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { WikidataVenueImportSummary } from "@/lib/wikidata/venue-import-types";

export const VENUE_INITIAL_ACQUISITION_BATCH_SIZE = 5;

type InitialAcquisitionStatus = "not_started" | "started" | "unavailable";

export function venueInitialAcquisitionResultMetrics(result: Pick<
  WikidataVenueImportSummary,
  "fetched" | "newVenues" | "linkedExisting" | "updated" | "unchanged" | "sourceSelectionRequired" | "errors"
>) {
  return [
    ["取得", result.fetched],
    ["新規", result.newVenues],
    ["既存接続", result.linkedExisting],
    ["更新", result.updated],
    ["変更なし", result.unchanged],
    ["要確認", result.sourceSelectionRequired],
    ["エラー", result.errors.length],
  ] as const;
}

export function VenueInitialAcquisitionForm({ status, actionsEnabled = true }: {
  status: InitialAcquisitionStatus;
  actionsEnabled?: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<WikidataVenueImportSummary | null>(null);
  const [error, setError] = useState("");
  const available = actionsEnabled && status !== "unavailable";
  const started = status === "started" || result !== null;

  async function run() {
    if (!available) return;
    if (!window.confirm("WikidataからVenueの初回取り込みを開始します。実在Venueの登録・既存Venueへの接続を行います。続行しますか？")) return;
    setBusy(true);
    setResult(null);
    setError("");
    try {
      const response = await fetch("/api/admin/venues/import/wikidata", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: "count", count: VENUE_INITIAL_ACQUISITION_BATCH_SIZE }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "Venue initial acquisition failed");
      setResult(body);
      router.refresh();
    } catch {
      setError("Venueの初回取り込みに失敗しました。時間をおいて再度お試しください。");
    } finally {
      setBusy(false);
    }
  }

  return <div className="master-operator-action venue-initial-acquisition" id="venue-initial-acquisition">
    <p className="venue-initial-acquisition-status"><strong>初回取り込み：{status === "unavailable" ? "確認できません" : started ? "進行中" : "未実施"}</strong></p>
    <p>Wikidataから実在Venueを少数ずつ登録・接続します。</p>
    <div className="actions">
      <button className="button" type="button" disabled={busy || !available} onClick={run}>
        {busy ? "処理中…" : started ? "続きを取り込む" : "初回取り込み"}
      </button>
    </div>
    {status === "unavailable" && <p className="data-acquisition-empty-state">初回取り込み状況を取得できません。</p>}
    {result && <div className="master-refresh-result" role="status">
      <strong>取り込み結果</strong>
      <dl className="venue-initial-acquisition-result">
        {venueInitialAcquisitionResultMetrics(result).map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}件</dd></div>)}
      </dl>
    </div>}
    {error && <div className="error" role="alert">{error}</div>}
  </div>;
}
