"use client";

import { useState } from "react";
import type { OccurrenceRow, VenueRow } from "@/lib/admin/types";
import { workDisplayTitleJa } from "@/lib/work-title";
import { AdminDeleteButton } from "./admin-icon-button";
import { AdminFieldLabel } from "./admin-field-label";

type Relation = Record<string, unknown>;
type Option = { id: string; name: string };

function linked(row: Relation | OccurrenceRow, key: "works" | "exhibitions") {
  const value = (row as Relation)[key];
  return Array.isArray(value) ? value[0] : value;
}
export function VenueRelations({ venue }: { venue: VenueRow }) {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [holdingSearchOpen, setHoldingSearchOpen] = useState(false);
  const [exhibitionSearchOpen, setExhibitionSearchOpen] = useState(false);
  const [workOptions, setWorkOptions] = useState<Option[]>([]);
  const [exhibitionOptions, setExhibitionOptions] = useState<Option[]>([]);
  const holdings = venue.collection_holdings || [];
  const occurrences = venue.exhibition_occurrences || [];

  async function search(entity: "works" | "exhibitions", q: string) {
    if (q.trim().length < 2) { if (entity === "works") setWorkOptions([]); else setExhibitionOptions([]); return; }
    const response = await fetch(`/api/admin/master-options?entity=${entity}&q=${encodeURIComponent(q)}`);
    const body = await response.json();
    if (!response.ok) { setMessage(body.error || "検索に失敗しました。"); return; }
    if (entity === "works") setWorkOptions(body.options); else setExhibitionOptions(body.options);
  }

  async function mutate(method: "POST" | "PATCH" | "DELETE", body: Record<string, unknown>) {
    setBusy(true); setMessage("");
    try {
      const response = await fetch(`/api/admin/venues/${venue.id}/relations`, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Relation operation failed");
      setMessage(result.message || "関連情報を更新しました。");
      window.dispatchEvent(new CustomEvent("muuzee:master-updated", { detail: { entity: "venues", id: venue.id } }));
    } catch (error) { setMessage(error instanceof Error ? error.message : "Relation operation failed"); }
    finally { setBusy(false); }
  }

  function remove(kind: "holding" | "exhibition", relationId: string, label: string) {
    if (!window.confirm(`${label}の関連を削除しますか？ 非表示とは異なりrelation rowを削除します。`)) return;
    void mutate("DELETE", { kind, relationId });
  }

  return <>
    <section className="venue-relation-section"><div className="section-heading-row"><h2>所蔵作品</h2><button type="button" className="admin-icon-button" aria-label="所蔵作品を追加" title="所蔵作品を追加" onClick={() => setHoldingSearchOpen((open) => !open)}>＋</button></div><div className="card">
      {holdings.map((row) => { const work = linked(row, "works") as Record<string, unknown> | undefined; const title = workDisplayTitleJa(work) || "タイトル未設定"; return <div className="relation-row relation-row--managed" key={row.id}><span><strong>{title}</strong><br/><small className="muted">{row.holding_type || "collection"} · {row.source || "manual"}</small></span><div className="relation-actions"><label className="visibility-toggle"><input type="checkbox" checked={row.visibility_status === "public"} disabled={busy} onChange={(event) => mutate("PATCH", { kind: "holding", relationId: row.id, visibility: event.target.checked ? "public" : "hidden" })}/><span>{row.visibility_status === "public" ? "公開" : "非表示"}</span></label><AdminDeleteButton disabled={busy} onClick={() => remove("holding", row.id, title)}/></div></div>; })}
      {!holdings.length && <p className="empty-state">所蔵作品はありません。</p>}
      {holdingSearchOpen && <div className="relation-search-panel"><div className="field"><AdminFieldLabel htmlFor="holding-search" label="Worksを検索" fieldKey="work_search"/><input id="holding-search" placeholder="作品名を2文字以上入力" onChange={(event) => search("works", event.target.value)}/></div><div className="relation-options">{workOptions.map((option) => <button type="button" className="button secondary" disabled={busy || holdings.some((row) => row.work_id === option.id)} key={option.id} onClick={() => mutate("POST", { kind: "holding", targetId: option.id })}>＋ {option.name}</button>)}</div></div>}
    </div></section>
    <section className="venue-relation-section"><div className="section-heading-row"><h2>関連展覧会</h2><button type="button" className="admin-icon-button" aria-label="関連展覧会を追加" title="関連展覧会を追加" onClick={() => setExhibitionSearchOpen((open) => !open)}>＋</button></div><div className="card">
      {occurrences.map((row) => { const exhibition = linked(row, "exhibitions") as Record<string, unknown> | undefined; const title = String(exhibition?.title || "タイトル未設定"); const visibility = row.visibility_status || "public"; return <div className="relation-row relation-row--managed" key={row.id}><span><strong>{title}</strong><br/><small className="muted">{row.start_date || "日付未設定"}{row.end_date ? ` – ${row.end_date}` : ""} · {row.relation_status || "active"}</small></span><div className="relation-actions"><label className="visibility-toggle"><input type="checkbox" checked={visibility === "public"} disabled={busy} onChange={(event) => mutate("PATCH", { kind: "exhibition", relationId: row.id, visibility: event.target.checked ? "public" : "hidden" })}/><span>{visibility === "public" ? "公開" : "非表示"}</span></label><AdminDeleteButton disabled={busy} onClick={() => remove("exhibition", row.id, title)}/></div></div>; })}
      {!occurrences.length && <p className="empty-state">関連展覧会はありません。</p>}
      {exhibitionSearchOpen && <div className="relation-search-panel"><div className="field"><AdminFieldLabel htmlFor="exhibition-search" label="Exhibitionを検索" fieldKey="exhibition_search"/><input id="exhibition-search" placeholder="展覧会名を2文字以上入力" onChange={(event) => search("exhibitions", event.target.value)}/></div><div className="relation-options">{exhibitionOptions.map((option) => <button type="button" className="button secondary" disabled={busy || occurrences.some((row) => row.exhibition_id === option.id)} key={option.id} onClick={() => mutate("POST", { kind: "exhibition", targetId: option.id })}>＋ {option.name}</button>)}</div></div>}
    </div></section>
    {message && <div className={message.includes("できません") || message.includes("失敗") ? "error" : "notice"}>{message}</div>}
  </>;
}
