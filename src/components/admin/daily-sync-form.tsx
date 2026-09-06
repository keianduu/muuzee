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
  return <section className="card"><p className="eyebrow">Exhibition Daily Sync</p><h2>Current / upcoming difference sync</h2><p className="muted">{range.dateFrom} – {range.dateTo}（Asia/Tokyo、終了後45日buffer）。LOCAL検証用は20件。Applyは既存Relationも安全にbackfillします。</p><div className="actions"><button className="button secondary" type="button" disabled={busy} onClick={() => run(true)}>Dry Run</button><button className="button" type="button" disabled={busy} onClick={() => run(false)}>{busy ? "Running…" : "Apply"}</button></div>{result && <pre className="result">{result}</pre>}</section>;
}
