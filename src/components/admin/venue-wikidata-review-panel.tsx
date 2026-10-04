"use client";

import { useCallback, useEffect, useState } from "react";
import type { VenueMatchCandidateRow } from "@/lib/admin/types";
import type { VenueFieldReviewRow } from "@/lib/admin/venue-data-review";
import { AdminFeedback } from "./admin-feedback";
import { VenueFieldReviewList } from "./venue-field-review-panel";

type LoadState = "loading" | "candidate" | "empty" | "error";

export function VenueWikidataReviewPanel({ venueId, matched }: { venueId: string; matched: boolean }) {
  const [state, setState] = useState<LoadState>("loading");
  const [candidates, setCandidates] = useState<VenueMatchCandidateRow[]>([]);
  const [candidateId, setCandidateId] = useState<string | null>(null);
  const [rows, setRows] = useState<VenueFieldReviewRow[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [confirmed, setConfirmed] = useState(matched);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  const loadRows = useCallback(async (id?: string | null) => {
    const query = id ? `?candidate=${encodeURIComponent(id)}` : "";
    const response = await fetch(`/api/admin/venues/${venueId}/wikidata-preview${query}`, { cache: "no-store" });
    const body = await response.json();
    if (!response.ok) throw new Error(body.error || "Wikidata項目を取得できませんでした。");
    const nextRows = (body.rows || []) as VenueFieldReviewRow[];
    setRows(nextRows);
    setSelected(nextRows.filter((row) => row.defaultSelected).map((row) => row.key));
  }, [venueId]);

  const load = useCallback(async () => {
    setState("loading"); setMessage(""); setRows([]);
    try {
      if (matched) {
        await loadRows();
        setConfirmed(true); setState("candidate");
        return;
      }
      const response = await fetch(`/api/admin/venues/${venueId}/enrich`, { method: "POST" });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "Wikidata候補を取得できませんでした。");
      const next = (body.candidates || []) as VenueMatchCandidateRow[];
      if (!next.length) { setCandidates([]); setState("empty"); return; }
      setCandidates(next);
      const first = next[0]; setCandidateId(first.id);
      await loadRows(first.id);
      setState("candidate");
    } catch (error) { setMessage(error instanceof Error ? error.message : "Wikidata候補を取得できませんでした。"); setState("error"); }
  }, [loadRows, matched, venueId]);

  useEffect(() => { void load(); }, [load]);

  async function choose(id: string) {
    setCandidateId(id); setBusy(true); setMessage("");
    try { await loadRows(id); }
    catch (error) { setMessage(error instanceof Error ? error.message : "候補項目を取得できませんでした。"); }
    finally { setBusy(false); }
  }

  async function confirm() {
    if (!candidateId) return;
    setBusy(true); setMessage("");
    try {
      const response = await fetch(`/api/admin/venues/${venueId}/matches/${candidateId}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "confirm" }) });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "Wikidata候補を確定できませんでした。");
      setConfirmed(true); setMessage("同一施設として確定しました。Master項目はまだ変更していません。");
      window.dispatchEvent(new CustomEvent("muuzee:master-updated", { detail: { entity: "venues", id: venueId, preserveListOrder: true } }));
    } catch (error) { setMessage(error instanceof Error ? error.message : "Wikidata候補を確定できませんでした。"); }
    finally { setBusy(false); }
  }

  async function apply() {
    setBusy(true); setMessage("");
    try {
      const response = await fetch(`/api/admin/venues/${venueId}/wikidata-preview`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ fields: selected }) });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "Wikidata項目を反映できませんでした。");
      setMessage(body.message || "選択した項目を反映しました。");
      window.dispatchEvent(new CustomEvent("muuzee:master-updated", { detail: { entity: "venues", id: venueId, preserveListOrder: true } }));
    } catch (error) { setMessage(error instanceof Error ? error.message : "Wikidata項目を反映できませんでした。"); }
    finally { setBusy(false); }
  }

  if (state === "loading") return <><p className="drawer-loading">Wikidata候補を取得しています…</p><p className="muted">取得結果はこのDrawerに表示されます。</p></>;
  if (state === "error") return <><AdminFeedback variant="error" message={message}/><button type="button" className="button secondary" onClick={() => void load()}>再試行</button></>;
  if (state === "empty") return <><AdminFeedback variant="warning" message="一致するWikidata候補が見つかりませんでした。"/><p className="muted">QID入力は不要です。基本情報を手動で整えるか、公式サイトから取得してください。</p><button type="button" className="button secondary" onClick={() => void load()}>再検索</button></>;
  const active = candidates.find((candidate) => candidate.id === candidateId);
  return <div className="venue-field-review-panel">
    {!matched && <section><h2>施設候補</h2><p className="muted">同一施設を確認してください。この操作だけではMaster項目を変更しません。</p><div className="wikidata-review-candidates">{candidates.map((candidate) => <label className={candidate.id === candidateId ? "is-selected" : ""} key={candidate.id}><input type="radio" name="wikidata-candidate" checked={candidate.id === candidateId} onChange={() => void choose(candidate.id)}/><span><strong>{candidate.label_ja || candidate.label_en || "名称未取得"}</strong><small>{candidate.description || "説明未取得"}</small><small>{candidate.external_id} · 一致度 {candidate.confidence}</small></span></label>)}</div>{active && !confirmed && <div className="actions"><button type="button" className="button" disabled={busy} onClick={confirm}>この施設として確定</button></div>}</section>}
    <section><h2>取得項目</h2><p className="muted">取得できない項目も含め、Wikidataのカバレッジを確認できます。</p><VenueFieldReviewList rows={rows} selected={selected} busy={busy} onSelectedChange={setSelected}/>{confirmed ? <div className="actions"><button type="button" className="button" disabled={busy || selected.length === 0} onClick={apply}>{busy ? "反映中…" : "選択した項目を反映"}</button></div> : <AdminFeedback variant="info" message="同一施設として確定すると、選択した項目を反映できます。"/>}</section>
    <AdminFeedback variant={message.includes("できません") ? "error" : "success"} message={message}/>
  </div>;
}
