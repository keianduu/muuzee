"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import type { MediaAssetRow, SourceImageCandidateRow, VenueCoordinateCandidateRow, VenueRow } from "@/lib/admin/types";
import { VENUE_PROVENANCE_FIELDS, venueSourceLabel } from "@/lib/admin/venue-data-review";
import type { DetailPanel } from "@/lib/admin/master-list-state";
import { VenueBasicEditor } from "./venue-basic-editor";
import { VenueImageEditor } from "./venue-image-editor";
import { VenueRelations } from "./venue-relations";
import { VenueCoordinateReview } from "./venue-coordinate-review";
import { MasterTags } from "./master-tags";
import { VENUE_EDIT_TABS, type VenueEditTab, venueEditTab, venueEditTabQuery } from "@/lib/admin/venue-edit";
import { AdminFeedback } from "./admin-feedback";
import { AdminPanelButton } from "./admin-panel-button";
import { dispatchAdminMediaMutation } from "@/lib/admin/media-asset-state";
import { AdminTabs } from "./admin-tabs";

type PanelOptions = { candidateId?: string | null; runId?: string | null; targetUrl?: string | null };

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
  const [officialUrl, setOfficialUrl] = useState(venue.official_url || "");
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
  async function save(values: Record<string, unknown>) {
    await request(`/api/admin/venues/${venue.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(values) });
  }
  async function reviewCoordinate(candidate: VenueCoordinateCandidateRow, action: "accept" | "reject") {
    await request(`/api/admin/venues/${venue.id}/coordinate-candidates/${candidate.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action }) }, { preserveListOrder: true });
  }
  async function setPrimaryImage(candidate: SourceImageCandidateRow) {
    const body = await request(`/api/admin/venues/${venue.id}/image-candidates/${candidate.id}/set-primary`, { method: "POST" }, { preserveListOrder: true });
    if (body?.asset) dispatchAdminMediaMutation({ entity: "venues", ownerId: venue.id, asset: body.asset as MediaAssetRow });
  }
  async function upload(form: FormData) {
    const body = await request(`/api/admin/venues/${venue.id}/media`, { method: "POST", body: form }, { preserveListOrder: true });
    if (body?.asset) dispatchAdminMediaMutation({ entity: "venues", ownerId: venue.id, asset: body.asset as MediaAssetRow });
  }
  async function remove(asset: MediaAssetRow) {
    if (!window.confirm(`${asset.original_filename || "画像"}を削除しますか？`)) return;
    const body = await request(`/api/admin/venues/${venue.id}/media/${asset.id}`, { method: "DELETE" }, { preserveListOrder: true });
    if (body?.removedAssetId) dispatchAdminMediaMutation({ entity: "venues", ownerId: venue.id, removedAssetId: String(body.removedAssetId) });
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
      <AdminTabs tabs={VENUE_EDIT_TABS} value={editTab} onChange={selectEditTab} label="Venue編集セクション" variant="edit" returnAnchor="image"/>
      <div role="tabpanel">
        {editTab === "basic" && <VenueBasicEditor venue={venue} busy={busy} onSave={save} onOpenCoordinateReview={onOpenReviewPanel ? () => onOpenReviewPanel("coordinates") : undefined}/>}
        {editTab === "image" && <VenueImageEditor venue={venue} busy={busy} candidates={imageCandidates} onUpload={upload} onRemove={remove} onOpenImageCandidate={onOpenImageCandidate} onSetPrimary={setPrimaryImage}/>}
        {editTab === "relations" && <div className="venue-relations"><VenueRelations venue={venue}/><MasterTags entity="venues" masterId={venue.id} rows={tagRows} title="タグ" compactType/></div>}
      </div>
    </div>}

    {(view === "all" || view === "data") && <div className="venue-data-review">
      <section><div className="section-heading-row"><div><h2>Wikidata</h2><p className="muted">{matchedWikidataId ? <>照合済み · <a href={`https://www.wikidata.org/wiki/${matchedWikidataId}`} target="_blank" rel="noreferrer">データ元を開く ↗</a></> : candidates.some((candidate) => candidate.status === "candidate") ? "確認待ちの候補があります。" : venue.wikidata_match_status === "unmatched" ? "一致する候補は未検出です。" : "まだ検索していません。"}</p></div><AdminPanelButton onClick={() => onOpenReviewPanel?.("wikidata-fields")}>{matchedWikidataId ? "Wikidataから不足情報を再取得" : candidates.some((candidate) => candidate.status === "candidate") ? "候補を確認" : "Wikidata候補を取得"}</AdminPanelButton></div></section>

      <section><h2>公式サイト</h2><p className="muted">保存前のURLでも取得結果を確認できます。取得だけではMasterの公式URLを変更しません。</p><div className="field"><label htmlFor={`venue-review-url-${venue.id}`}>取得先URL</label><input id={`venue-review-url-${venue.id}`} type="url" placeholder="https://example.com/" value={officialUrl} onChange={(event) => setOfficialUrl(event.target.value)}/></div><div className="venue-data-actions"><AdminPanelButton disabled={!officialUrl.trim()} onClick={() => onOpenReviewPanel?.("official-fields", { targetUrl: officialUrl.trim() })}>公式サイトから情報取得</AdminPanelButton></div></section>

      <section><h2>項目の出典</h2><div className="venue-provenance-list">{VENUE_PROVENANCE_FIELDS.map(([key, label]) => { const source = currentSources.get(key); const value = (venue as unknown as Record<string, unknown>)[key]; const hasValue = value != null && String(value).trim() !== ""; return <div className="venue-provenance-row" key={key}><span><strong>{label}</strong><code>{key}</code></span>{!hasValue ? <b>—</b> : source?.source_url ? <a href={source.source_url} target="_blank" rel="noreferrer">{venueSourceLabel(source.source)} ↗</a> : <b>{venueSourceLabel(source?.source)}</b>}</div>; })}</div></section>

      <section><div className="section-heading-row"><h2>位置情報候補</h2></div><VenueCoordinateReview venueId={venue.id} candidates={coordinateCandidates} busy={busy} onReview={reviewCoordinate}/></section>
    </div>}
    <AdminFeedback variant={message.toLowerCase().includes("fail") || message.includes("必須") ? "error" : "success"} message={message}/>
  </>;
}
