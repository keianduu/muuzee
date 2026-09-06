"use client";

/* eslint-disable @next/next/no-img-element */

import { useRouter } from "next/navigation";
import { useState } from "react";
import { MASTER_CONFIGS, type MasterEntity, type MasterField } from "@/lib/admin/master-config";
import type { MasterRecord } from "@/lib/admin/master-repository";
import { displayStatus } from "@/lib/admin/master-labels";
import { MasterImageCandidateCard } from "./master-image-candidate";
import type { SourceImageCandidateRow } from "@/lib/admin/types";
import { artistImageStatus, effectiveArtistTier } from "@/lib/admin/artist-priority";
import { workDisplayTitleJa } from "@/lib/work-title";

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

function linkedWorkTitles(value: unknown) {
  return ((value || []) as Array<Record<string, unknown>>).map((item) => {
    const linked = item.works; const record = Array.isArray(linked) ? linked[0] : linked;
    return workDisplayTitleJa(record);
  }).filter((title): title is string => Boolean(title));
}

function FieldInput({ field, value }: { field: MasterField; value: unknown }) {
  const className = `field${field.full ? " full" : ""}`;
  const text = inputValue(field, value);
  if (field.type === "textarea") return <div className={className}><label htmlFor={field.key}>{field.label}</label><textarea id={field.key} name={field.key} defaultValue={text}/><small>{text ? "" : "未設定"}</small></div>;
  if (field.type === "select") return <div className={className}><label htmlFor={field.key}>{field.label}</label><select id={field.key} name={field.key} defaultValue={text || field.options?.[0]}>{field.options?.map((option) => <option key={option}>{option}</option>)}</select></div>;
  if (field.type === "boolean") return <div className={className}><label htmlFor={field.key}>{field.label}</label><select id={field.key} name={field.key} defaultValue={String(value ?? true)}><option value="true">true</option><option value="false">false</option></select></div>;
  return <div className={className}><label htmlFor={field.key}>{field.label}</label><input id={field.key} name={field.key} required={field.required} type={field.type === "url" ? "url" : field.type === "date" ? "date" : ["year", "number"].includes(field.type) ? "number" : "text"} step={field.type === "number" ? "any" : undefined} defaultValue={text}/><small>{text ? "" : "未設定"}</small></div>;
}

export function MasterEditor({ entity, record, mode = "edit", view = "all", embeddedInList = false }: { entity: MasterEntity; record?: DetailRecord; mode?: "new" | "edit"; view?: "all" | "status" | "edit" | "data"; embeddedInList?: boolean }) {
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
    if (mode === "new") router.push(`/admin/${entity}/${body.id}`); else if (!embeddedInList) router.refresh();
  }
  async function publication(action: "publish" | "unpublish") {
    if (!record) return; const body = await request(`/api/admin/masters/${entity}/${record.id}/publication`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action }) }); if (body && !embeddedInList) router.refresh();
  }
  async function remove() {
    if (!record || !window.confirm(`${String(record[config.titleKey])}を削除しますか？ 関連データがある場合は削除されません。`)) return;
    const body = await request(`/api/admin/masters/${entity}/${record.id}`, { method: "DELETE" }); if (body) router.push(`/admin/${entity}`);
  }
  async function upload(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (!record) return; const body = await request(`/api/admin/masters/${entity}/${record.id}/media`, { method: "POST", body: new FormData(event.currentTarget) }); if (body && !embeddedInList) router.refresh();
  }
  async function removeMedia(id: string) {
    if (!record || !window.confirm("画像を削除しますか？")) return; const body = await request(`/api/admin/masters/${entity}/${record.id}/media/${id}`, { method: "DELETE" }); if (body && !embeddedInList) router.refresh();
  }
  async function setCandidatePrimary(id: string) {
    if (!record) return;
    const body = await request(`/api/admin/masters/${entity}/${record.id}/image-candidates/${id}/set-primary`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ replaceExisting: false }) }, { preserveListOrder: true });
    if (body && !embeddedInList) router.refresh();
  }
  const sources = record ? (record[config.provenanceTable] || []) as Array<Record<string, unknown>> : [];
  const external = record ? (record.source_records || []) as Array<Record<string, unknown>> : [];
  const assets = record ? (record.media_assets || []) as Array<Record<string, unknown>> : [];
  const candidates = external.flatMap((source) => (source.source_image_candidates || []) as Array<Record<string, unknown>>);
  const editableFields = config.fields.filter((field) => field.key !== "publication_status");
  const primaryAsset = assets.find((asset) => asset.is_primary);
  const missingFields = record?.completeness.items.filter((item) => !item.met).map((item) => item.label) || [];
  const artistQuality = record && entity === "artists" ? [{ label: "Name", met: Boolean(record.name) }, { label: "Name EN", met: Boolean(record.name_en) }, { label: "Nationality", met: Boolean(record.nationality_country_code) }, { label: "Primary Image", met: Boolean(primaryAsset) }] : [];
  return <>
    {record && (view === "all" || view === "status") && <><section className="detail-status card"><div><strong>Publication Status（公開状態）</strong><p><span className={`status ${record.publication_status}`}>{displayStatus(record.publication_status)}</span></p></div><div className="actions"><button className="button" disabled={busy || record.publication_status === "published"} onClick={() => publication("publish")}>Publish（公開）</button><button className="button secondary" disabled={busy || record.publication_status !== "published"} onClick={() => publication("unpublish")}>Unpublish（非公開）</button><button className="button danger" disabled={busy} onClick={remove}>Delete（削除）</button></div></section>{entity === "artists" && <section className="card"><h2>Artist Quality</h2><div className="preview-counts"><span className={`tier-badge tier-${String(effectiveArtistTier(record) || "").toLowerCase()}`}>Tier {effectiveArtistTier(record) || "未分類"}</span><span className="status">{artistImageStatus(record)}</span><span className="status">Nationality {record.nationality_country_code ? String(record.nationality_country_code) : "Missing"}</span></div><p><strong>{artistQuality.filter((item) => item.met).length} / 4</strong> · {Math.round(artistQuality.filter((item) => item.met).length / 4 * 100)}%</p><ul className="requirements">{artistQuality.map((item) => <li className={item.met ? "met" : ""} key={item.label}>{item.met ? "✓" : "–"} {item.label}</li>)}</ul></section>}<section className="card admin-state-summary"><h2>Content Status（コンテンツ状態）</h2><dl><div><dt>Completeness（情報充足率）</dt><dd>{record.completeness.percent}%</dd></div><div><dt>Image Status（画像状態）</dt><dd>{entity === "artists" ? artistImageStatus(record) : primaryAsset ? "Primary画像あり" : candidates.length ? `Candidate ${candidates.length}件` : "画像なし"}</dd></div><div><dt>Rights Status（権利確認）</dt><dd>{primaryAsset ? displayStatus(primaryAsset.rights_status) : "未確認"}</dd></div><div><dt>Source Status（出典状態）</dt><dd>{external.length ? `${external.length} source record` : "外部Sourceなし"}</dd></div><div><dt>Missing Fields（不足項目）</dt><dd>{missingFields.join(" / ") || "なし"}</dd></div></dl><ul className="requirements">{record.completeness.items.map((item) => <li className={item.met ? "met" : ""} key={item.key}>{item.met ? "✓" : "○"} {item.label}</li>)}</ul></section></>}
    {(view === "all" || view === "edit") && <form className="card" onSubmit={save}><h2>{mode === "new" ? `New ${config.label}` : "Basic Information（基本情報）"}</h2>{mode === "new" && <p className="notice">新規レコードは必ずDraftで作成され、入力値はManual provenanceとして記録されます。</p>}<div className="form-grid">{editableFields.map((field) => <FieldInput key={field.key} field={field} value={record?.[field.key]}/>)}</div><div className="actions"><button className="button" disabled={busy}>{mode === "new" ? "Create Draft（下書きを作成）" : "Save（保存）"}</button></div></form>}
    {record && entity !== "venues" && (view === "all" || view === "edit") && <section><h2>Images / Rights（画像・権利）</h2><div className="media-grid">{assets.map((asset) => <article className="card media-card" key={String(asset.id)}>{asset.signedUrl ? <img src={String(asset.signedUrl)} alt=""/> : <div className="thumb"/>}<p><strong>{String(asset.original_filename || "Image")}</strong><br/><span className={`status ${String(asset.rights_status)}`}>{displayStatus(asset.rights_status)}</span>{asset.is_primary ? <> <span className="status approved">Primary（メイン）</span></> : null}</p><button className="button danger" disabled={busy} onClick={() => removeMedia(String(asset.id))}>Delete image（画像削除）</button></article>)}{candidates.map((candidate) => <MasterImageCandidateCard key={String(candidate.id)} candidate={candidate as unknown as SourceImageCandidateRow} subjectLabel={String(record[config.titleKey] || config.label)} busy={busy} primaryExists={Boolean(primaryAsset)} onSetPrimary={() => setCandidatePrimary(String(candidate.id))}/>)}{!assets.length && !candidates.length && <p className="empty-state">画像・Candidateはありません。</p>}</div><form className="card" onSubmit={upload}><h3>Upload Image（画像アップロード）</h3><div className="form-grid"><div className="field full"><label>Image（画像）</label><input name="file" type="file" accept="image/jpeg,image/png,image/webp,image/gif" required/></div><div className="field"><label>Source Type（出典種別）</label><select name="source_type" defaultValue="other"><option>official_press</option><option>open_collection</option><option>wikimedia</option><option>direct</option><option>other</option></select></div><div className="field"><label>Rights（利用可否）</label><select name="rights_status" defaultValue="needs_review"><option value="rejected">明確に不可</option><option value="needs_review">記載なし・不明</option><option value="approved">明確に利用可能</option></select></div><div className="field full"><label>Source URL（任意）</label><input name="source_url" type="url"/></div><div className="field"><label>Credit（任意）</label><input name="credit"/></div><div className="field"><label>Primary（メイン画像）</label><select name="is_primary" defaultValue="false"><option value="false">No</option><option value="true">Yes</option></select></div><div className="field full"><label>Usage Note（任意）</label><textarea name="usage_note"/></div></div><div className="actions"><button className="button" disabled={busy}>Upload（アップロード）</button></div></form></section>}
    {record && (view === "all" || view === "data") && <section><h2>Field Provenance（項目の出典履歴）</h2><div className="table-wrap"><table><thead><tr><th>Field（項目）</th><th>Source（出典）</th><th>Source URL</th><th>Current（現行）</th><th>Updated（更新日時）</th></tr></thead><tbody>{sources.map((source) => <tr key={String(source.id)}><td>{String(source.field_name)}</td><td>{displayStatus(source.source)}</td><td>{source.source_url ? <a href={String(source.source_url)} target="_blank" rel="noreferrer">Open ↗</a> : "—"}</td><td>{source.is_current ? "Current（現行）" : "History（履歴）"}</td><td>{source.updated_at ? new Date(String(source.updated_at)).toLocaleString("ja-JP") : "未設定"}</td></tr>)}{!sources.length && <tr><td colSpan={5} className="empty-state">Field provenanceはまだありません。</td></tr>}</tbody></table></div></section>}
    {record && (view === "all" || view === "data") && <section><h2>External Sources（外部データソース）</h2><div className="card">{external.map((source) => <p key={String(source.id)}><strong>{String(source.external_id || "Source")}</strong> · {source.source_url ? <a href={String(source.source_url)} target="_blank" rel="noreferrer">Source URL（出典を開く）</a> : "URL未設定"}</p>)}{!external.length && <p className="empty-state">外部Source recordはありません。</p>}</div></section>}
    {record && entity === "artists" && (view === "all" || view === "data") && <section><h2>Source Diagnostics（外部Source診断）</h2><div className="card"><h3>Wikidata / Wikipedia</h3>{external.filter((source) => /^Q\d+$/.test(String(source.external_id || ""))).map((source) => { const payload = source.raw_payload as { classification?: Record<string, unknown> } | undefined; return <details key={String(source.id)}><summary>{String(source.external_id)}</summary><pre>{JSON.stringify(payload?.classification || {}, null, 2)}</pre></details>; })}{!external.some((source) => /^Q\d+$/.test(String(source.external_id || ""))) && <p className="empty-state">Wikidata QIDは未設定です。</p>}<h3>Getty ULAN / APJ DAJ</h3><p className="notice">現在はLOCAL Coverage Testのみです。DB Import、Field Provenance適用、Full Syncは未実装です。実測結果は <code>docs/research/artist-source-coverage.md</code> を参照してください。</p><h3>Image Discovery</h3><div className="table-wrap"><table><thead><tr><th>Source</th><th>File</th><th>License</th><th>Rights</th></tr></thead><tbody>{candidates.map((candidate) => <tr key={String(candidate.id)}><td>{String(candidate.discovery_source || "unknown")}</td><td>{candidate.source_url ? <a href={String(candidate.source_url)} target="_blank" rel="noreferrer">{String(candidate.stable_identifier || "Open")}</a> : String(candidate.stable_identifier || "—")}</td><td>{String(candidate.license_short_name || "不明")}</td><td>{displayStatus(candidate.rights_status)}</td></tr>)}{!candidates.length && <tr><td colSpan={4} className="empty-state">画像探索結果はありません。</td></tr>}</tbody></table></div></div></section>}
    {record && entity === "artists" && (view === "all" || view === "edit") && <section><h2>Relations（関連データ）</h2><div className="card"><p><strong>Exhibitions（展覧会）</strong>: {linkedValue(record.exhibition_artists, "exhibitions", "title").join(" / ") || "未設定"}</p><p><strong>Works（作品）</strong>: {linkedWorkTitles(record.work_artists).join(" / ") || "未設定"}</p></div></section>}
    {record && entity === "venues" && (view === "all" || view === "edit") && <section><h2>Holdings（所蔵作品）</h2><div className="card"><p>{linkedWorkTitles(record.collection_holdings).join(" / ") || "未設定"}</p></div></section>}
    {record && entity === "venues" && (view === "all" || view === "edit") && <section><h2>Related Exhibitions（関連展覧会）</h2><div className="card"><p>{linkedValue(record.exhibition_occurrences, "exhibitions", "title").join(" / ") || "未設定"}</p></div></section>}
    {message && <div className={message.includes("失敗") || message.includes("不足") || message.includes("削除できません") ? "error" : "notice"}>{message}</div>}
  </>;
}
