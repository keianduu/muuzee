"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useState } from "react";
import type { MediaAssetRow, SourceImageCandidateRow, VenueMatchCandidateRow, VenueRow } from "@/lib/admin/types";
import { displayStatus } from "@/lib/admin/master-labels";
import { MasterImageCandidateCard } from "./master-image-candidate";


function Trace({ title, rows }: { title: string; rows: Array<Record<string, unknown>> }) {
  return <div className="card"><h3>{title}</h3>{rows.length ? <div className="table-wrap"><table><thead><tr><th>Threshold / QID</th><th>Eligible</th><th>Coordinates</th><th>P18</th><th>Selected</th></tr></thead><tbody>{rows.map((row, index) => <tr key={`${title}-${index}`}>
    <td>{`${String(row.threshold ?? "-")} / ${String(row.qid ?? "-")}`}</td><td>{String(row.eligibleCount ?? "-")}</td><td>{String(row.coordinatesPresent ?? "-")}</td><td>{String(row.availableCount ?? "-")}</td><td>{String(row.selected ?? row.result ?? "-")}</td>
  </tr>)}</tbody></table></div> : <p className="muted">探索履歴はまだありません。</p>}</div>;
}

export function VenueEditor({ venue, prompt, showBasicForm = true, view = "all" }: { venue: VenueRow; prompt: string; showBasicForm?: boolean; view?: "all" | "status" | "edit" | "data" }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  async function request(url: string, init: RequestInit, options: { preserveListOrder?: boolean } = {}) {
    setBusy(true); setMessage("");
    try {
      const response = await fetch(url, init); const body = await response.json();
      if (!response.ok) throw new Error(body.error || "Request failed");
      setMessage(body.message || JSON.stringify(body));
      // The drawer refreshes itself (and its list row) through this event. A
      // router refresh would remount the drawer between the save and refetch,
      // briefly discarding the selected venue and could leave it blank when a
      // development chunk was being rebuilt. Standalone detail pages still
      // need the server-component refresh.
      if (showBasicForm) router.refresh();
      window.dispatchEvent(new CustomEvent("muuzee:master-updated", {
        detail: { entity: "venues", id: venue.id, preserveListOrder: Boolean(options.preserveListOrder) },
      }));
    } catch (error) { setMessage(error instanceof Error ? error.message : "Request failed"); } finally { setBusy(false); }
  }
  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); const form = new FormData(event.currentTarget);
    await request(`/api/admin/venues/${venue.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(Object.fromEntries(form)) });
  }
  async function enrich() { await request(`/api/admin/venues/${venue.id}/enrich`, { method: "POST" }); }
  async function selectSourceCandidate(candidate: VenueMatchCandidateRow) {
    await request(`/api/admin/venues/${venue.id}/matches/${candidate.id}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "select" }) });
  }
  async function review(candidate: SourceImageCandidateRow, updates: { review_status?: "accepted" | "rejected"; rights_status?: "rejected" | "needs_review" | "approved" }) {
    await request(`/api/admin/venues/${venue.id}/image-candidates/${candidate.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(updates) });
  }
  async function setPrimaryImage(candidate: SourceImageCandidateRow) {
    await request(`/api/admin/venues/${venue.id}/image-candidates/${candidate.id}/set-primary`, { method: "POST" }, { preserveListOrder: true });
  }
  async function upload(event: React.FormEvent<HTMLFormElement>) { event.preventDefault(); await request(`/api/admin/venues/${venue.id}/media`, { method: "POST", body: new FormData(event.currentTarget) }); }
  async function remove(asset: MediaAssetRow) {
    if (!window.confirm(`${asset.original_filename || "画像"}を削除しますか？`)) return;
    await request(`/api/admin/venues/${venue.id}/media/${asset.id}`, { method: "DELETE" });
  }

  const candidates = (venue.venue_external_match_candidates || []).sort((a, b) => b.confidence - a.confidence);
  const linkedWikidataSource = (venue.source_records || []).find((source) => (Array.isArray(source.data_sources) ? source.data_sources : source.data_sources ? [source.data_sources] : []).some((item) => item.key === "wikidata"));
  const matchedWikidataId = linkedWikidataSource?.external_id || candidates.find((candidate) => candidate.status === "matched")?.external_id || null;
  const unresolvedCandidates = candidates.filter((candidate) => candidate.status === "candidate");
  const requiresSourceSelection = !matchedWikidataId && unresolvedCandidates.length > 1;
  const imageCandidates = (venue.source_records || []).flatMap((source) => source.source_image_candidates || []);
  const activeImageCandidates = imageCandidates.filter((candidate) => candidate.is_active);
  const showResearchPrompt = activeImageCandidates.length === 0 || activeImageCandidates.every((candidate) => candidate.review_status === "rejected");
  const mapCoordinates = venue.coordinate_candidate_latitude != null && venue.coordinate_candidate_longitude != null
    ? [venue.coordinate_candidate_latitude, venue.coordinate_candidate_longitude]
    : venue.latitude != null && venue.longitude != null ? [venue.latitude, venue.longitude] : null;
  const googleMapsUrl = mapCoordinates ? `https://www.google.com/maps?q=${mapCoordinates[0]},${mapCoordinates[1]}` : null;
  const officialCrawls = [...(venue.official_venue_crawl_results || [])].sort((a, b) => b.crawled_at.localeCompare(a.crawled_at));
  const latestOfficialCrawl = officialCrawls[0];
  const aiSources = (venue.venue_field_sources || []).filter((source) => source.generated_by_ai).sort((a, b) => b.created_at.localeCompare(a.created_at));
  const wikipediaAddressSource = (venue.venue_field_sources || []).find((source) => source.field_name === "address" && source.source === "wikipedia" && source.is_current);
  const wikipediaSourceRecord = wikipediaAddressSource?.source_record_id ? (venue.source_records || []).find((source) => source.id === wikipediaAddressSource.source_record_id) : null;
  const wikipediaPayload = wikipediaSourceRecord?.raw_payload as { title?: string; pageId?: number; language?: string; qid?: string } | null | undefined;
  const sourceBMissing = ["address", "postal_code", "opening_hours_text", "closed_days_text", "access_text", "description"].filter((field) => !String(venue[field as keyof VenueRow] || "").trim());

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
      <h2>Official Website Status（Source B）</h2><p>{latestOfficialCrawl ? <><span className="status">{latestOfficialCrawl.crawl_status}</span> · Latest {new Date(latestOfficialCrawl.crawled_at).toLocaleString("ja-JP")}</> : "未Crawl"}</p><p className="muted">Source B不足Field: {sourceBMissing.join(" / ") || "なし"}</p>
    </section>}

    {(view === "all" || view === "data") && <section><h2>Coordinate Source Diagnostics（座標出典診断）</h2>
      {venue.coordinate_candidate_latitude != null && venue.coordinate_candidate_longitude != null ? <article className="card">
        <p><span className="status">{venue.coordinate_status}</span> <strong>{venue.coordinate_candidate_source}</strong></p>
        <div className="license-summary"><span>QID</span><strong>{venue.coordinate_candidate_qid || "-"}</strong><span>Latitude（緯度）</span><strong>{venue.coordinate_candidate_latitude}</strong><span>Longitude（経度）</span><strong>{venue.coordinate_candidate_longitude}</strong><span>Confidence（信頼度）</span><strong>{venue.coordinate_candidate_confidence ?? "-"}</strong><span>Found Threshold（発見時閾値）</span><strong>{venue.coordinate_candidate_threshold ?? "-"}</strong><span>Geoloniaとの距離</span><strong>{venue.coordinate_candidate_distance_m != null ? `${Math.round(venue.coordinate_candidate_distance_m)} m` : "比較なし"}</strong></div>
        <p className="muted">{venue.coordinate_candidate_reason || "理由なし"}</p>
        {venue.geolonia_candidate_latitude != null && <p className="muted">Geolonia候補: {venue.geolonia_candidate_latitude}, {venue.geolonia_candidate_longitude} / {venue.geolonia_candidate_precision || "-"}</p>}
        <div className="actions">{googleMapsUrl && <a className="button secondary" href={googleMapsUrl} target="_blank" rel="noreferrer">Google Mapsで確認 ↗</a>}</div>
      </article> : <p className="muted">閾値内に座標を持つ候補はありません。</p>}
    </section>}

    {(view === "all" || view === "data") && <section><h2>Wikidata Source Identity（Source識別子）</h2><p className="muted">Current: {matchedWikidataId || "未設定"} / {displayStatus(venue.wikidata_match_status)} / Confidence {venue.wikidata_match_confidence ?? "-"}<br/>{venue.wikidata_match_reason || "-"}</p>
      {requiresSourceSelection && <div className="notice"><strong>Source Candidate Selectionが必要です。</strong> 複数候補から同一施設を1件選択してください。Field単位の採用判断は不要です。</div>}
      <div className="media-grid">{candidates.map((candidate) => <article className="card" key={candidate.id}><strong>{candidate.label_ja || candidate.label_en || candidate.external_id}</strong><p><span className={`status ${candidate.status}`}>{candidate.status}</span></p><p className="muted">{candidate.external_id} · Confidence {candidate.confidence}<br/>{candidate.description || "-"}<br/>{candidate.match_reasons.join(" / ")}</p><div className="license-summary"><span>Name EN</span><strong>{candidate.label_en || "なし"}</strong><span>Address</span><strong>{String((candidate.raw_payload as { normalized?: { address?: string } } | undefined)?.normalized?.address || "Source rawを確認")}</strong><span>座標</span><strong>{candidate.latitude != null && candidate.longitude != null ? `${candidate.latitude}, ${candidate.longitude}` : "なし"}</strong><span>P18</span><strong>{candidate.image_file_title || "なし"}</strong><span>Official URL</span><strong>{candidate.official_url || "なし"}</strong></div>{requiresSourceSelection && candidate.status === "candidate" && <div className="actions"><button className="button" disabled={busy} onClick={() => selectSourceCandidate(candidate)}>このSource Candidateを選択</button></div>}</article>)}</div>
      {!candidates.length && <p className="muted">Entity候補はありません。</p>}
    </section>}

    {(view === "all" || view === "data") && wikipediaAddressSource && <section className="card"><h2>Wikipedia Address Source</h2><div className="license-summary"><span>Address Source</span><strong>Wikipedia</strong><span>Wikipedia</span><strong>{wikipediaPayload?.title || "記事タイトル未取得"}</strong><span>QID / Page ID</span><strong>{wikipediaPayload?.qid || matchedWikidataId || "-"} / {wikipediaPayload?.pageId ?? "-"}</strong><span>Applied</span><strong>{new Date(wikipediaAddressSource.created_at).toLocaleString("ja-JP")}</strong></div>{wikipediaAddressSource.source_url && <a className="button secondary" href={wikipediaAddressSource.source_url} target="_blank" rel="noreferrer">Source URL ↗</a>}</section>}

    {(view === "all" || view === "edit") && <section><h2>Image Candidate（画像候補）</h2><p className="muted">Entity採用前でもP18を参考候補として保持します。候補保持、ライセンス判断、Primary採用は別操作で、自動公開はしません。</p>
      <div className="media-grid">{imageCandidates.map((candidate) => <MasterImageCandidateCard key={candidate.id} candidate={candidate} subjectLabel={venue.name} busy={busy} onSetPrimary={() => setPrimaryImage(candidate)} onAccept={() => review(candidate, { review_status: "accepted" })} onReject={() => review(candidate, { review_status: "rejected" })}/>)}</div>{!imageCandidates.length && <p className="muted">画像候補はありません。</p>}
    </section>}

    {(view === "all" || view === "data") && <section><h2>Search Diagnostics（検索診断）</h2><div className="media-grid"><Trace title="Coordinate Search（座標探索）" rows={venue.coordinate_search_trace || []}/><Trace title={`Image Search（画像探索） / ${venue.image_search_status}`} rows={venue.image_search_trace || []}/></div></section>}

    {(view === "all" || view === "data") && <section><h2>Official Website Crawl + AI Enrichment（Source B）</h2>{latestOfficialCrawl ? <div className="card"><p><strong>Latest crawl:</strong> {new Date(latestOfficialCrawl.crawled_at).toLocaleString("ja-JP")} · <span className="status">{latestOfficialCrawl.crawl_status}</span></p><p>{latestOfficialCrawl.crawl_source_url ? <a href={latestOfficialCrawl.crawl_source_url} target="_blank" rel="noreferrer">Crawl source ↗</a> : "Source URLなし"}</p><div className="table-wrap"><table><thead><tr><th>Field</th><th>Extracted value</th><th>Source</th></tr></thead><tbody>{Object.entries(latestOfficialCrawl.extracted_values || {}).map(([field, value]) => <tr key={field}><td>{field}</td><td>{String(value || "—")}</td><td>{latestOfficialCrawl.field_source_urls?.[field] ? <a href={latestOfficialCrawl.field_source_urls[field]} target="_blank" rel="noreferrer">Open ↗</a> : "—"}</td></tr>)}</tbody></table></div>{latestOfficialCrawl.description_source_text && <details><summary>Description source text</summary><p>{latestOfficialCrawl.description_source_text}</p></details>}{latestOfficialCrawl.notes && <p className="muted">{latestOfficialCrawl.notes}</p>}<details><summary>Recent crawl history（{officialCrawls.length}件）</summary><ul>{officialCrawls.slice(0, 10).map((crawl) => <li key={crawl.id}>{new Date(crawl.crawled_at).toLocaleString("ja-JP")} · {crawl.crawl_status}</li>)}</ul></details></div> : <p className="muted">公式サイトCrawl履歴はありません。一覧の「公式サイト情報取得」から実行できます。</p>}
      <div className="card"><h3>AI Enrichment</h3><p><strong>AI structured:</strong> {aiSources.length ? "Yes" : "No"}</p>{aiSources.length ? <div className="table-wrap"><table><thead><tr><th>Field</th><th>Source</th><th>Confidence</th><th>Date</th><th>Notes</th></tr></thead><tbody>{aiSources.map((source) => <tr key={source.id}><td>{source.field_name}</td><td>{source.source_url ? <a href={source.source_url} target="_blank" rel="noreferrer">Official source ↗</a> : source.source}</td><td>{source.ai_confidence || "—"}</td><td>{new Date(source.created_at).toLocaleString("ja-JP")}</td><td>{source.transformation_notes || "—"}</td></tr>)}</tbody></table></div> : <p className="muted">AI構造化CSVをConfirmした履歴はありません。</p>}</div>
    </section>}

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
