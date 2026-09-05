"use client";

/* eslint-disable @next/next/no-img-element */

import { useState } from "react";

type Snapshot = {
  id: string; name: string; nameEn?: string | null; aliases?: string[]; address?: string | null;
  prefecture?: string | null; city?: string | null; latitude?: number | null; longitude?: number | null;
  officialUrl?: string | null; venueType?: string | null; qids?: string[]; relationCount?: number;
  manualFieldCount?: number; officialFieldCount?: number; approvedFieldCount?: number;
  mediaCount?: number; approvedMediaCount?: number;
};
type Candidate = {
  id: string; source_venue_id: string; candidate_venue_id: string; canonical_venue_id: string;
  confidence: number; match_category: string; match_reasons: string[]; review_status: string;
  canonical_priority_reason: string; source_snapshot: Snapshot; candidate_snapshot: Snapshot;
  distance_meters?: number | null;
  source_image?: { signed_url?: string | null; source_url?: string | null; credit?: string | null } | null;
  candidate_image?: { signed_url?: string | null; source_url?: string | null; credit?: string | null } | null;
};

function completeness(snapshot: Snapshot) {
  const checks = [snapshot.nameEn, snapshot.address, snapshot.officialUrl, snapshot.latitude != null && snapshot.longitude != null, (snapshot.mediaCount || 0) > 0];
  return `${Math.round((checks.filter(Boolean).length / checks.length) * 100)}%`;
}

function mapUrl(snapshot: Snapshot) {
  return snapshot.latitude != null && snapshot.longitude != null
    ? `https://www.google.com/maps?q=${snapshot.latitude},${snapshot.longitude}`
    : null;
}

function Comparison({ label, source, candidate }: { label: string; source: unknown; candidate: unknown }) {
  const display = (value: unknown) => Array.isArray(value) ? value.join(" / ") || "—" : String(value ?? "—") || "—";
  return <tr><th>{label}</th><td>{display(source)}</td><td>{display(candidate)}</td></tr>;
}

export function VenueCanonicalReview() {
  const [open, setOpen] = useState(false);
  const [rows, setRows] = useState<Candidate[]>([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  async function load() {
    setLoading(true); setMessage("");
    try {
      const response = await fetch("/api/admin/venues/canonicalization", { cache: "no-store" });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "候補の取得に失敗しました。");
      setRows(body.rows); setOpen(true);
    } catch (error) { setMessage(error instanceof Error ? error.message : "候補の取得に失敗しました。"); }
    finally { setLoading(false); }
  }

  async function decide(row: Candidate, action: "merge" | "separate" | "hold") {
    if (action === "merge" && !window.confirm(`「${row.source_snapshot.name}」と「${row.candidate_snapshot.name}」を同一Venueとして統合しますか？`)) return;
    setLoading(true); setMessage("");
    try {
      const response = await fetch("/api/admin/venues/canonicalization", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ candidateId: row.id, action, canonicalVenueId: row.canonical_venue_id }) });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "判断の保存に失敗しました。");
      setMessage(body.message); await load(); window.dispatchEvent(new Event("muuzee:master-updated"));
    } catch (error) { setMessage(error instanceof Error ? error.message : "判断の保存に失敗しました。"); }
    finally { setLoading(false); }
  }

  return <section className="canonical-review">
    <div className="actions"><button className="button secondary" disabled={loading} onClick={open ? () => setOpen(false) : load}>{loading ? "Loading..." : open ? "Canonical候補を閉じる" : "Canonical候補を確認"}</button></div>
    {message && <div className="notice">{message}</div>}
    {open && <div className="canonical-review-list">
      <div className="detail-status"><div><h2>Exhibition Venue Canonical Review</h2><p className="muted">名称だけでは統合しません。Source、住所、座標、画像、Relationを比較して判断してください。</p></div><span className="status">{rows.length} candidates</span></div>
      {!rows.length && <div className="card empty-state">Review待ち候補はありません。</div>}
      {rows.map((row) => <article className="card canonical-review-card" key={row.id}>
        <div className="detail-status"><div><span className={`status ${row.match_category === "HIGH" ? "approved" : "ready"}`}>{row.match_category} · {Number(row.confidence).toFixed(2)}</span><p className="muted">{row.match_reasons.join(" / ")}</p></div><span className="status">{row.review_status}</span></div>
        <div className="canonical-image-compare"><figure>{row.source_image?.signed_url ? <img src={row.source_image.signed_url} alt=""/> : <span className="canonical-image-placeholder">画像なし</span>}<figcaption>Exhibition由来</figcaption></figure><figure>{row.candidate_image?.signed_url ? <img src={row.candidate_image.signed_url} alt=""/> : <span className="canonical-image-placeholder">画像なし</span>}<figcaption>Master候補</figcaption></figure></div>
        <div className="table-wrap"><table className="canonical-comparison"><thead><tr><th>Field</th><th>Exhibition由来</th><th>Master候補</th></tr></thead><tbody>
          <Comparison label="Name" source={row.source_snapshot.name} candidate={row.candidate_snapshot.name}/><Comparison label="Name EN" source={row.source_snapshot.nameEn} candidate={row.candidate_snapshot.nameEn}/><Comparison label="Aliases" source={row.source_snapshot.aliases} candidate={row.candidate_snapshot.aliases}/><Comparison label="Type" source={row.source_snapshot.venueType} candidate={row.candidate_snapshot.venueType}/><Comparison label="Address" source={row.source_snapshot.address} candidate={row.candidate_snapshot.address}/><Comparison label="Prefecture / City" source={`${row.source_snapshot.prefecture || "—"} / ${row.source_snapshot.city || "—"}`} candidate={`${row.candidate_snapshot.prefecture || "—"} / ${row.candidate_snapshot.city || "—"}`}/><Comparison label="Coordinates" source={row.source_snapshot.latitude != null ? `${row.source_snapshot.latitude}, ${row.source_snapshot.longitude}` : "—"} candidate={row.candidate_snapshot.latitude != null ? `${row.candidate_snapshot.latitude}, ${row.candidate_snapshot.longitude}` : "—"}/>
          <tr><th>Map</th><td>{mapUrl(row.source_snapshot) ? <a href={mapUrl(row.source_snapshot)!} target="_blank" rel="noreferrer">Mapを開く</a> : "—"}</td><td>{mapUrl(row.candidate_snapshot) ? <a href={mapUrl(row.candidate_snapshot)!} target="_blank" rel="noreferrer">Mapを開く</a> : "—"}</td></tr>
          <Comparison label="Distance" source={row.distance_meters == null ? "—" : `${row.distance_meters} m`} candidate={row.distance_meters == null ? "—" : `${row.distance_meters} m`}/><Comparison label="Official URL" source={row.source_snapshot.officialUrl} candidate={row.candidate_snapshot.officialUrl}/><Comparison label="Wikidata QID" source={row.source_snapshot.qids} candidate={row.candidate_snapshot.qids}/><Comparison label="Completeness" source={completeness(row.source_snapshot)} candidate={completeness(row.candidate_snapshot)}/><Comparison label="Relations" source={row.source_snapshot.relationCount} candidate={row.candidate_snapshot.relationCount}/><Comparison label="Manual / Official fields" source={`${row.source_snapshot.manualFieldCount || 0} / ${row.source_snapshot.officialFieldCount || 0}`} candidate={`${row.candidate_snapshot.manualFieldCount || 0} / ${row.candidate_snapshot.officialFieldCount || 0}`}/><Comparison label="Approved fields / media" source={`${row.source_snapshot.approvedFieldCount || 0} / ${row.source_snapshot.approvedMediaCount || 0}`} candidate={`${row.candidate_snapshot.approvedFieldCount || 0} / ${row.candidate_snapshot.approvedMediaCount || 0}`}/>
        </tbody></table></div>
        <p className="muted">Canonical recommendation: <strong>{row.canonical_venue_id === row.source_venue_id ? row.source_snapshot.name : row.candidate_snapshot.name}</strong> — {row.canonical_priority_reason}</p>
        <div className="actions"><button className="button" disabled={loading} onClick={() => decide(row, "merge")}>同じVenueとして統合</button><button className="button secondary" disabled={loading} onClick={() => decide(row, "separate")}>別Venueとして扱う</button><button className="button secondary" disabled={loading} onClick={() => decide(row, "hold")}>判断保留</button></div>
      </article>)}
    </div>}
  </section>;
}
