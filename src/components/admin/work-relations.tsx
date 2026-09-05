"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

type Relation = Record<string, unknown>;
type Option = { id: string; name: string };

function relationName(row: Relation, key: "artists" | "venues") {
  const value = row[key]; const record = Array.isArray(value) ? value[0] : value;
  return record && typeof record === "object" ? String((record as Record<string, unknown>).name || "未設定") : "未設定";
}

export function WorkRelations({ workId, artists, holdings }: { workId: string; artists: Relation[]; holdings: Relation[] }) {
  const router = useRouter(); const [busy, setBusy] = useState(false); const [message, setMessage] = useState("");
  const [artistOptions, setArtistOptions] = useState<Option[]>([]); const [venueOptions, setVenueOptions] = useState<Option[]>([]);
  async function search(entity: "artists" | "venues", q: string) {
    const response = await fetch(`/api/admin/master-options?entity=${entity}&q=${encodeURIComponent(q)}`); const body = await response.json();
    if (!response.ok) { setMessage(body.error || "Search failed"); return; }
    if (entity === "artists") setArtistOptions(body.options); else setVenueOptions(body.options);
  }
  async function mutate(method: "POST" | "DELETE", body: Record<string, unknown>) {
    setBusy(true); setMessage("");
    try { const response = await fetch(`/api/admin/masters/works/${workId}/relations`, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }); const result = await response.json(); if (!response.ok) throw new Error(result.error || "Request failed"); setMessage(result.message); router.refresh(); window.dispatchEvent(new CustomEvent("muuzee:master-updated")); }
    catch (error) { setMessage(error instanceof Error ? error.message : "Request failed"); } finally { setBusy(false); }
  }
  return <section><h2>Relations</h2><div className="relation-grid">
    <article className="card"><h3>Artists</h3>{artists.map((row) => <div className="relation-row" key={String(row.id)}><span>{relationName(row, "artists")} <small className="muted">{String(row.role || "role未設定")}</small></span><button className="button danger" disabled={busy} onClick={() => mutate("DELETE", { kind: "artist", relationId: row.id })}>Remove</button></div>)}{!artists.length && <p className="empty-state">Artist relationはありません。</p>}<div className="field"><label>Artist search</label><input onChange={(event) => search("artists", event.target.value)} placeholder="名前で検索"/></div><div className="relation-options">{artistOptions.map((option) => <button className="button secondary" disabled={busy || artists.some((row) => String(row.artist_id) === option.id)} key={option.id} onClick={() => mutate("POST", { kind: "artist", targetId: option.id })}>+ {option.name}</button>)}</div></article>
    <article className="card"><h3>Holding Venues</h3>{holdings.map((row) => <div className="relation-row" key={String(row.id)}><span>{relationName(row, "venues")} <small className="muted">{String(row.inventory_number || "inventory未設定")}</small></span><button className="button danger" disabled={busy} onClick={() => mutate("DELETE", { kind: "holding", relationId: row.id })}>Remove</button></div>)}{!holdings.length && <p className="empty-state">Holding Venueはありません。</p>}<div className="field"><label>Venue search</label><input onChange={(event) => search("venues", event.target.value)} placeholder="会場名で検索"/></div><div className="relation-options">{venueOptions.map((option) => <button className="button secondary" disabled={busy || holdings.some((row) => String(row.venue_id) === option.id)} key={option.id} onClick={() => mutate("POST", { kind: "holding", targetId: option.id })}>+ {option.name}</button>)}</div></article>
  </div>{message && <div className="notice">{message}</div>}</section>;
}
