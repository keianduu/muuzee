"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { ExhibitionRow, MediaAssetRow, OccurrenceRow, SourceImageCandidateRow, VenueRow } from "@/lib/admin/types";
import type { PublicationRequirement } from "@/lib/admin/publication";
import { exhibitionRequirementTarget } from "@/lib/admin/exhibition-requirement-target";
import { dispatchAdminMediaMutation } from "@/lib/admin/media-asset-state";
import { AdminFeedback } from "./admin-feedback";
import { AdminImageManager } from "./admin-image-manager";
import { AdminTabs } from "./admin-tabs";
import { ExhibitionBasicEditor } from "./exhibition-basic-editor";
import { ExhibitionDataReview } from "./exhibition-data-review";
import { ExhibitionRelations } from "./exhibition-relations";
import { ExhibitionStatus } from "./exhibition-status";

export type ExhibitionEditorProps = {
  exhibition: ExhibitionRow;
  occurrence: OccurrenceRow | null;
  venue: VenueRow | null;
  prompt: string;
  requirements: PublicationRequirement[];
  canPublish: boolean;
  embeddedInList?: boolean;
  onOpenImageCandidate?: (candidateId: string | null) => void;
};

type DetailTab = "status" | "edit" | "data";
type EditTab = "basic" | "image" | "relations";

const DETAIL_TABS = [{ id: "status", label: "状態" }, { id: "edit", label: "編集" }, { id: "data", label: "データ" }] as const;
const EDIT_TABS = [{ id: "basic", label: "基本情報" }, { id: "image", label: "画像登録" }, { id: "relations", label: "関連情報" }] as const;
const EXHIBITION_SOURCE_TYPES = [
  { value: "artpr", label: "ARTPR" },
  { value: "official_press", label: "Official press" },
  { value: "organizer_press", label: "Organizer press" },
  { value: "open_collection", label: "Open collection" },
  { value: "wikimedia", label: "Wikimedia" },
  { value: "direct", label: "Direct permission" },
  { value: "other", label: "Other" },
] as const;

export function ExhibitionEditor({ exhibition, occurrence, venue, requirements, canPublish, embeddedInList = false, onOpenImageCandidate }: ExhibitionEditorProps) {
  const router = useRouter();
  const [tab, setTab] = useState<DetailTab>("status");
  const [editTab, setEditTab] = useState<EditTab>("basic");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  function openRequirement(key: PublicationRequirement["key"]) {
    const target = exhibitionRequirementTarget(key);
    setTab(target.detailTab);
    setEditTab(target.editTab);
    window.requestAnimationFrame(() => window.requestAnimationFrame(() => {
      const element = document.querySelector<HTMLElement>(target.selector);
      if (!element) return;
      element.scrollIntoView({ behavior: "smooth", block: "center" });
      const focusTarget = element.matches("button,input,textarea,select,a[href]")
        ? element
        : element.querySelector<HTMLElement>("button:not([disabled]), input:not([disabled]), textarea:not([disabled]), select:not([disabled]), a[href]");
      focusTarget?.focus({ preventScroll: true });
    }));
  }

  async function request(url: string, init: RequestInit) {
    setBusy(true); setMessage("");
    try {
      const response = await fetch(url, init);
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "処理に失敗しました。");
      setMessage(body.message || "保存しました。");
      window.dispatchEvent(new CustomEvent("muuzee:exhibition-updated", { detail: { id: exhibition.id } }));
      if (!embeddedInList) router.refresh();
      return body as Record<string, unknown>;
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "処理に失敗しました。");
      return null;
    } finally {
      setBusy(false);
    }
  }

  async function save(form: FormData) {
    await request(`/api/admin/exhibitions/${exhibition.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(Object.fromEntries(form)) });
  }
  async function upload(form: FormData) {
    const body = await request(`/api/admin/exhibitions/${exhibition.id}/media`, { method: "POST", body: form });
    if (body?.asset) dispatchAdminMediaMutation({ entity: "exhibitions", ownerId: exhibition.id, asset: body.asset as MediaAssetRow });
  }
  async function publication(next: boolean) {
    await request(`/api/admin/exhibitions/${exhibition.id}/publication`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: next ? "publish" : "unpublish" }) });
  }
  async function remove(asset: MediaAssetRow) {
    if (!window.confirm(`${asset.original_filename || "画像"}を削除しますか？`)) return;
    const body = await request(`/api/admin/exhibitions/${exhibition.id}/media/${asset.id}`, { method: "DELETE" });
    if (body?.removedAssetId) dispatchAdminMediaMutation({ entity: "exhibitions", ownerId: exhibition.id, removedAssetId: String(body.removedAssetId) });
  }
  async function approveRights(asset: MediaAssetRow) {
    const body = await request(`/api/admin/exhibitions/${exhibition.id}/media/${asset.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "approve_rights" }) });
    if (body?.asset) dispatchAdminMediaMutation({ entity: "exhibitions", ownerId: exhibition.id, asset: body.asset as MediaAssetRow });
  }
  async function setPrimaryCandidate(candidate: SourceImageCandidateRow, approveRights: boolean) {
    const body = await request(`/api/admin/masters/exhibitions/${exhibition.id}/image-candidates/${candidate.id}/set-primary`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ approveRights }) });
    if (body?.asset) dispatchAdminMediaMutation({ entity: "exhibitions", ownerId: exhibition.id, asset: body.asset as MediaAssetRow });
  }

  const imageCandidates = (exhibition.source_records || []).flatMap((source) => source.source_image_candidates || []).filter((candidate) => candidate.is_active !== false);

  return <>
    <AdminTabs tabs={DETAIL_TABS} value={tab} onChange={setTab} label="Exhibition詳細セクション"/>
    <div role="tabpanel" className="detail-tab-panel">
      {tab === "status" && <ExhibitionStatus exhibition={exhibition} occurrence={occurrence} venue={venue} requirements={requirements} canPublish={canPublish} busy={busy} onPublicationChange={publication} onRequirementSelect={openRequirement}/>}
      {tab === "edit" && <div className="exhibition-edit-surface">
        <AdminTabs tabs={EDIT_TABS} value={editTab} onChange={setEditTab} label="Exhibition編集セクション" variant="edit" returnAnchor="image"/>
        <div role="tabpanel">
          {editTab === "basic" && <ExhibitionBasicEditor exhibition={exhibition} occurrence={occurrence} venue={venue} busy={busy} onSave={save}/>}
          {editTab === "image" && <AdminImageManager entity="exhibitions" ownerId={exhibition.id} subjectLabel={exhibition.title} initialAssets={exhibition.media_assets} busy={busy} candidates={imageCandidates} onUpload={upload} onRemove={remove} onApproveRights={approveRights} onOpenImageCandidate={onOpenImageCandidate} onSetPrimary={setPrimaryCandidate} sourceTypeOptions={EXHIBITION_SOURCE_TYPES} defaultSourceType="official_press"/>}
          {editTab === "relations" && <ExhibitionRelations exhibition={exhibition} occurrence={occurrence} venue={venue}/>}
        </div>
      </div>}
      {tab === "data" && <ExhibitionDataReview exhibition={exhibition}/>}
      <AdminFeedback variant={message.includes("失敗") || message.includes("不足") || message.includes("必要") ? "error" : "success"} message={message}/>
    </div>
  </>;
}
