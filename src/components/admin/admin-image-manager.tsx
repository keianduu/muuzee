"use client";

/* eslint-disable @next/next/no-img-element */

import Image from "next/image";
import { useEffect, useMemo, useState } from "react";
import type { AdminMediaEntity } from "@/lib/admin/media-asset-state";
import type { MediaAssetRow, SourceImageCandidateRow } from "@/lib/admin/types";
import { displayStatus } from "@/lib/admin/master-labels";
import { MasterImageCandidateCard } from "./master-image-candidate";
import { AdminDeleteButton } from "./admin-icon-button";
import { AdminFieldLabel } from "./admin-field-label";
import { AdminFeedback } from "./admin-feedback";
import { AdminPanelButton } from "./admin-panel-button";
import { EMPTY_MEDIA_ASSETS, useImmediateMediaAssets } from "./use-immediate-media-assets";

export function AdminImageManager({ entity, ownerId, subjectLabel, initialAssets, busy, candidates, onUpload, onRemove, onOpenImageCandidate, onSetPrimary }: {
  entity: AdminMediaEntity;
  ownerId: string;
  subjectLabel: string;
  initialAssets?: MediaAssetRow[];
  busy: boolean;
  candidates: SourceImageCandidateRow[];
  onUpload: (form: FormData) => Promise<void>;
  onRemove: (asset: MediaAssetRow) => void;
  onOpenImageCandidate?: (candidateId: string | null) => void;
  onSetPrimary: (candidate: SourceImageCandidateRow) => void;
}) {
  const [file, setFile] = useState<File | null>(null);
  const [imageUrl, setImageUrl] = useState("");
  const [previewError, setPreviewError] = useState("");
  const [previewFailed, setPreviewFailed] = useState(false);
  const objectUrl = useMemo(() => file ? URL.createObjectURL(file) : "", [file]);
  useEffect(() => () => { if (objectUrl) URL.revokeObjectURL(objectUrl); }, [objectUrl]);
  const trimmedUrl = imageUrl.trim();
  const validRemotePreview = (() => { try { return new URL(trimmedUrl).protocol === "https:"; } catch { return false; } })();
  const previewUrl = objectUrl || (validRemotePreview ? trimmedUrl : "");
  const showPreview = Boolean(previewUrl && !previewFailed);
  const assets = useImmediateMediaAssets(initialAssets ?? EMPTY_MEDIA_ASSETS, entity, ownerId);
  const selectableCandidates = candidates.filter((candidate) => candidate.is_active && candidate.review_status !== "rejected" && candidate.rights_status !== "rejected");
  const inlineCandidates = selectableCandidates.length === 1 || !onOpenImageCandidate ? selectableCandidates : [];
  useEffect(() => {
    if (!assets.length) return;
    setFile(null); setImageUrl(""); setPreviewError(""); setPreviewFailed(false);
  }, [assets.length]);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!file && !validRemotePreview) { setPreviewError("画像ファイルまたは有効なHTTPS画像URLを指定してください。"); return; }
    setPreviewError("");
    await onUpload(new FormData(event.currentTarget));
  }

  return <div className="admin-image-manager">
    <section data-admin-image-section="registered"><h2>登録画像</h2>{assets.length ? <div className="media-grid">{assets.map((asset, index) => <article className="card media-card" key={asset.id}>{asset.signedUrl ? <Image src={asset.signedUrl} alt="" width={640} height={400} unoptimized priority={index === 0}/> : <div className="thumb"/>}<p><strong>{asset.original_filename || "Image"}</strong><br/><span className={`status ${asset.rights_status}`}>{displayStatus(asset.rights_status)}</span>{asset.is_primary && <> <span className="status approved">メイン画像</span></>}</p><AdminDeleteButton disabled={busy} onClick={() => onRemove(asset)}/></article>)}</div> : <div className="admin-image-placeholder" role="img" aria-label="登録画像なし">No Image</div>}</section>
    {!assets.length && <section className="candidate-section" data-admin-image-section="candidates"><div className="section-heading-row"><div><h2>画像候補</h2><p className="muted">選択できる候補 {selectableCandidates.length}件</p></div>{selectableCandidates.length > 1 && onOpenImageCandidate && <AdminPanelButton data-secondary-trigger="image" onClick={() => onOpenImageCandidate(null)}>画像候補を選択</AdminPanelButton>}</div>{inlineCandidates.length > 0 && <div className="media-grid">{inlineCandidates.map((candidate) => <MasterImageCandidateCard key={candidate.id} candidate={candidate} subjectLabel={subjectLabel} busy={busy} onSetPrimary={() => onSetPrimary(candidate)}/>)}</div>}{!selectableCandidates.length && <p className="empty-state">画像候補はありません。</p>}</section>}
    {!assets.length && <form className="card admin-image-registration" data-admin-image-section="registration" onSubmit={submit}>
      <h2>画像登録</h2>
      {showPreview && <div className="admin-image-preview" aria-live="polite"><img src={previewUrl} alt="登録前プレビュー" onLoad={() => { setPreviewError(""); setPreviewFailed(false); }} onError={() => { setPreviewFailed(true); setPreviewError("画像をPreviewできません。URL側でhotlinkが制限されている可能性があります。"); }}/></div>}
      <AdminFeedback variant="error" message={previewError}/>
      <div className="admin-image-source-grid"><div className="field"><AdminFieldLabel htmlFor={`${entity}-image-file`} label="画像ファイル" fieldKey="file"/><input id={`${entity}-image-file`} name="file" type="file" accept="image/jpeg,image/png,image/webp,image/gif" onChange={(event) => { setFile(event.target.files?.[0] || null); setPreviewError(""); setPreviewFailed(false); }}/></div><div className="admin-image-or" aria-hidden="true">または</div><div className="field"><AdminFieldLabel htmlFor={`${entity}-image-url`} label="画像URL" fieldKey="image_url"/><input id={`${entity}-image-url`} name="image_url" type="url" placeholder="https://…" value={imageUrl} onChange={(event) => { setImageUrl(event.target.value); setPreviewError(""); setPreviewFailed(false); }}/><small className="muted">ファイルを選択した場合はファイルを優先します。</small></div></div>
      <div className="admin-image-metadata"><div className="field"><AdminFieldLabel label="出典種別" fieldKey="source_type"/><select name="source_type" required defaultValue="other"><option value="official_press">Official press</option><option value="open_collection">Open collection</option><option value="wikimedia">Wikimedia</option><option value="direct">Direct permission</option><option value="other">Other</option></select></div><div className="field"><AdminFieldLabel label="利用可否" fieldKey="rights_status"/><select name="rights_status" required defaultValue="needs_review"><option value="rejected">明確に不可</option><option value="needs_review">記載なし・不明</option><option value="approved">明確に利用可能</option></select></div><div className="field"><AdminFieldLabel label="データ元URL（任意）" fieldKey="source_url"/><input name="source_url" type="url"/><small className="muted">画像URLではなく、可能なら出典ページを入力します。</small></div><div className="field"><AdminFieldLabel label="クレジット（任意）" fieldKey="credit"/><input name="credit"/></div><div className="field"><AdminFieldLabel label="利用期限" fieldKey="valid_until"/><input name="valid_until" type="date"/></div><div className="field"><AdminFieldLabel label="利用条件メモ（任意）" fieldKey="usage_note"/><textarea name="usage_note"/></div></div>
      <div className="actions"><button className="button" disabled={busy}>登録</button></div>
    </form>}
  </div>;
}
