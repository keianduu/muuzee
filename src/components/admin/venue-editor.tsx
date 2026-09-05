"use client";

/* eslint-disable @next/next/no-img-element */

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useState } from "react";
import type { MediaAssetRow, SourceImageCandidateRow, VenueMatchCandidateRow, VenueRow } from "@/lib/admin/types";
import { interpretCommonsLicense } from "@/lib/wikimedia-commons/license-profile";
import { displayStatus } from "@/lib/admin/master-labels";

function LicenseSummary({ candidate }: { candidate: SourceImageCandidateRow }) {
  const profile = interpretCommonsLicense(candidate.license_short_name);
  return <div className="license-summary" aria-label="ライセンス条件の整理">
    <span>ライセンス</span><strong>{profile.license}</strong><span>利用可否</span><strong>{profile.usage}</strong>
    <span>商用利用</span><strong>{profile.commercialUse}</strong><span>加工・トリミング</span><strong>{profile.modification}</strong>
    <span>クレジット表記</span><strong>{profile.attribution}</strong><span>同一ライセンス継承</span><strong>{profile.shareAlike}</strong>
    {!profile.recognized && <><span>判定</span><strong>ライセンス原文を要確認</strong></>}
  </div>;
}

function Trace({ title, rows }: { title: string; rows: Array<Record<string, unknown>> }) {
  return <div className="card"><h3>{title}</h3>{rows.length ? <div className="table-wrap"><table><thead><tr><th>Threshold / QID</th><th>Eligible</th><th>Coordinates</th><th>P18</th><th>Selected</th></tr></thead><tbody>{rows.map((row, index) => <tr key={`${title}-${index}`}>
    <td>{`${String(row.threshold ?? "-")} / ${String(row.qid ?? "-")}`}</td><td>{String(row.eligibleCount ?? "-")}</td><td>{String(row.coordinatesPresent ?? "-")}</td><td>{String(row.availableCount ?? "-")}</td><td>{String(row.selected ?? row.result ?? "-")}</td>
  </tr>)}</tbody></table></div> : <p className="muted">探索履歴はまだありません。</p>}</div>;
}

export function VenueEditor({ venue, prompt, showBasicForm = true, view = "all" }: { venue: VenueRow; prompt: string; showBasicForm?: boolean; view?: "all" | "status" | "edit" | "data" }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  async function request(url: string, init: RequestInit) {
    setBusy(true); setMessage("");
    try {
      const response = await fetch(url, init); const body = await response.json();
      if (!response.ok) throw new Error(body.error || "Request failed");
      setMessage(body.message || JSON.stringify(body)); router.refresh(); window.dispatchEvent(new CustomEvent("muuzee:master-updated"));
    } catch (error) { setMessage(error instanceof Error ? error.message : "Request failed"); } finally { setBusy(false); }
  }
  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); const form = new FormData(event.currentTarget);
    await request(`/api/admin/venues/${venue.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(Object.fromEntries(form)) });
  }
  async function enrich() { await request(`/api/admin/venues/${venue.id}/enrich`, { method: "POST" }); }
  async function match(candidate: VenueMatchCandidateRow, action: "adopt" | "reject" | "create_new") {
    await request(`/api/admin/venues/${venue.id}/matches/${candidate.id}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action }) });
  }
  async function decideCoordinate(action: "adopt" | "reject") {
    await request(`/api/admin/venues/${venue.id}/coordinate-candidate`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action }) });
  }
  async function review(candidate: SourceImageCandidateRow, updates: { review_status?: "accepted" | "rejected"; rights_status?: "rejected" | "needs_review" | "approved" }) {
    await request(`/api/admin/venues/${venue.id}/image-candidates/${candidate.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(updates) });
  }
  async function upload(event: React.FormEvent<HTMLFormElement>) { event.preventDefault(); await request(`/api/admin/venues/${venue.id}/media`, { method: "POST", body: new FormData(event.currentTarget) }); }
  async function remove(asset: MediaAssetRow) {
    if (!window.confirm(`${asset.original_filename || "画像"}を削除しますか？`)) return;
    await request(`/api/admin/venues/${venue.id}/media/${asset.id}`, { method: "DELETE" });
  }

  const candidates = (venue.venue_external_match_candidates || []).sort((a, b) => b.confidence - a.confidence);
  const matchedWikidataId = candidates.find((candidate) => candidate.status === "matched")?.external_id || null;
  const imageCandidates = (venue.source_records || []).flatMap((source) => source.source_image_candidates || []);
  const activeImageCandidates = imageCandidates.filter((candidate) => candidate.is_active);
  const showResearchPrompt = activeImageCandidates.length === 0 || activeImageCandidates.every((candidate) => candidate.review_status === "rejected");
  const mapCoordinates = venue.coordinate_candidate_latitude != null && venue.coordinate_candidate_longitude != null
    ? [venue.coordinate_candidate_latitude, venue.coordinate_candidate_longitude]
    : venue.latitude != null && venue.longitude != null ? [venue.latitude, venue.longitude] : null;
  const googleMapsUrl = mapCoordinates ? `https://www.google.com/maps?q=${mapCoordinates[0]},${mapCoordinates[1]}` : null;

  return <>
    {(view === "all" || view === "data") && <div className="actions"><button className="button secondary" disabled={busy} onClick={enrich}>Enrich（外部データで補完）</button></div>}
    {showBasicForm && (view === "all" || view === "edit") && <form className="card" onSubmit={save}>
      <h2>基本情報</h2><div className="form-grid">
        <div className="field"><label>Name</label><input name="name" required defaultValue={venue.name}/></div><div className="field"><label>English name</label><input name="name_en" defaultValue={venue.name_en || ""}/></div>
        <div className="field"><label>Venue type</label><select name="venue_type" defaultValue={venue.venue_type}><option value="museum">museum</option><option value="gallery">gallery</option><option value="art_space">art_space</option><option value="commercial_space">commercial_space</option><option value="other">other</option></select></div>
        <div className="field"><label>Postal code</label><input name="postal_code" defaultValue={venue.postal_code || ""}/></div><div className="field"><label>Prefecture</label><input name="prefecture" defaultValue={venue.prefecture || ""}/></div><div className="field"><label>City</label><input name="city" defaultValue={venue.city || ""}/></div>
        <div className="field full"><label>Address</label><input name="address" defaultValue={venue.address || ""}/></div><div className="field full"><label>Official URL</label><input type="url" name="official_url" defaultValue={venue.official_url || ""}/></div>
      </div>
      <h2>Current coordinates</h2><p><span className={`status ${["approved", "manual"].includes(venue.coordinate_status) ? "approved" : ""}`}>{venue.coordinate_status}</span></p>
      <div className="form-grid"><div className="field"><label>Latitude</label><input type="number" step="any" name="latitude" defaultValue={venue.latitude ?? ""}/></div><div className="field"><label>Longitude</label><input type="number" step="any" name="longitude" defaultValue={venue.longitude ?? ""}/></div><div className="field"><label>Coordinate source</label><input readOnly value={venue.coordinate_source || "Missing"}/></div><div className="field"><label>Precision</label><input readOnly value={venue.coordinate_precision || "-"}/></div></div>
      <div className="actions"><button className="button" disabled={busy}>Save（座標入力はManual扱い）</button></div>
    </form>}

    {(view === "all" || view === "status") && <section className="card admin-state-summary"><h2>Coordinate Status（座標状態）</h2>
      <p><span className={`status ${venue.coordinate_status}`}>{displayStatus(venue.coordinate_status)}</span></p>
      <dl><div><dt>Current（現行）</dt><dd>{venue.latitude != null && venue.longitude != null ? `${venue.latitude}, ${venue.longitude}` : "未設定"}</dd></div><div><dt>Candidate（候補）</dt><dd>{venue.coordinate_candidate_latitude != null && venue.coordinate_candidate_longitude != null ? `${venue.coordinate_candidate_latitude}, ${venue.coordinate_candidate_longitude}` : "候補なし"}</dd></div><div><dt>Match Confidence（照合信頼度）</dt><dd>{venue.coordinate_candidate_confidence ?? venue.wikidata_match_confidence ?? "未設定"}</dd></div></dl>
      {googleMapsUrl && <a className="button secondary" href={googleMapsUrl} target="_blank" rel="noreferrer">Google Mapsで確認 ↗</a>}
      <h2>Image Status（画像状態）</h2><p>Approved / Uploaded: {(venue.media_assets || []).length}件 · Candidate: {activeImageCandidates.length}件</p>
      <h2>API Match Status（API照合状態）</h2><p><span className={`status ${venue.wikidata_match_status}`}>{displayStatus(venue.wikidata_match_status)}</span> · {venue.best_wikidata_candidate_qid || "QID未設定"}</p>
    </section>}

    {(view === "all" || view === "edit") && <section><h2>Coordinate Candidate（座標候補）</h2>
      {venue.coordinate_candidate_latitude != null && venue.coordinate_candidate_longitude != null ? <article className="card">
        <p><span className="status">{venue.coordinate_status}</span> <strong>{venue.coordinate_candidate_source}</strong></p>
        <div className="license-summary"><span>QID</span><strong>{venue.coordinate_candidate_qid || "-"}</strong><span>Latitude（緯度）</span><strong>{venue.coordinate_candidate_latitude}</strong><span>Longitude（経度）</span><strong>{venue.coordinate_candidate_longitude}</strong><span>Confidence（信頼度）</span><strong>{venue.coordinate_candidate_confidence ?? "-"}</strong><span>Found Threshold（発見時閾値）</span><strong>{venue.coordinate_candidate_threshold ?? "-"}</strong><span>Geoloniaとの距離</span><strong>{venue.coordinate_candidate_distance_m != null ? `${Math.round(venue.coordinate_candidate_distance_m)} m` : "比較なし"}</strong></div>
        <p className="muted">{venue.coordinate_candidate_reason || "理由なし"}</p>
        {venue.geolonia_candidate_latitude != null && <p className="muted">Geolonia候補: {venue.geolonia_candidate_latitude}, {venue.geolonia_candidate_longitude} / {venue.geolonia_candidate_precision || "-"}</p>}
        <div className="actions">{googleMapsUrl && <a className="button secondary" href={googleMapsUrl} target="_blank" rel="noreferrer">Google Mapsで確認 ↗</a>}<button className="button" disabled={busy || venue.coordinate_status === "approved"} onClick={() => decideCoordinate("adopt")}>座標Candidateを採用</button><button className="button danger" disabled={busy} onClick={() => decideCoordinate("reject")}>座標Candidateを却下</button></div>
      </article> : <p className="muted">閾値内に座標を持つ候補はありません。</p>}
    </section>}

    {(view === "all" || view === "data") && <section><h2>Wikidata Entity Match（エンティティ照合）</h2><p className="muted">Current: {matchedWikidataId || "未採用"} / {displayStatus(venue.wikidata_match_status)} / {venue.wikidata_match_confidence ?? "-"}<br/>{venue.wikidata_match_reason || "-"}</p>
      <div className="media-grid">{candidates.map((candidate) => { const importerCandidate = Boolean((candidate.raw_payload as { normalized?: unknown } | undefined)?.normalized); return <article className="card" key={candidate.id}><strong>{candidate.label_ja || candidate.label_en || candidate.external_id}</strong><p><span className={`status ${candidate.status}`}>{candidate.status}</span></p><p className="muted">{candidate.external_id} · Confidence {candidate.confidence}<br/>{candidate.description || "-"}<br/>{candidate.match_reasons.join(" / ")}</p><div className="license-summary"><span>Name EN</span><strong>{candidate.label_en || "なし"}</strong><span>Address</span><strong>{String((candidate.raw_payload as { normalized?: { address?: string } } | undefined)?.normalized?.address || "Source rawを確認")}</strong><span>座標</span><strong>{candidate.latitude != null && candidate.longitude != null ? `${candidate.latitude}, ${candidate.longitude}` : "なし"}</strong><span>P18</span><strong>{candidate.image_file_title || "なし"}</strong><span>Official URL</span><strong>{candidate.official_url || "なし"}</strong></div><div className="actions"><button className="button" disabled={busy || candidate.status === "matched"} onClick={() => match(candidate, "adopt")}>同じVenue → Link</button>{importerCandidate && <button className="button secondary" disabled={busy || candidate.status === "matched"} onClick={() => match(candidate, "create_new")}>別Venue → Create New</button>}<button className="button danger" disabled={busy} onClick={() => match(candidate, "reject")}>Ignore</button></div></article>; })}</div>
      {!candidates.length && <p className="muted">Entity候補はありません。</p>}
    </section>}

    {(view === "all" || view === "edit") && <section><h2>Image Candidate（画像候補）</h2><p className="muted">Entity採用前でもP18を参考候補として保持します。候補保持、ライセンス判断、Primary採用は別操作で、自動公開はしません。</p>
      <div className="media-grid">{imageCandidates.map((candidate) => <article className="card media-card" key={candidate.id}>
        <img src={candidate.thumbnail_url || candidate.image_url} alt="Venue image candidate"/>
        <p><span className="status">{candidate.review_status}</span> <span className={`status ${candidate.rights_status}`}>{candidate.rights_status === "approved" ? "明確に利用可能" : candidate.rights_status === "rejected" ? "明確に不可" : "記載なし・不明"}</span></p>
        <p><strong>{candidate.candidate_entity_label || "Wikidata候補"}</strong><br/><span className="muted">{candidate.candidate_entity_id || "-"} · Match {candidate.candidate_match_confidence ?? "-"} · Found threshold {candidate.candidate_match_threshold ?? "-"} · {candidate.candidate_kind}</span></p>
        <LicenseSummary candidate={candidate}/>
        <details><summary>Reported license / source metadata</summary><p className="muted"><strong>Author:</strong> {candidate.author || "記載なし"}<br/><strong>Credit:</strong> {candidate.credit || "記載なし"}<br/><strong>Usage terms:</strong> {candidate.usage_terms || "記載なし"}</p></details>
        <div className="actions"><a className="button secondary" href={candidate.source_url || candidate.image_url} target="_blank" rel="noreferrer">Commons / Source</a>{candidate.license_url && <a className="button secondary" href={candidate.license_url} target="_blank" rel="noreferrer">License原文</a>}</div>
        <h3>画像候補の判断</h3><div className="actions"><button className="button secondary" disabled={busy} onClick={() => review(candidate, { review_status: "accepted" })}>候補として残す</button><button className="button danger" disabled={busy} onClick={() => review(candidate, { review_status: "rejected" })}>候補から除外</button></div>
        <h3>ライセンス判断</h3><div className="actions"><button className="button danger" disabled={busy} onClick={() => review(candidate, { rights_status: "rejected" })}>明確に不可</button><button className="button secondary" disabled={busy} onClick={() => review(candidate, { rights_status: "needs_review" })}>記載なし・不明</button><button className="button" disabled={busy} onClick={() => review(candidate, { rights_status: "approved" })}>明確に利用可能</button></div>
      </article>)}</div>{!imageCandidates.length && <p className="muted">画像候補はありません。</p>}
    </section>}

    {(view === "all" || view === "data") && <section><h2>Search Diagnostics（検索診断）</h2><div className="media-grid"><Trace title="Coordinate Search（座標探索）" rows={venue.coordinate_search_trace || []}/><Trace title={`Image Search（画像探索） / ${venue.image_search_status}`} rows={venue.image_search_trace || []}/></div></section>}

    {showResearchPrompt && (view === "all" || view === "data") && <section className="card"><h2>施設画像調査</h2><p className="muted">自動候補がない、または全候補が却下された場合にのみ使用します。</p><textarea readOnly value={prompt} style={{ minHeight: 300 }}/><div className="actions"><button className="button secondary" onClick={() => navigator.clipboard.writeText(prompt).then(() => setMessage("Promptをコピーしました"))}>施設画像調査Promptをコピー</button></div></section>}

    {(view === "all" || view === "edit") && <form className="card" onSubmit={upload}><h2>Upload Image & Rights（画像・権利情報）</h2><div className="form-grid">
      <div className="field full"><label>Image</label><input name="file" type="file" accept="image/jpeg,image/png,image/webp,image/gif" required/></div>
      <div className="field"><label>Source type</label><select name="source_type" required defaultValue="wikimedia"><option value="official_press">Official press</option><option value="open_collection">Open collection</option><option value="wikimedia">Wikimedia</option><option value="direct">Direct permission</option><option value="other">Other</option></select></div>
      <div className="field"><label>Rights classification</label><select name="rights_status" required defaultValue="needs_review"><option value="rejected">明確に不可</option><option value="needs_review">記載なし・不明</option><option value="approved">明確に利用可能</option></select></div>
      <div className="field full"><label>Source URL（任意）</label><input name="source_url" type="url"/></div><div className="field"><label>Credit（任意）</label><input name="credit"/></div><div className="field"><label>Valid until</label><input name="valid_until" type="date"/></div><div className="field full"><label>Usage note（任意）</label><textarea name="usage_note"/></div><label><input name="is_primary" type="checkbox" value="true" style={{ width: "auto" }}/> Primary image</label>
    </div><div className="actions"><button className="button" disabled={busy}>Upload（アップロード）</button></div></form>}

    {(view === "all" || view === "edit") && <section><h2>Approved / Uploaded Images（登録画像）</h2><div className="media-grid">{(venue.media_assets || []).map((asset) => <article className="card media-card" key={asset.id}>{asset.signedUrl ? <Image src={asset.signedUrl} alt="" width={640} height={400} unoptimized/> : <div className="thumb"/>}<p><strong>{asset.original_filename}</strong><br/><span className={`status ${asset.rights_status}`}>{displayStatus(asset.rights_status)}</span>{asset.is_primary && <> <span className="status">Primary（メイン）</span></>}</p><button className="button danger" disabled={busy} onClick={() => remove(asset)}>Delete（削除）</button></article>)}</div></section>}
    {message && <div className={message.toLowerCase().includes("fail") || message.includes("必須") ? "error" : "notice"}>{message}</div>}
  </>;
}
