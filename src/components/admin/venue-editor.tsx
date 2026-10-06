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
import { dispatchAdminMediaMutation } from "@/lib/admin/media-asset-state";
import { AdminTabs } from "./admin-tabs";
import { AdminDataReview, AdminDataSection, AdminExternalSourceList, AdminProvenanceSummary, AdminReviewQueue } from "./admin-data-review";

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
  const pendingIdentityCandidates = candidates.filter((candidate) => candidate.status === "candidate");
  const imageCandidates = (venue.source_records || []).flatMap((source) => source.source_image_candidates || []);
  const coordinateCandidates = [...(venue.venue_coordinate_candidates || [])].sort((a, b) => b.updated_at.localeCompare(a.updated_at));
  const pendingCoordinateCandidates = coordinateCandidates.filter((candidate) => candidate.review_status === "candidate");

  return <>
    {(view === "all" || view === "edit") && <div className="venue-edit-surface">
      <AdminTabs tabs={VENUE_EDIT_TABS} value={editTab} onChange={selectEditTab} label="Venue編集セクション" variant="edit" returnAnchor="image"/>
      <div role="tabpanel">
        {editTab === "basic" && <VenueBasicEditor venue={venue} busy={busy} onSave={save} onOpenCoordinateReview={onOpenReviewPanel ? () => onOpenReviewPanel("coordinates") : undefined}/>}
        {editTab === "image" && <VenueImageEditor venue={venue} busy={busy} candidates={imageCandidates} onUpload={upload} onRemove={remove} onOpenImageCandidate={onOpenImageCandidate} onSetPrimary={setPrimaryImage}/>}
        {editTab === "relations" && <div className="venue-relations"><VenueRelations venue={venue}/><MasterTags entity="venues" masterId={venue.id} rows={tagRows} title="タグ" compactType/></div>}
      </div>
    </div>}

    {(view === "all" || view === "data") && <AdminDataReview className="venue-data-review">
      <AdminDataSection title="項目の出典"><AdminProvenanceSummary record={venue as unknown as Record<string, unknown>} fields={VENUE_PROVENANCE_FIELDS} sources={venue.venue_field_sources || []} sourceLabel={venueSourceLabel}/></AdminDataSection>

      <AdminDataSection title="外部データ"><AdminExternalSourceList sourceRecords={venue.source_records || []}/></AdminDataSection>

      {(pendingIdentityCandidates.length > 0 || pendingCoordinateCandidates.length > 0) && <AdminDataSection title="要確認">
        <AdminReviewQueue title="Wikidata identity候補" items={pendingIdentityCandidates.map((candidate) => ({
          id: candidate.id,
          label: candidate.label_ja || candidate.label_en || "名称未取得",
          externalId: candidate.external_id,
          sourceUrl: /^Q\d+$/.test(candidate.external_id) ? `https://www.wikidata.org/wiki/${candidate.external_id}` : null,
          meta: candidate.confidence != null ? `一致度 ${candidate.confidence}` : null,
        }))}/>
        {pendingCoordinateCandidates.length > 0 && <section className="admin-review-queue"><h3>位置情報候補</h3><VenueCoordinateReview venueId={venue.id} candidates={pendingCoordinateCandidates} busy={busy} onReview={reviewCoordinate}/></section>}
      </AdminDataSection>}
    </AdminDataReview>}
    <AdminFeedback variant={message.toLowerCase().includes("fail") || message.includes("必須") ? "error" : "success"} message={message}/>
  </>;
}
