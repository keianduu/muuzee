"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { MASTER_CONFIGS, type MasterEntity, type MasterField } from "@/lib/admin/master-config";
import type { MasterRecord } from "@/lib/admin/master-repository";
import { displayStatus } from "@/lib/admin/master-labels";
import type { MediaAssetRow, SourceImageCandidateRow } from "@/lib/admin/types";
import { effectiveArtistTier } from "@/lib/admin/artist-priority";
import { workDisplayTitleJa } from "@/lib/work-title";
import { AdminFieldLabel } from "./admin-field-label";
import { AdminDeleteButton } from "./admin-icon-button";
import { PublicationToggle } from "./publication-toggle";
import { MASTER_IMAGE_STATES, masterImageState, venuePositionState } from "@/lib/admin/master-availability";
import { dispatchAdminMediaMutation } from "@/lib/admin/media-asset-state";
import { AdminImageManager } from "./admin-image-manager";
import { AdminRelationList } from "./admin-relation-list";
import { AdminExternalSourceSummary } from "./admin-data-review";

type DetailRecord = MasterRecord & {
  completeness: { percent: number; items: Array<{ key: string; label: string; met: boolean }> };
  signedImageUrl?: string | null;
};

function inputValue(field: MasterField, value: unknown) {
  if (field.type === "aliases") return Array.isArray(value) ? value.join("|") : "";
  if (value == null) return "";
  return String(value);
}

function linkedValue(value: unknown, relation: string, labelKey: string) {
  return ((value || []) as Array<Record<string, unknown>>).map((item) => {
    const linked = item[relation]; const record = Array.isArray(linked) ? linked[0] : linked;
    return record && typeof record === "object" ? String((record as Record<string, unknown>)[labelKey] || "") : "";
  }).filter(Boolean);
}

function linkedRelationItems(value: unknown, relation: string, labelKey: string, metaKey?: string) {
  return ((value || []) as Array<Record<string, unknown>>).map((item, index) => {
    const linked = item[relation]; const row = (Array.isArray(linked) ? linked[0] : linked) as Record<string, unknown> | undefined;
    const label = row ? String(row[labelKey] || "") : "";
    return label ? { id: String(item.id || row?.id || index), label, meta: metaKey && item[metaKey] ? String(item[metaKey]) : null } : null;
  }).filter((item): item is { id: string; label: string; meta: string | null } => Boolean(item));
}

function linkedWorkItems(value: unknown) {
  return ((value || []) as Array<Record<string, unknown>>).map((item, index) => {
    const linked = item.works; const row = (Array.isArray(linked) ? linked[0] : linked) as Record<string, unknown> | undefined;
    const label = workDisplayTitleJa(row);
    return label ? { id: String(item.id || row?.id || index), label, meta: item.role ? String(item.role) : null } : null;
  }).filter((item): item is { id: string; label: string; meta: string | null } => Boolean(item));
}

function linkedWorkTitles(value: unknown) {
  return ((value || []) as Array<Record<string, unknown>>).map((item) => {
    const linked = item.works; const record = Array.isArray(linked) ? linked[0] : linked;
    return workDisplayTitleJa(record);
  }).filter((title): title is string => Boolean(title));
}

function FieldInput({ field, value }: { field: MasterField; value: unknown }) {
  const className = `field${field.full ? " full" : ""}`;
  const text = inputValue(field, value);
  if (field.type === "textarea") return <div className={className}><AdminFieldLabel htmlFor={field.key} label={field.label} fieldKey={field.key}/><textarea id={field.key} name={field.key} defaultValue={text}/><small>{text ? "" : "未設定"}</small></div>;
  if (field.type === "select") return <div className={className}><AdminFieldLabel htmlFor={field.key} label={field.label} fieldKey={field.key}/><select id={field.key} name={field.key} defaultValue={text || field.options?.[0]}>{field.options?.map((option) => <option key={option}>{option}</option>)}</select></div>;
  if (field.type === "boolean") return <div className={className}><AdminFieldLabel htmlFor={field.key} label={field.label} fieldKey={field.key}/><select id={field.key} name={field.key} defaultValue={String(value ?? true)}><option value="true">true</option><option value="false">false</option></select></div>;
  return <div className={className}><AdminFieldLabel htmlFor={field.key} label={field.label} fieldKey={field.key}/><input id={field.key} name={field.key} required={field.required} type={field.type === "url" ? "url" : field.type === "date" ? "date" : ["year", "number"].includes(field.type) ? "number" : "text"} step={field.type === "number" ? "any" : undefined} defaultValue={text}/><small>{text ? "" : "未設定"}</small></div>;
}

const REQUIREMENT_LABELS: Record<string, string> = {
  name: "名称",
  name_en: "英語名",
  nationality: "国籍",
  image: "画像",
  address: "住所",
  coordinates: "位置情報",
  description: "概要",
  opening_hours_text: "開館時間",
  title: "タイトル",
  artist: "Artist Relation",
  holding: "Holding Venue Relation",
};

function ImageAvailability({ current }: { current: string }) {
  return <div className="availability-chips" aria-label={`画像状態: ${current}`}>{MASTER_IMAGE_STATES.map((state) => <span className={`availability-chip${state === current ? " is-current" : ""}`} aria-current={state === current ? "true" : undefined} key={state}>{state === current ? "✓ " : ""}{state}</span>)}</div>;
}

export type MasterEditSection = "all" | "basic" | "image" | "relations";

export function MasterEditor({ entity, record, mode = "edit", view = "all", editSection = "all", embeddedInList = false, onOpenImageCandidate, onCreated }: { entity: MasterEntity; record?: DetailRecord; mode?: "new" | "edit"; view?: "all" | "status" | "edit" | "data"; editSection?: MasterEditSection; embeddedInList?: boolean; onOpenImageCandidate?: (candidateId: string | null) => void; onCreated?: (id: string) => void }) {
  const router = useRouter(); const config = MASTER_CONFIGS[entity];
  const [busy, setBusy] = useState(false); const [message, setMessage] = useState("");
  async function request(url: string, init: RequestInit, options: { preserveListOrder?: boolean } = {}) {
    setBusy(true); setMessage("");
    try {
      const response = await fetch(url, init); const body = await response.json();
      if (!response.ok) throw new Error(body.error || "Request failed");
      setMessage(body.message || "完了しました。");
      window.dispatchEvent(new CustomEvent("muuzee:master-updated", {
        detail: { entity, id: record?.id, preserveListOrder: Boolean(options.preserveListOrder) },
      }));
      return body;
    }
    catch (error) { setMessage(error instanceof Error ? error.message : "Request failed"); return null; }
    finally { setBusy(false); }
  }
  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); const values = Object.fromEntries(new FormData(event.currentTarget));
    const url = mode === "new" ? `/api/admin/masters/${entity}` : `/api/admin/masters/${entity}/${record!.id}`;
    const body = await request(url, { method: mode === "new" ? "POST" : "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(values) });
    if (!body) return;
    if (mode === "new") {
      if (onCreated) onCreated(String(body.id));
      else router.push(`/admin/${entity}/${body.id}`);
    } else if (!embeddedInList) router.refresh();
  }
  async function publication(action: "publish" | "unpublish") {
    if (!record) return; const body = await request(`/api/admin/masters/${entity}/${record.id}/publication`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action }) }); if (body && !embeddedInList) router.refresh();
  }
  async function remove() {
    if (!record || !window.confirm(`${String(record[config.titleKey])}を削除しますか？ 関連データがある場合は削除されません。`)) return;
    const body = await request(`/api/admin/masters/${entity}/${record.id}`, { method: "DELETE" }); if (body) router.push(`/admin/${entity}`);
  }
  async function upload(form: FormData) {
    if (!record) return; const body = await request(`/api/admin/masters/${entity}/${record.id}/media`, { method: "POST", body: form }, { preserveListOrder: true });
    if (body?.asset) dispatchAdminMediaMutation({ entity, ownerId: record.id, asset: body.asset as MediaAssetRow });
    if (body && !embeddedInList) router.refresh();
  }
  async function removeMedia(id: string) {
    if (!record || !window.confirm("画像を削除しますか？")) return; const body = await request(`/api/admin/masters/${entity}/${record.id}/media/${id}`, { method: "DELETE" }, { preserveListOrder: true });
    if (body?.removedAssetId) dispatchAdminMediaMutation({ entity, ownerId: record.id, removedAssetId: String(body.removedAssetId) });
    if (body && !embeddedInList) router.refresh();
  }
  async function setCandidatePrimary(id: string) {
    if (!record) return;
    const body = await request(`/api/admin/masters/${entity}/${record.id}/image-candidates/${id}/set-primary`, { method: "POST" }, { preserveListOrder: true });
    if (body?.asset) dispatchAdminMediaMutation({ entity, ownerId: record.id, asset: body.asset as MediaAssetRow });
    if (body && !embeddedInList) router.refresh();
  }
  const sources = record ? (record[config.provenanceTable] || []) as Array<Record<string, unknown>> : [];
  const external = record ? (record.source_records || []) as Array<Record<string, unknown>> : [];
  const candidates = external.flatMap((source) => (source.source_image_candidates || []) as Array<Record<string, unknown>>);
  const selectableCandidates = candidates.filter((candidate) => candidate.is_active !== false && candidate.review_status !== "rejected" && candidate.rights_status !== "rejected");
  const editableFields = config.fields.filter((field) => field.key !== "publication_status");
  const publicationRequirements = new Set(config.publicationRequirements);
  const imageState = record ? masterImageState(record) : "未取得";
  return <>
    {record && (view === "all" || view === "status") && <><section className="card publication-status-card"><div><AdminFieldLabel label="公開状態" fieldKey="publication_status"/></div><div className="publication-status-actions"><PublicationToggle checked={record.publication_status === "published"} busy={busy} onChange={(next) => publication(next ? "publish" : "unpublish")}/><AdminDeleteButton disabled={busy} onClick={remove}/></div></section><section className="card admin-state-summary"><h2>コンテンツ状態</h2><dl>{entity === "artists" && <div><dt>優先度</dt><dd><span className={`tier-badge tier-${String(effectiveArtistTier(record) || "").toLowerCase()}`}>Tier {effectiveArtistTier(record) || "未分類"}</span></dd></div>}<div><dt>画像状態</dt><dd><ImageAvailability current={imageState}/></dd></div><div><dt>外部データ</dt><dd>{["venues", "artists"].includes(entity) ? <AdminExternalSourceSummary sourceRecords={external} provenance={sources}/> : external.length ? "あり" : "なし"}</dd></div>{entity === "venues" && <div><dt>位置情報</dt><dd><span className="availability-chip is-current">✓ {venuePositionState(record)}</span></dd></div>}</dl><ul className="requirements">{record.completeness.items.map((item) => { const required = publicationRequirements.has(item.key); return <li className={item.met ? "met" : required ? "required-missing" : "optional-missing"} key={item.key}>{item.met ? "✓ " : ""}{REQUIREMENT_LABELS[item.key] || item.label}</li>; })}</ul></section></>}
    {(view === "all" || view === "edit") && (editSection === "all" || editSection === "basic") && <form className={`card${entity === "artists" && mode === "edit" ? " artist-basic-form" : ""}`} onSubmit={save}><h2>{mode === "new" ? `${config.label}を追加` : "基本情報"}</h2>{mode === "new" && <p className="notice">新規レコードは必ず非公開で作成され、入力値はManual provenanceとして記録されます。</p>}<div className="form-grid">{editableFields.map((field) => <FieldInput key={field.key} field={field} value={record?.[field.key]}/>)}</div><div className="actions"><button className="button" disabled={busy}>{mode === "new" ? "非公開で作成" : "保存"}</button></div></form>}
    {record && entity !== "venues" && (view === "all" || view === "edit") && (editSection === "all" || editSection === "image") && <AdminImageManager entity={entity} ownerId={record.id} subjectLabel={String(record[config.titleKey] || config.label)} initialAssets={record.media_assets as MediaAssetRow[] | undefined} busy={busy} candidates={selectableCandidates as unknown as SourceImageCandidateRow[]} onUpload={upload} onRemove={(asset) => removeMedia(asset.id)} onOpenImageCandidate={onOpenImageCandidate} onSetPrimary={(candidate) => setCandidatePrimary(candidate.id)}/>}
    {record && entity !== "artists" && (view === "all" || view === "data") && <section><h2>Field Provenance（項目の出典履歴）</h2><div className="table-wrap"><table><thead><tr><th>Field（項目）</th><th>Source（出典）</th><th>Source URL</th><th>Current（現行）</th><th>Updated（更新日時）</th></tr></thead><tbody>{sources.map((source) => <tr key={String(source.id)}><td>{String(source.field_name)}</td><td>{displayStatus(source.source)}</td><td>{source.source_url ? <a href={String(source.source_url)} target="_blank" rel="noreferrer">データ元を開く ↗</a> : "—"}</td><td>{source.is_current ? "Current（現行）" : "History（履歴）"}</td><td>{source.updated_at ? new Date(String(source.updated_at)).toLocaleString("ja-JP") : "未設定"}</td></tr>)}{!sources.length && <tr><td colSpan={5} className="empty-state">Field provenanceはまだありません。</td></tr>}</tbody></table></div></section>}
    {record && entity !== "artists" && (view === "all" || view === "data") && <section><h2>External Sources（外部データソース）</h2><div className="card">{external.map((source) => <p key={String(source.id)}><strong>{String(source.external_id || "Source")}</strong> · {source.source_url ? <a href={String(source.source_url)} target="_blank" rel="noreferrer">データ元を開く ↗</a> : "URL未設定"}</p>)}{!external.length && <p className="empty-state">外部Source recordはありません。</p>}</div></section>}
    {record && entity === "artists" && (view === "all" || view === "edit") && (editSection === "all" || editSection === "relations") && <div className="artist-relation-groups"><AdminRelationList title="関連展覧会" items={linkedRelationItems(record.exhibition_artists, "exhibitions", "title", "role")} emptyLabel="関連展覧会はありません。"/><AdminRelationList title="関連作品" items={linkedWorkItems(record.work_artists)} emptyLabel="関連作品はありません。"/></div>}
    {record && entity === "venues" && (view === "all" || view === "edit") && <section><h2>Holdings（所蔵作品）</h2><div className="card"><p>{linkedWorkTitles(record.collection_holdings).join(" / ") || "未設定"}</p></div></section>}
    {record && entity === "venues" && (view === "all" || view === "edit") && <section><h2>Related Exhibitions（関連展覧会）</h2><div className="card"><p>{linkedValue(record.exhibition_occurrences, "exhibitions", "title").join(" / ") || "未設定"}</p></div></section>}
    {message && <div className={message.includes("失敗") || message.includes("不足") || message.includes("削除できません") ? "error" : "notice"}>{message}</div>}
  </>;
}
