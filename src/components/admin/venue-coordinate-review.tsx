"use client";

import type { VenueCoordinateCandidateRow } from "@/lib/admin/types";
import { venueCoordinateCandidateMapUrl } from "@/lib/admin/venue-coordinate-review";

export function VenueCoordinateReview({ venueId, candidates, busy, onReview }: { venueId: string; candidates: VenueCoordinateCandidateRow[]; busy: boolean; onReview: (candidate: VenueCoordinateCandidateRow, action: "accept" | "reject") => Promise<void> }) {
  if (!candidates.length) return <p className="empty-state">位置情報候補はありません。</p>;
  return <div className="venue-coordinate-candidates" data-venue-id={venueId}>{candidates.map((candidate) => {
    const mapUrl = venueCoordinateCandidateMapUrl(candidate);
    return <article className="card venue-coordinate-candidate" key={candidate.id}>
      <div className="section-heading-row"><strong>{candidate.source === "wikidata" ? "Wikidata" : "Geolonia"}</strong><span className={`status ${candidate.review_status}`}>{candidate.review_status === "candidate" ? "候補" : candidate.review_status === "accepted" ? "採用済み" : "非採用"}</span></div>
      <dl><div><dt>座標</dt><dd>{candidate.latitude}, {candidate.longitude}</dd></div>{candidate.external_id && <div><dt>QID</dt><dd>{candidate.external_id}</dd></div>}{candidate.confidence != null && <div><dt>一致度</dt><dd>{candidate.confidence}</dd></div>}{candidate.precision && <div><dt>精度</dt><dd>{candidate.precision}</dd></div>}</dl>
      {candidate.reason && <p className="muted">{candidate.reason}</p>}
      <div className="actions"><a className="button secondary" href={mapUrl} target="_blank" rel="noreferrer">Google Mapsで確認 ↗</a>{candidate.review_status === "candidate" && <><button type="button" className="button warning" disabled={busy} onClick={() => onReview(candidate, "accept")}>採用</button><button type="button" className="button secondary" disabled={busy} onClick={() => onReview(candidate, "reject")}>非採用</button></>}</div>
    </article>;
  })}</div>;
}
