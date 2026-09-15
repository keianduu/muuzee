"use client";

import { useRouter } from "next/navigation";
import Image from "next/image";
import { useState } from "react";
import type { ExhibitionRow, MediaAssetRow, OccurrenceRow, VenueRow } from "@/lib/admin/types";
import type { PublicationRequirement } from "@/lib/admin/publication";

type Props = { exhibition: ExhibitionRow; occurrence: OccurrenceRow | null; venue: VenueRow | null; prompt: string; requirements: PublicationRequirement[]; canPublish: boolean };

export function ExhibitionEditor({ exhibition, occurrence, venue, prompt, requirements, canPublish }: Props) {
  const router = useRouter(); const [message, setMessage] = useState(""); const [busy, setBusy] = useState(false);
  async function request(url: string, init: RequestInit) {
    setBusy(true); setMessage("");
    try { const response = await fetch(url, init); const body = await response.json(); if (!response.ok) throw new Error(body.error || "Request failed"); setMessage(body.message || "Saved"); router.refresh(); }
    catch (error) { setMessage(error instanceof Error ? error.message : "Request failed"); }
    finally { setBusy(false); }
  }
  async function save(event: React.FormEvent<HTMLFormElement>) { event.preventDefault(); const form = new FormData(event.currentTarget); await request(`/api/admin/exhibitions/${exhibition.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(Object.fromEntries(form)) }); }
  async function upload(event: React.FormEvent<HTMLFormElement>) { event.preventDefault(); await request(`/api/admin/exhibitions/${exhibition.id}/media`, { method: "POST", body: new FormData(event.currentTarget) }); }
  async function publication(action: string) { await request(`/api/admin/exhibitions/${exhibition.id}/publication`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action }) }); }
  async function remove(asset: MediaAssetRow) { if (!window.confirm(`${asset.original_filename || "画像"}を削除しますか？`)) return; await request(`/api/admin/exhibitions/${exhibition.id}/media/${asset.id}`, { method: "DELETE" }); }
  return <>
    <section className="card">
      <h2>Publication requirements</h2>
      <ul className="requirements">{requirements.map((item) => <li key={item.key} className={item.met ? "met" : ""}>{item.met ? "✓" : "×"} {item.label}</li>)}</ul>
      <div className="actions"><button className="button secondary" disabled={busy || !canPublish} onClick={() => publication("ready")}>Readyにする</button><button className="button" disabled={busy || !canPublish} onClick={() => publication("publish")}>Publish</button>{exhibition.publication_status === "published" && <button className="button secondary" disabled={busy} onClick={() => publication("unpublish")}>Unpublish</button>}</div>
    </section>
    <form className="card" onSubmit={save}>
      <h2>Basic information</h2><div className="form-grid">
        <div className="field full"><label>Title</label><input name="title" required defaultValue={exhibition.title} /></div>
        <div className="field"><label>English title</label><input name="title_en" defaultValue={exhibition.title_en || ""} /></div>
        <div className="field"><label>Exhibition type</label><input name="exhibition_type" defaultValue={exhibition.exhibition_type || ""} /></div>
        <div className="field full"><label>Description</label><textarea name="description" defaultValue={exhibition.description || ""} /></div>
        <div className="field full"><label>Official URL</label><input name="official_url" type="url" defaultValue={exhibition.official_url || ""} /></div>
        <div className="field"><label>Venue</label><input name="venue_name" required defaultValue={venue?.name || ""} /></div>
        <div className="field"><label>Address</label><input name="venue_address" defaultValue={venue?.address || ""} /></div>
        <div className="field"><label>Start date</label><input name="start_date" type="date" defaultValue={occurrence?.start_date || ""} /></div>
        <div className="field"><label>End date</label><input name="end_date" type="date" defaultValue={occurrence?.end_date || ""} /></div>
        <div className="field"><label>Opening hours</label><textarea name="opening_hours_text" defaultValue={occurrence?.opening_hours_text || ""} /></div>
        <div className="field"><label>Closed days</label><textarea name="closed_days_text" defaultValue={occurrence?.closed_days_text || ""} /></div>
        <div className="field full"><label>Ticket URL</label><input name="ticket_url" type="url" defaultValue={occurrence?.ticket_url || ""} /></div>
      </div><div className="actions"><button className="button" disabled={busy}>Save</button></div>
    </form>
    <section className="card"><h2>Image research</h2><p className="muted">外部検索は自動実行しません。下記Promptをコピーし、人が候補と利用条件を確認してください。</p><textarea readOnly value={prompt} style={{minHeight: 300}}/><div className="actions"><button className="button secondary" onClick={() => navigator.clipboard.writeText(prompt).then(() => setMessage("Promptをコピーしました"))}>Copy prompt</button></div></section>
    <form className="card" onSubmit={upload}><h2>Upload image & rights metadata</h2><div className="form-grid">
      <div className="field full"><label>Image (JPEG / PNG / WebP / GIF, max 20 MB)</label><input name="file" type="file" accept="image/jpeg,image/png,image/webp,image/gif" required /></div>
      <div className="field"><label>Source type</label><select name="source_type" required defaultValue="official_press"><option value="artpr">ARTPR</option><option value="official_press">Official press</option><option value="organizer_press">Organizer press</option><option value="open_collection">Open collection</option><option value="wikimedia">Wikimedia</option><option value="direct">Direct permission</option><option value="other">Other</option></select></div>
      <div className="field"><label>Rights classification</label><select name="rights_status" required defaultValue="needs_review"><option value="rejected">明確に再配布NG</option><option value="needs_review">表記がなく判断不能</option><option value="approved">配布OKの明示あり</option></select></div>
      <div className="field full"><label>Source URL（任意）</label><input name="source_url" type="url" /></div>
      <div className="field"><label>Credit（任意）</label><input name="credit" /></div><div className="field"><label>Valid until</label><input name="valid_until" type="date" /></div>
      <div className="field full"><label>Usage note / judgment evidence（任意）</label><textarea name="usage_note" /></div>
      <label><input name="is_primary" type="checkbox" value="true" style={{width:"auto"}} /> Primary image</label>
    </div><div className="actions"><button className="button" disabled={busy}>Upload</button></div></form>
    <section><h2>Media assets</h2><div className="media-grid">{(exhibition.media_assets || []).map((asset) => <article className="card media-card" key={asset.id}>{asset.signedUrl ? <Image src={asset.signedUrl} alt="" width={640} height={400} unoptimized/> : <div className="thumb"/>}<p><strong>{asset.original_filename}</strong><br/><span className={`status ${asset.rights_status}`}>{asset.rights_status}</span>{asset.is_primary && <> <span className="status">primary</span></>}</p><p className="muted">{asset.credit || "No credit"}<br/>{asset.source_url || "No source URL"}</p><button className="button danger" disabled={busy} onClick={() => remove(asset)}>Delete</button></article>)}</div>{!exhibition.media_assets?.length && <p className="muted">画像は未登録です。</p>}</section>
    {message && <div className={message.toLowerCase().includes("fail") || message.includes("必要") ? "error" : "notice"}>{message}</div>}
  </>;
}
