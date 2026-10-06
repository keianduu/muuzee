import { MASTER_CONFIGS } from "@/lib/admin/master-config";
import { adminSourceLabel } from "@/lib/admin/data-review";
import { AdminDataReview, AdminDataSection, AdminExternalSourceList, AdminProvenanceSummary, AdminReviewQueue } from "./admin-data-review";

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

function qidLink(qid: string) {
  return /^Q\d+$/.test(qid) ? `https://www.wikidata.org/wiki/${qid}` : null;
}

export function ArtistDataReview({ artist }: { artist: Record<string, unknown> & { id: string } }) {
  const sources = (artist.source_records || []) as ArtistSourceRecord[];
  const candidates = ((artist.artist_external_match_candidates || []) as ArtistMatchCandidate[])
    .filter((candidate) => candidate.provider === "wikidata")
    .sort((left, right) => Number(right.confidence || 0) - Number(left.confidence || 0));
  const pendingCandidates = candidates.filter((candidate) => candidate.status === "candidate");
  const provenanceFields = MASTER_CONFIGS.artists.fields
    .filter((field) => field.key !== "publication_status")
    .map((field) => [field.key, field.label] as const);
  const provenance = (artist.artist_field_sources || []) as Array<{ field_name: string; source?: string | null; source_url?: string | null; is_current?: boolean }>;
  return <AdminDataReview className="artist-data-review">
    <AdminDataSection title="項目の出典">
      <AdminProvenanceSummary record={artist} fields={provenanceFields} sources={provenance} sourceLabel={adminSourceLabel}/>
    </AdminDataSection>

    <AdminDataSection title="外部データ"><AdminExternalSourceList sourceRecords={sources}/></AdminDataSection>

    {pendingCandidates.length > 0 && <AdminDataSection title="要確認">
      <AdminReviewQueue title="Artist identity候補" items={pendingCandidates.map((candidate) => ({
        id: candidate.id,
        label: candidate.label_ja || candidate.label_en || "名称未取得",
        externalId: candidate.external_id,
        sourceUrl: qidLink(candidate.external_id),
        meta: [candidate.birth_year ? `${candidate.birth_year}年生` : null, candidate.confidence != null ? `一致度 ${candidate.confidence}` : null].filter(Boolean).join(" · ") || null,
      }))}/>
    </AdminDataSection>}
  </AdminDataReview>;
}
