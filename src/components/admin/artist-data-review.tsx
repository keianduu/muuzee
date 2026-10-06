"use client";

import { useState } from "react";
import { MASTER_CONFIGS } from "@/lib/admin/master-config";
import { adminSourceLabel } from "@/lib/admin/data-review";
import { AdminDataReview, AdminDataSection, AdminProvenanceSummary } from "./admin-data-review";
import { AdminFeedback } from "./admin-feedback";

type ArtistSourceRecord = Record<string, unknown> & {
  data_sources?: { key?: string; name?: string } | Array<{ key?: string; name?: string }> | null;
};

type ArtistMatchCandidate = Record<string, unknown> & {
  id: string;
  provider: string;
  external_id: string;
  label_ja?: string | null;
  label_en?: string | null;
  birth_year?: number | null;
  confidence?: number | null;
  status: "candidate" | "matched" | "rejected";
};

function sourceKeys(source: ArtistSourceRecord) {
  const dataSources = Array.isArray(source.data_sources) ? source.data_sources : source.data_sources ? [source.data_sources] : [];
  return dataSources.map((item) => String(item.key || "")).filter(Boolean);
}

function qidLink(qid: string) {
  return /^Q\d+$/.test(qid) ? `https://www.wikidata.org/wiki/${qid}` : null;
}

export function ArtistDataReview({ artist }: { artist: Record<string, unknown> & { id: string } }) {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [messageVariant, setMessageVariant] = useState<"success" | "error">("success");
  const sources = (artist.source_records || []) as ArtistSourceRecord[];
  const candidates = ((artist.artist_external_match_candidates || []) as ArtistMatchCandidate[])
    .filter((candidate) => candidate.provider === "wikidata")
    .sort((left, right) => Number(right.confidence || 0) - Number(left.confidence || 0));
  const linkedWikidata = sources.find((source) => sourceKeys(source).includes("wikidata") && qidLink(String(source.external_id || "")));
  const matchedCandidate = candidates.find((candidate) => candidate.status === "matched");
  const wikidataId = String(matchedCandidate?.external_id || linkedWikidata?.external_id || "");
  const wikidataUrl = qidLink(wikidataId);
  const pendingCandidates = candidates.filter((candidate) => candidate.status === "candidate");
  const provenanceFields = MASTER_CONFIGS.artists.fields
    .filter((field) => field.key !== "publication_status")
    .map((field) => [field.key, field.label] as const);
  const provenance = (artist.artist_field_sources || []) as Array<{ field_name: string; source?: string | null; source_url?: string | null; is_current?: boolean }>;
  const sourceStatus = [
    ["wikidata", "Wikidata"],
    ["wikipedia", "Wikipedia"],
    ["apj_daj", "APJ DAJ"],
    ["getty_ulan", "Getty ULAN"],
    ["official_website", "公式サイト"],
  ] as const;

  async function enrichFromWikipedia() {
    setBusy(true); setMessage(""); setMessageVariant("success");
    try {
      const response = await fetch("/api/admin/artists/wikipedia-enrichment", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scope: "selected", artistIds: [artist.id], limit: 1, dryRun: false }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "Wikipediaからの補完に失敗しました。");
      setMessage(body.message || "Wikipediaから不足情報を補完しました。");
      window.dispatchEvent(new CustomEvent("muuzee:master-updated", { detail: { entity: "artists", id: artist.id, preserveListOrder: true } }));
    } catch (error) {
      setMessageVariant("error");
      setMessage(error instanceof Error ? error.message : "Wikipediaからの補完に失敗しました。");
    } finally {
      setBusy(false);
    }
  }

  return <AdminDataReview className="artist-data-review">
    <AdminDataSection title="Wikidata" description={wikidataId ? wikidataUrl ? <>照合済み · <a href={wikidataUrl} target="_blank" rel="noreferrer">{wikidataId} · データ元を開く ↗</a></> : `照合済み · ${wikidataId}` : pendingCandidates.length ? `確認待ちの候補が${pendingCandidates.length}件あります。` : "未照合・候補なし"}/>

    <AdminDataSection
      title="外部データから情報を取得・確認"
      description="個別Artistへ安全に適用できる取得経路だけを表示しています。"
      action={<button type="button" className="button" disabled={busy} onClick={enrichFromWikipedia}>Wikipediaから不足情報を補完</button>}
    >
      <div className="admin-source-status-list">{sourceStatus.map(([key, label]) => {
        const current = sources.find((source) => sourceKeys(source).includes(key));
        return <div className="admin-source-status-row" key={key}><strong>{label}</strong><span>{current ? current.source_url ? <a href={String(current.source_url)} target="_blank" rel="noreferrer">取得済み · データ元を開く ↗</a> : "取得済み" : "未取得"}</span></div>;
      })}</div>
      <p className="muted">Wikidataは現在の自動適用仕様と異なるPreviewを装わないため、APJ DAJ / Getty ULANは個別実行APIがないため、ここでは実行しません。</p>
      <AdminFeedback variant={messageVariant} message={message}/>
    </AdminDataSection>

    <AdminDataSection title="項目の出典">
      <AdminProvenanceSummary record={artist} fields={provenanceFields} sources={provenance} sourceLabel={adminSourceLabel}/>
    </AdminDataSection>

    <AdminDataSection title="Artist Source Review" description="Wikidata identity候補の判断状態を確認します。個別候補の確定操作はPhase Bのbackend capabilityとして未実装です。">
      <div className="admin-identity-candidates">{candidates.map((candidate) => {
        const link = qidLink(candidate.external_id);
        const stateLabel = candidate.status === "matched" ? "照合済み" : candidate.status === "rejected" ? "非採用" : "確認待ち";
        return <article className="card admin-identity-candidate" key={candidate.id}>
          <div className="section-heading-row"><strong>{candidate.label_ja || candidate.label_en || "名称未取得"}</strong><span className={`status ${candidate.status}`}>{stateLabel}</span></div>
          <p className="muted">{link ? <a href={link} target="_blank" rel="noreferrer">{candidate.external_id} · データ元を開く ↗</a> : candidate.external_id}{candidate.birth_year ? ` · ${candidate.birth_year}年生` : ""}{candidate.confidence != null ? ` · 一致度 ${candidate.confidence}` : ""}</p>
        </article>;
      })}{!candidates.length && <p className="empty-state">確認対象のArtist identity候補はありません。</p>}</div>
      <details className="admin-source-diagnostics"><summary>Source diagnostics</summary><div className="admin-source-diagnostics-list">{sources.map((source) => <p key={String(source.id)}><strong>{sourceKeys(source).map(adminSourceLabel).join(" / ") || "不明"}</strong>{source.source_url ? <> · <a href={String(source.source_url)} target="_blank" rel="noreferrer">データ元を開く ↗</a></> : " · URL未設定"}</p>)}{!sources.length && <p className="empty-state">外部Source recordはありません。</p>}</div></details>
    </AdminDataSection>
  </AdminDataReview>;
}
