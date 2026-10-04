"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useState } from "react";
import type { ExhibitionRow, MediaAssetRow, OccurrenceRow, VenueRow } from "@/lib/admin/types";
import type { PublicationRequirement } from "@/lib/admin/publication";
import { AdminFieldLabel } from "./admin-field-label";
import { AdminDeleteButton } from "./admin-icon-button";
import { PublicationToggle } from "./publication-toggle";
import { MasterImageCandidateCard } from "./master-image-candidate";
import { isPrimaryCandidateUsable } from "@/lib/admin/primary-image-policy";
import { dispatchAdminMediaMutation } from "@/lib/admin/media-asset-state";
import { EMPTY_MEDIA_ASSETS, useImmediateMediaAssets } from "./use-immediate-media-assets";

export type ExhibitionEditorProps = {
  exhibition: ExhibitionRow;
  occurrence: OccurrenceRow | null;
  venue: VenueRow | null;
  prompt: string;
  requirements: PublicationRequirement[];
  canPublish: boolean;
  embeddedInList?: boolean;
};

function sourceName(value: unknown) {
  const relation = Array.isArray(value) ? value[0] : value;
  return relation && typeof relation === "object" && "name" in relation ? String(relation.name || "データ元") : "データ元";
}

export function ExhibitionEditor({ exhibition, occurrence, venue, prompt, requirements, canPublish, embeddedInList = false }: ExhibitionEditorProps) {
  const router = useRouter();
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const assets = useImmediateMediaAssets(exhibition.media_assets ?? EMPTY_MEDIA_ASSETS, "exhibitions", exhibition.id);
  async function request(url: string, init: RequestInit) {
    setBusy(true); setMessage("");
    try {
      const response = await fetch(url, init); const body = await response.json();
      if (!response.ok) throw new Error(body.error || "処理に失敗しました。");
      setMessage(body.message || "保存しました。");
      window.dispatchEvent(new CustomEvent("muuzee:exhibition-updated", { detail: { id: exhibition.id } }));
      if (!embeddedInList) router.refresh();
      return body;
    } catch (error) { setMessage(error instanceof Error ? error.message : "処理に失敗しました。"); return null; }
    finally { setBusy(false); }
  }
  async function save(event: React.FormEvent<HTMLFormElement>) { event.preventDefault(); const form = new FormData(event.currentTarget); await request(`/api/admin/exhibitions/${exhibition.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(Object.fromEntries(form)) }); }
  async function upload(event: React.FormEvent<HTMLFormElement>) { event.preventDefault(); const form = event.currentTarget; const body = await request(`/api/admin/exhibitions/${exhibition.id}/media`, { method: "POST", body: new FormData(form) }); if (body?.asset) { dispatchAdminMediaMutation({ entity: "exhibitions", ownerId: exhibition.id, asset: body.asset as MediaAssetRow }); form.reset(); } }
  async function publication(next: boolean) { await request(`/api/admin/exhibitions/${exhibition.id}/publication`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: next ? "publish" : "unpublish" }) }); }
  async function remove(asset: MediaAssetRow) { if (!window.confirm(`${asset.original_filename || "画像"}を削除しますか？`)) return; const body = await request(`/api/admin/exhibitions/${exhibition.id}/media/${asset.id}`, { method: "DELETE" }); if (body?.removedAssetId) dispatchAdminMediaMutation({ entity: "exhibitions", ownerId: exhibition.id, removedAssetId: String(body.removedAssetId) }); }
  async function setPrimaryCandidate(candidateId: string) { const body = await request(`/api/admin/masters/exhibitions/${exhibition.id}/image-candidates/${candidateId}/set-primary`, { method: "POST" }); if (body?.asset) dispatchAdminMediaMutation({ entity: "exhibitions", ownerId: exhibition.id, asset: body.asset as MediaAssetRow }); }
  const published = exhibition.publication_status === "published";
  const missing = requirements.filter((item) => !item.met);
  const requirementMessageId = `publication-requirements-${exhibition.id}`;
  const imageCandidates = (exhibition.source_records || []).flatMap((source) => source.source_image_candidates || []).filter(isPrimaryCandidateUsable);
  return <>
    <section className="card publication-status-card">
      <div><AdminFieldLabel label="公開状態" fieldKey="publication_status"/><p className="publication-status-help">公開条件を満たした展覧会だけを公開できます。</p></div>
      <div className="publication-status-actions"><PublicationToggle checked={published} busy={busy} disabled={!published && !canPublish} describedBy={!canPublish ? requirementMessageId : undefined} onChange={publication}/></div>
      {!canPublish && !published && <div className="publication-requirements" id={requirementMessageId}><strong>公開に必要な情報が不足しています</strong><span>{missing.map((item) => item.label).join("、")}</span></div>}
    </section>
    <section className="card"><h2>公開条件</h2><ul className="requirements">{requirements.map((item) => <li key={item.key} className={item.met ? "met" : "required-missing"}>{item.met ? "✓ " : ""}{item.label}</li>)}</ul></section>
    <form className="card" onSubmit={save}>
      <h2>基本情報</h2><div className="form-grid">
        <div className="field full"><AdminFieldLabel htmlFor="exhibition-title" label="タイトル" fieldKey="title"/><input id="exhibition-title" name="title" required defaultValue={exhibition.title}/></div>
        <div className="field"><AdminFieldLabel htmlFor="exhibition-title-en" label="英語タイトル" fieldKey="title_en"/><input id="exhibition-title-en" name="title_en" defaultValue={exhibition.title_en || ""}/></div>
        <div className="field"><AdminFieldLabel htmlFor="exhibition-type" label="展示会種別" fieldKey="exhibition_type"/><input id="exhibition-type" name="exhibition_type" defaultValue={exhibition.exhibition_type || ""}/></div>
        <div className="field full"><AdminFieldLabel htmlFor="exhibition-description" label="概要" fieldKey="description"/><textarea id="exhibition-description" name="description" defaultValue={exhibition.description || ""}/></div>
        <div className="field full"><AdminFieldLabel htmlFor="exhibition-official-url" label="公式URL" fieldKey="official_url"/><input id="exhibition-official-url" name="official_url" type="url" defaultValue={exhibition.official_url || ""}/></div>
        <div className="field"><AdminFieldLabel htmlFor="exhibition-venue-name" label="会場" fieldKey="venue_name"/><input id="exhibition-venue-name" name="venue_name" required defaultValue={venue?.name || ""}/></div>
        <div className="field"><AdminFieldLabel htmlFor="exhibition-venue-address" label="住所" fieldKey="venue_address"/><input id="exhibition-venue-address" name="venue_address" defaultValue={venue?.address || ""}/></div>
        <div className="field"><AdminFieldLabel htmlFor="exhibition-start-date" label="開始日" fieldKey="start_date"/><input id="exhibition-start-date" name="start_date" type="date" defaultValue={occurrence?.start_date || ""}/></div>
        <div className="field"><AdminFieldLabel htmlFor="exhibition-end-date" label="終了日" fieldKey="end_date"/><input id="exhibition-end-date" name="end_date" type="date" defaultValue={occurrence?.end_date || ""}/></div>
        <div className="field"><AdminFieldLabel htmlFor="exhibition-opening-hours" label="開館時間" fieldKey="opening_hours_text"/><textarea id="exhibition-opening-hours" name="opening_hours_text" defaultValue={occurrence?.opening_hours_text || ""}/></div>
        <div className="field"><AdminFieldLabel htmlFor="exhibition-closed-days" label="休館日" fieldKey="closed_days_text"/><textarea id="exhibition-closed-days" name="closed_days_text" defaultValue={occurrence?.closed_days_text || ""}/></div>
        <div className="field full"><AdminFieldLabel htmlFor="exhibition-ticket-url" label="チケットURL" fieldKey="ticket_url"/><input id="exhibition-ticket-url" name="ticket_url" type="url" defaultValue={occurrence?.ticket_url || ""}/></div>
      </div><div className="actions"><button className="button" disabled={busy}>保存</button></div>
    </form>
    <section className="card"><h2>画像を探す</h2><p className="muted">外部検索は自動実行しません。下記プロンプトをコピーし、人が候補と利用条件を確認してください。</p><textarea readOnly value={prompt} style={{ minHeight: 300 }}/><div className="actions"><button className="button secondary" type="button" onClick={() => navigator.clipboard.writeText(prompt).then(() => setMessage("プロンプトをコピーしました。"))}>プロンプトをコピー</button></div></section>
    {!assets.length && <form className="card" onSubmit={upload}><h2>画像・利用条件を登録</h2><div className="form-grid">
      <div className="field full"><AdminFieldLabel htmlFor="exhibition-image" label="画像（JPEG / PNG / WebP / GIF、最大20 MB）" fieldKey="file"/><input id="exhibition-image" name="file" type="file" accept="image/jpeg,image/png,image/webp,image/gif" required/></div>
      <div className="field"><AdminFieldLabel htmlFor="exhibition-source-type" label="データ元種別" fieldKey="source_type"/><select id="exhibition-source-type" name="source_type" required defaultValue="official_press"><option value="artpr">ARTPR</option><option value="official_press">Official press</option><option value="organizer_press">Organizer press</option><option value="open_collection">Open collection</option><option value="wikimedia">Wikimedia</option><option value="direct">Direct permission</option><option value="other">Other</option></select></div>
      <div className="field"><AdminFieldLabel htmlFor="exhibition-rights" label="利用可否" fieldKey="rights_status"/><select id="exhibition-rights" name="rights_status" required defaultValue="needs_review"><option value="rejected">明確に再配布NG</option><option value="needs_review">表記がなく判断不能</option><option value="approved">配布OKの明示あり</option></select></div>
      <div className="field full"><AdminFieldLabel htmlFor="exhibition-source-url" label="データ元URL（任意）" fieldKey="source_url"/><input id="exhibition-source-url" name="source_url" type="url"/></div>
      <div className="field"><AdminFieldLabel htmlFor="exhibition-credit" label="クレジット（任意）" fieldKey="credit"/><input id="exhibition-credit" name="credit"/></div>
      <div className="field"><AdminFieldLabel htmlFor="exhibition-valid-until" label="利用期限" fieldKey="valid_until"/><input id="exhibition-valid-until" name="valid_until" type="date"/></div>
      <div className="field full"><AdminFieldLabel htmlFor="exhibition-usage-note" label="利用条件・判断根拠（任意）" fieldKey="usage_note"/><textarea id="exhibition-usage-note" name="usage_note"/></div>
    </div><div className="actions"><button className="button" disabled={busy}>画像を登録</button></div></form>}
    <section><h2>登録画像</h2><div className="media-grid">{assets.map((asset) => <article className="card media-card" key={asset.id}>{asset.signedUrl ? <Image src={asset.signedUrl} alt="" width={640} height={400} unoptimized/> : <div className="thumb"/>}<p><strong>{asset.original_filename}</strong><br/><span className={`status ${asset.rights_status}`}>{asset.rights_status}</span>{asset.is_primary && <> <span className="status">メイン画像</span></>}</p><p className="muted">{asset.credit || "クレジットなし"}<br/>{asset.source_url || "データ元URLなし"}</p><AdminDeleteButton disabled={busy} onClick={() => remove(asset)}/></article>)}</div>{!assets.length && <p className="muted">No Image</p>}</section>
    {!assets.length && <section><h2>画像候補</h2><p className="muted">利用可否が不明または承認済みの候補です。選択してもRights状態は変更しません。</p><div className="media-grid">{imageCandidates.map((candidate) => <MasterImageCandidateCard key={candidate.id} candidate={candidate} subjectLabel={exhibition.title} busy={busy} onSetPrimary={() => setPrimaryCandidate(candidate.id)}/>)}</div>{!imageCandidates.length && <p className="muted">選択できる画像候補はありません。</p>}</section>}
    <section><h2>データ元</h2>{(exhibition.source_records || []).map((source) => <details className="card" key={source.id}><summary>{sourceName(source.data_sources)} / {source.external_id}</summary><p>{source.source_url ? <a className="button secondary" href={source.source_url} target="_blank" rel="noreferrer">データ元を開く</a> : "URL未設定"} · fetched {source.fetched_at}</p><pre>{JSON.stringify(source.raw_payload, null, 2)}</pre></details>)}</section>
    {message && <div className={message.includes("失敗") || message.includes("不足") || message.includes("必要") ? "error" : "notice"}>{message}</div>}
  </>;
}
