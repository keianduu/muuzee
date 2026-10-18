import type { ExhibitionRow, OccurrenceRow, VenueRow } from "@/lib/admin/types";
import type { PublicationRequirement } from "@/lib/admin/publication";
import { masterImageState } from "@/lib/admin/master-availability";
import { AdminExternalSourceSummary } from "./admin-data-review";
import { AdminFieldLabel } from "./admin-field-label";
import { PublicationToggle } from "./publication-toggle";

export function ExhibitionStatus({ exhibition, occurrence, venue, requirements, canPublish, busy, onPublicationChange, onRequirementSelect }: {
  exhibition: ExhibitionRow;
  occurrence: OccurrenceRow | null;
  venue: VenueRow | null;
  requirements: PublicationRequirement[];
  canPublish: boolean;
  busy: boolean;
  onPublicationChange: (next: boolean) => void;
  onRequirementSelect: (key: PublicationRequirement["key"]) => void;
}) {
  const published = exhibition.publication_status === "published";
  const requirementMessageId = `publication-requirements-${exhibition.id}`;
  const artistRelations = (exhibition.exhibition_artists || []).filter((item) => item.relation_status !== "stale").length;
  const unresolvedVenue = (exhibition.exhibition_venue_mentions || []).filter((item) => item.is_active !== false && item.resolution_status !== "resolved").length;
  const unresolvedArtists = (exhibition.exhibition_artist_mentions || []).filter((item) => item.is_active !== false && item.resolution_status !== "resolved").length;

  return <>
    <section className="card publication-status-card">
      <div><AdminFieldLabel label="公開状態" fieldKey="publication_status"/><p className="publication-status-help">公開条件を満たした展覧会だけを公開できます。</p></div>
      <div className="publication-status-actions"><PublicationToggle checked={published} busy={busy} disabled={!published && !canPublish} describedBy={!canPublish ? requirementMessageId : undefined} onChange={onPublicationChange}/></div>
      {!canPublish && !published && <div className="publication-requirements" id={requirementMessageId}><strong>公開に必要な情報が不足しています</strong><span>下のコンテンツ状態で必須項目を確認してください。</span></div>}
    </section>
    <section className="card admin-state-summary">
      <h2>コンテンツ状態</h2>
      <dl>
        <div><dt>画像状態</dt><dd><span className="availability-chip is-current">✓ {masterImageState(exhibition as unknown as Record<string, unknown>)}</span></dd></div>
        <div><dt>外部データ</dt><dd><AdminExternalSourceSummary sourceRecords={exhibition.source_records || []}/></dd></div>
        <div><dt>会期</dt><dd>{occurrence?.start_date || "未設定"} – {occurrence?.end_date || "未設定"}</dd></div>
        <div><dt>Venue relation</dt><dd>{venue ? venue.name : unresolvedVenue ? `未解決 ${unresolvedVenue}件` : "なし"}</dd></div>
        <div><dt>Artist relation</dt><dd>{artistRelations}件{unresolvedArtists ? ` / 未解決 ${unresolvedArtists}件` : ""}</dd></div>
      </dl>
      <ul className="requirements">{requirements.map((item) => <li key={item.key} className={item.met ? "met" : "required-missing"}>{item.met ? <>✓ {item.label}</> : <button type="button" className="requirement-action" onClick={() => onRequirementSelect(item.key)}>{item.label}<span aria-hidden="true"> →</span></button>}</li>)}</ul>
    </section>
  </>;
}
