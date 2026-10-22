"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function ImportForm({ dateFrom, dateTo }: { dateFrom: string; dateTo: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<string>("");
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setResult("");
    const form = new FormData(event.currentTarget);
    try {
      const response = await fetch("/api/admin/imports", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ keyword: form.get("keyword"), dateFrom: form.get("date_from"), dateTo: form.get("date_to"), includePast: form.get("include_past") === "true" }) });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "Import failed");
      setResult(JSON.stringify(body, null, 2));
      router.refresh();
    } catch (error) { setResult(error instanceof Error ? error.message : "Import failed"); }
    finally { setBusy(false); }
  }
  return <form className="card data-acquisition-operation" id="manual-backfill" onSubmit={submit}>
    <p className="eyebrow">Manual Backfill / Full Import</p><h2>過去データを一括取り込みする</h2>
    <p className="muted">初回登録や過去期間の補完用です。指定した期間のJapan Search検索結果を最後まで確認してまとめて取り込みます。通常の毎日更新では使いません。</p>
    <div className="toolbar">
      <div className="field"><label htmlFor="keyword">Keyword（空欄で全国）</label><input id="keyword" name="keyword" defaultValue="" /></div>
      <div className="field"><label htmlFor="date_from">開催期間 From</label><input id="date_from" name="date_from" type="date" defaultValue={dateFrom} /></div>
      <div className="field"><label htmlFor="date_to">開催期間 To</label><input id="date_to" name="date_to" type="date" defaultValue={dateTo} /></div>
      <label><input name="include_past" type="checkbox" value="true" style={{width:"auto"}} /> 過去・会期不明も対象</label>
      <button className="button" type="submit" disabled={busy}>{busy ? "全件を確認・取り込み中…" : "指定条件の全件を取り込む"}</button>
    </div>
    <p className="data-acquisition-operation-meta">指定期間に重なる全件を取り込みます。処理中はこの画面を閉じないでください。</p>
    {result && <pre className="result">{result}</pre>}
  </form>;
}
