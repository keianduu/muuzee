"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import type { MediaAssetRow, SourceImageCandidateRow, VenueCoordinateCandidateRow, VenueMatchCandidateRow, VenueRow } from "@/lib/admin/types";
import { VENUE_PROVENANCE_FIELDS, venueSourceLabel } from "@/lib/admin/venue-data-review";
import type { DetailPanel } from "@/lib/admin/master-list-state";
import { VenueBasicEditor } from "./venue-basic-editor";
import { VenueImageEditor } from "./venue-image-editor";
import { VenueRelations } from "./venue-relations";
import { VenueCoordinateReview } from "./venue-coordinate-review";
import { MasterTags } from "./master-tags";
import { VENUE_EDIT_TABS, type VenueEditTab, venueEditTab, venueEditTabQuery } from "@/lib/admin/venue-edit";

type PanelOptions = { candidateId?: string | null; runId?: string | null };

function wikidataCandidateAddress(candidate: VenueMatchCandidateRow) {
  const raw = candidate.raw_payload as { normalized?: { address?: string | null }; claims?: Record<string, Array<{ mainsnak?: { datavalue?: { value?: unknown } } }>> } | undefined;
  if (raw?.normalized?.address) return raw.normalized.address;
  const value = raw?.claims?.P6375?.[0]?.mainsnak?.datavalue?.value;
  return value && typeof value === "object" && "text" in value ? String((value as { text: unknown }).text) : "未取得";
}

export function VenueEditor({ venue, showBasicForm = true, view = "all", tagRows = [], onOpenImageCandidate, onOpenReviewPanel }: {
  venue: VenueRow;
  prompt: string;
  showBasicForm?: boolean;
  view?: "all" | "status" | "edit" | "data";
  tagRows?: Array<Record<string, unknown>>;
  onOpenImageCandidate?: (candidateId: string | null) => void;
  onOpenReviewPanel?: (panel: DetailPanel, options?: PanelOptions) => void;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const editTab = venueEditTab(searchParams.get("venueEdit"));
  function selectEditTab(tab: VenueEditTab) {
    const query = venueEditTabQuery(searchParams.toString(), tab);
    router.replace(`${pathname}?${query}`, { scroll: false });
  }
  async function request(url: string, init: RequestInit, options: { preserveListOrder?: boolean } = {}) {
    setBusy(true); setMessage("");
    try {
      const response = await fetch(url, init); const body = await response.json();
      if (!response.ok) throw new Error(body.error || "Request failed");
      setMessage(body.message || "完了しました。");
      if (showBasicForm) router.refresh();
      window.dispatchEvent(new CustomEvent("muuzee:master-updated", { detail: { entity: "venues", id: venue.id, preserveListOrder: Boolean(options.preserveListOrder) } }));
      return body as Record<string, unknown>;
    } catch (error) { setMessage(error instanceof Error ? error.message : "Request failed"); return null; }
    finally { setBusy(false); }
  }
  async function save(values: Record<string, string>) {
    await request(`/api/admin/venues/${venue.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(values) });
  }
  async function searchWikidataCandidates() { await request(`/api/admin/venues/${venue.id}/enrich`, { method: "POST" }); }
  async function reviewIdentity(candidate: VenueMatchCandidateRow, action: "confirm" | "reject") {
    await request(`/api/admin/venues/${venue.id}/matches/${candidate.id}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action }) });
  }
  async function crawlOfficialWebsite() {
    const body = await request(`/api/admin/venues/${venue.id}/official-preview`, { method: "POST" });
    if (body?.runId) onOpenReviewPanel?.("official-fields", { runId: String(body.runId) });
  }
  async function reviewCoordinate(candidate: VenueCoordinateCandidateRow, action: "accept" | "reject") {
    await request(`/api/admin/venues/${venue.id}/coordinate-candidates/${candidate.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action }) }, { preserveListOrder: true });
  }
  async function review(candidate: SourceImageCandidateRow, updates: { review_status?: "accepted" | "rejected"; rights_status?: "rejected" | "needs_review" | "approved" }) {
    await request(`/api/admin/venues/${venue.id}/image-candidates/${candidate.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(updates) });
  }
  async function setPrimaryImage(candidate: SourceImageCandidateRow) {
    await request(`/api/admin/venues/${venue.id}/image-candidates/${candidate.id}/set-primary`, { method: "POST" }, { preserveListOrder: true });
  }
  async function upload(form: FormData) { await request(`/api/admin/venues/${venue.id}/media`, { method: "POST", body: form }); }
  async function remove(asset: MediaAssetRow) {
    if (!window.confirm(`${asset.original_filename || "画像"}を削除しますか？`)) return;
    await request(`/api/admin/venues/${venue.id}/media/${asset.id}`, { method: "DELETE" });
  }

  const candidates = [...(venue.venue_external_match_candidates || [])].filter((candidate) => candidate.provider === "wikidata").sort((a, b) => b.confidence - a.confidence);
  const linkedWikidataSource = (venue.source_records || []).find((source) => (Array.isArray(source.data_sources) ? source.data_sources : source.data_sources ? [source.data_sources] : []).some((item) => item.key === "wikidata"));
  const matchedCandidate = candidates.find((candidate) => candidate.status === "matched");
  const matchedWikidataId = matchedCandidate?.external_id || linkedWikidataSource?.external_id || null;
  const imageCandidates = (venue.source_records || []).flatMap((source) => source.source_image_candidates || []);
  const currentSources = new Map((venue.venue_field_sources || []).filter((source) => source.is_current).map((source) => [source.field_name, source]));
  const coordinateCandidates = [...(venue.venue_coordinate_candidates || [])].sort((a, b) => b.updated_at.localeCompare(a.updated_at));

  return <>
    {(view === "all" || view === "edit") && <div className="venue-edit-surface">
      <div className="venue-edit-tabs" role="tablist" aria-label="Venue編集セクション">{VENUE_EDIT_TABS.map((tab) => <button type="button" role="tab" aria-selected={editTab === tab.id} className={editTab === tab.id ? "is-active" : ""} key={tab.id} onClick={() => selectEditTab(tab.id)}>{tab.label}</button>)}</div>
      <div role="tabpanel">
        {editTab === "basic" && <VenueBasicEditor venue={venue} busy={busy} onSave={save} onOpenCoordinateReview={onOpenReviewPanel ? () => onOpenReviewPanel("coordinates") : undefined}/>}
        {editTab === "image" && <VenueImageEditor venue={venue} busy={busy} candidates={imageCandidates} onUpload={upload} onRemove={remove} onOpenImageCandidate={onOpenImageCandidate} onSetPrimary={setPrimaryImage} onReview={review}/>}
        {editTab === "relations" && <><VenueRelations venue={venue}/><MasterTags entity="venues" masterId={venue.id} rows={tagRows} title="タグ" compactType/></>}
      </div>
    </div>}

    {(view === "all" || view === "data") && <div className="venue-data-review">
      <section><div className="section-heading-row"><div><h2>Wikidata照合</h2>{matchedWikidataId && <p className="muted">確定QID: <a href={`https://www.wikidata.org/wiki/${matchedWikidataId}`} target="_blank" rel="noreferrer">{matchedWikidataId} ↗</a></p>}</div><button type="button" className="button secondary" disabled={busy} onClick={searchWikidataCandidates}>Wikidata候補を取得</button></div>
        {candidates.length ? <div className="wikidata-identity-list">{candidates.map((candidate) => {
          const address = wikidataCandidateAddress(candidate);
          const mapUrl = candidate.latitude != null && candidate.longitude != null ? `https://www.google.com/maps?q=${candidate.latitude},${candidate.longitude}` : null;
          return <article className="card wikidata-identity-card" key={candidate.id}><div className="section-heading-row"><div><strong>{candidate.label_ja || candidate.label_en || candidate.external_id}</strong><p className="muted">{candidate.external_id} · {candidate.status === "matched" ? "確定済み" : candidate.status === "rejected" ? "非採用" : "候補"}</p></div><span className={`status ${candidate.status}`}>{candidate.status}</span></div><p>{candidate.description || "説明なし"}</p><dl><div><dt>英語名</dt><dd>{candidate.label_en || "未取得"}</dd></div><div><dt>住所</dt><dd>{address}</dd></div><div><dt>公式URL</dt><dd>{candidate.official_url ? <a href={candidate.official_url} target="_blank" rel="noreferrer">データ元を開く ↗</a> : "未取得"}</dd></div><div><dt>一致度</dt><dd>{candidate.confidence}</dd></div><div><dt>理由</dt><dd>{candidate.match_reasons.join(" / ") || "記録なし"}</dd></div><div><dt>座標</dt><dd>{candidate.latitude != null && candidate.longitude != null ? `${candidate.latitude}, ${candidate.longitude}` : "未取得"}</dd></div></dl>{mapUrl && <a className="button secondary" href={mapUrl} target="_blank" rel="noreferrer">Google Mapsで確認 ↗</a>}{candidate.status === "candidate" && <div className="actions"><button type="button" className="button" disabled={busy} onClick={() => reviewIdentity(candidate, "confirm")}>採用</button><button type="button" className="button secondary" disabled={busy} onClick={() => reviewIdentity(candidate, "reject")}>非採用</button></div>}</article>;
        })}</div> : <p className="empty-state">Wikidata候補は未取得です。</p>}
      </section>

      <section><h2>外部データから情報を取得</h2><div className="venue-data-actions"><button type="button" className="button secondary" disabled={!matchedWikidataId || busy} onClick={() => onOpenReviewPanel?.("wikidata-fields")}>Wikidataから情報補完</button><button type="button" className="button secondary" disabled={!venue.official_url || busy} onClick={crawlOfficialWebsite}>{busy ? "取得中…" : "公式サイトから情報取得"}</button></div>{!matchedWikidataId && <p className="muted">Wikidataから補完するには、先にQIDを確定してください。</p>}{!venue.official_url && <p className="muted">公式サイトから取得するには、基本情報へ公式URLを登録してください。</p>}</section>

      <section><h2>項目の出典</h2><div className="venue-provenance-list">{VENUE_PROVENANCE_FIELDS.map(([key, label]) => { const source = currentSources.get(key); return <div className="venue-provenance-row" key={key}><span><strong>{label}</strong><code>{key}</code></span>{source?.source_url ? <a href={source.source_url} target="_blank" rel="noreferrer">{venueSourceLabel(source.source)} ↗</a> : <b>{venueSourceLabel(source?.source)}</b>}</div>; })}</div></section>

      <section><div className="section-heading-row"><h2>位置情報候補</h2>{coordinateCandidates.length > 0 && onOpenReviewPanel && <button type="button" className="button secondary" onClick={() => onOpenReviewPanel("coordinates")}>第二Drawerで確認</button>}</div><VenueCoordinateReview venueId={venue.id} candidates={coordinateCandidates} busy={busy} onReview={reviewCoordinate}/></section>
    </div>}
    {message && <div className={message.toLowerCase().includes("fail") || message.includes("必須") ? "error" : "notice"}>{message}</div>}
  </>;
}
