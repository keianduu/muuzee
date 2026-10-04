"use client";

/* eslint-disable @next/next/no-img-element */

import type { SourceImageCandidateRow } from "@/lib/admin/types";
import { candidateLicenseProfile, imageDiscoverySourceLabel } from "@/lib/admin/master-image";
import { AdminFeedback } from "./admin-feedback";
import { useState } from "react";

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

export function MasterImageCandidateCard({ candidate, subjectLabel, busy, onSetPrimary }: {
  candidate: SourceImageCandidateRow;
  subjectLabel: string;
  busy: boolean;
  onSetPrimary: () => void;
}) {
  const disabled = busy || candidate.rights_status === "rejected" || candidate.review_status === "rejected" || !candidate.is_active;
  const match = candidateMatchSummary(candidate);
  return <article className="card media-card">
    {candidate.thumbnail_url || candidate.image_url ? <img src={candidate.thumbnail_url || candidate.image_url} alt={`${subjectLabel} image candidate`}/> : <div className="thumb"/>}
    <p><span className="status">取得経路: {imageDiscoverySourceLabel(candidate.discovery_source)}</span></p>
    <p className="muted"><strong>Provider:</strong> {candidate.provider || "記載なし"}</p>
    <p><span className="status">{candidate.review_status}</span> <span className={`status ${candidate.rights_status}`}>{candidate.rights_status === "approved" ? "明確に利用可能" : candidate.rights_status === "rejected" ? "明確に不可" : "記載なし・不明"}</span></p>
    <p><strong>Reported License: {candidate.license_short_name || "記載なし"}</strong></p>
    {(candidate.candidate_match_confidence != null || candidate.candidate_match_threshold != null) && <p className="muted"><strong>照合:</strong> {match.match}<br/><strong>探索深度:</strong> {match.depth}</p>}
    <LicenseSummary candidate={candidate}/>
    <p className="muted"><strong>Author:</strong> {candidate.author || "記載なし"}<br/><strong>Credit:</strong> {candidate.credit || "記載なし"}<br/><strong>Usage terms:</strong> {candidate.usage_terms || "記載なし"}{candidate.source_url && <><br/><a className="candidate-source-link" href={candidate.source_url} target="_blank" rel="noreferrer">データ元 ↗</a></>}</p>
    <div className="actions"><button type="button" className="button warning" disabled={disabled} onClick={onSetPrimary}>この画像を設定</button></div>
    {candidate.rights_status === "rejected" && <p className="muted">明確に利用不可と記録された候補は設定できません。</p>}
  </article>;
}

export function MasterImageCandidatePicker({ venueId, candidates, subjectLabel, onSelected }: {
  venueId: string;
  candidates: SourceImageCandidateRow[];
  subjectLabel: string;
  onSelected: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  async function select(candidate: SourceImageCandidateRow) {
    setBusy(true); setMessage("");
    try {
      const response = await fetch(`/api/admin/venues/${venueId}/image-candidates/${candidate.id}/set-primary`, { method: "POST" });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "候補画像の設定に失敗しました。");
      window.dispatchEvent(new CustomEvent("muuzee:master-updated", { detail: { entity: "venues", id: venueId, preserveListOrder: true } }));
      onSelected();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "候補画像の設定に失敗しました。");
    } finally { setBusy(false); }
  }
  return <div className="candidate-picker"><p className="candidate-picker-count">選択できる候補 {candidates.length}件</p><div className="media-grid">{candidates.map((candidate) => <MasterImageCandidateCard key={candidate.id} candidate={candidate} subjectLabel={subjectLabel} busy={busy} onSetPrimary={() => select(candidate)}/>)}</div><AdminFeedback variant="error" message={message}/></div>;
}
