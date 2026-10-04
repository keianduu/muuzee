"use client";

/* eslint-disable @next/next/no-img-element */

import type { SourceImageCandidateRow } from "@/lib/admin/types";
import { candidateLicenseProfile, imageDiscoverySourceLabel } from "@/lib/admin/master-image";

function candidateMatchSummary(candidate: SourceImageCandidateRow) {
  const confirmedQid = candidate.candidate_match_confidence === 1 && /^Q\d+$/.test(candidate.candidate_entity_id || "");
  return {
    match: confirmedQid ? `確定QID · ${candidate.candidate_entity_id}` : candidate.candidate_match_confidence != null ? `一致度 ${candidate.candidate_match_confidence}` : "記録なし",
    depth: confirmedQid ? "確定QID" : candidate.candidate_match_threshold != null ? String(candidate.candidate_match_threshold) : "記録なし",
  };
}

export function LicenseSummary({ candidate }: { candidate: SourceImageCandidateRow }) {
  const profile = candidateLicenseProfile(candidate as unknown as Record<string, unknown>);
  return <div className="license-summary" aria-label="ライセンス条件の整理">
    <span>ライセンス</span><strong>{profile.license}</strong><span>利用可否</span><strong>{profile.usage}</strong>
    <span>商用利用</span><strong>{profile.commercialUse}</strong><span>加工・トリミング</span><strong>{profile.modification}</strong>
    <span>クレジット表記</span><strong>{profile.attribution}</strong><span>同一ライセンス継承</span><strong>{profile.shareAlike}</strong>
    {!profile.recognized && <><span>判定</span><strong>ライセンス原文を要確認</strong></>}
  </div>;
}

export function MasterImageCandidateSummary({ candidate, subjectLabel, onOpen }: {
  candidate: SourceImageCandidateRow;
  subjectLabel: string;
  onOpen: () => void;
}) {
  return <article className="image-candidate-summary">
    {candidate.thumbnail_url || candidate.image_url ? <img src={candidate.thumbnail_url || candidate.image_url} alt={`${subjectLabel} image candidate`}/> : <div className="thumb"/>}
    <div><p><strong>{imageDiscoverySourceLabel(candidate.discovery_source)}</strong></p><p><span className="status">{candidate.review_status}</span> <span className={`status ${candidate.rights_status}`}>{candidate.rights_status}</span></p><p className="muted">{candidate.license_short_name || "ライセンス記載なし"}</p></div>
    <button type="button" className="button secondary" onClick={onOpen}>候補を確認</button>
  </article>;
}

export function MasterImageCandidatePanel({ candidate, subjectLabel }: { candidate: SourceImageCandidateRow; subjectLabel: string }) {
  const match = candidateMatchSummary(candidate);
  return <div className="image-candidate-panel">
    {candidate.thumbnail_url || candidate.image_url ? <img className="image-candidate-preview" src={candidate.thumbnail_url || candidate.image_url} alt={`${subjectLabel} image candidate`}/> : <div className="image-candidate-preview is-empty">画像なし</div>}
    <div className="image-candidate-panel-status"><span className="status">取得経路: {imageDiscoverySourceLabel(candidate.discovery_source)}</span><span className="status">{candidate.review_status}</span><span className={`status ${candidate.rights_status}`}>{candidate.rights_status}</span></div>
    <LicenseSummary candidate={candidate}/>
    <dl className="image-candidate-metadata"><div><dt>照合</dt><dd>{match.match}</dd></div><div><dt>探索深度</dt><dd>{match.depth}</dd></div></dl>
    <dl className="image-candidate-metadata"><div><dt>Author</dt><dd>{candidate.author || "記載なし"}</dd></div><div><dt>Credit</dt><dd>{candidate.credit || "記載なし"}</dd></div><div><dt>Usage terms</dt><dd>{candidate.usage_terms || "記載なし"}</dd></div></dl>
    <div className="actions">{candidate.source_url && <a className="button secondary" href={candidate.source_url} target="_blank" rel="noreferrer">データ元を開く ↗</a>}{candidate.license_url && <a className="button secondary" href={candidate.license_url} target="_blank" rel="noreferrer">利用条件を開く ↗</a>}</div>
    <p className="muted">候補の採否・Primary設定は、Venue Drawerの編集タブで行います。</p>
  </div>;
}

export function MasterImageCandidateCard({ candidate, subjectLabel, busy, primaryExists, onSetPrimary, onAccept, onReject, onOpen }: {
  candidate: SourceImageCandidateRow;
  subjectLabel: string;
  busy: boolean;
  primaryExists?: boolean;
  onSetPrimary: () => void;
  onAccept?: () => void;
  onReject?: () => void;
  onOpen?: () => void;
}) {
  const disabled = busy || primaryExists || candidate.rights_status === "rejected" || candidate.review_status === "rejected" || !candidate.is_active;
  const match = candidateMatchSummary(candidate);
  return <article className="card media-card">
    {candidate.thumbnail_url || candidate.image_url ? <img src={candidate.thumbnail_url || candidate.image_url} alt={`${subjectLabel} image candidate`}/> : <div className="thumb"/>}
    <p><span className="status">取得経路: {imageDiscoverySourceLabel(candidate.discovery_source)}</span></p>
    <p className="muted"><strong>Provider:</strong> {candidate.provider || "記載なし"}</p>
    <p><span className="status">{candidate.review_status}</span> <span className={`status ${candidate.rights_status}`}>{candidate.rights_status === "approved" ? "明確に利用可能" : candidate.rights_status === "rejected" ? "明確に不可" : "記載なし・不明"}</span></p>
    <p><strong>Reported License: {candidate.license_short_name || "記載なし"}</strong></p>
    {(candidate.candidate_match_confidence != null || candidate.candidate_match_threshold != null) && <p className="muted"><strong>照合:</strong> {match.match}<br/><strong>探索深度:</strong> {match.depth}</p>}
    <LicenseSummary candidate={candidate}/>
    <details><summary>著作者・クレジット・データ元</summary><p className="muted"><strong>Author:</strong> {candidate.author || "記載なし"}<br/><strong>Credit:</strong> {candidate.credit || "記載なし"}<br/><strong>Usage terms:</strong> {candidate.usage_terms || "記載なし"}</p></details>
    <div className="actions">{onOpen && <button type="button" className="button secondary" onClick={onOpen}>候補を確認</button>}{candidate.source_url && <a className="button secondary" href={candidate.source_url} target="_blank" rel="noreferrer">データ元を開く</a>}{candidate.license_url && <a className="button secondary" href={candidate.license_url} target="_blank" rel="noreferrer">利用条件を開く</a>}</div>
    {(onAccept || onReject) && <><h3>画像候補の判断</h3><div className="actions">{onAccept && <button type="button" className="button secondary" disabled={busy} onClick={onAccept}>候補として残す</button>}{onReject && <button type="button" className="button danger" disabled={busy} onClick={onReject}>候補から除外</button>}</div></>}
    <h3>Primary画像</h3><div className="actions"><button type="button" className="button" disabled={disabled} onClick={onSetPrimary}>この画像を設定</button></div>
    {primaryExists && <p className="muted">既存Primaryは自動で上書きしません。</p>}
    {candidate.rights_status === "rejected" && <p className="muted">明確に利用不可と記録された候補は設定できません。</p>}
  </article>;
}
