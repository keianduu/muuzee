import type { ExhibitionRelationDiagnostic, ExhibitionRow, OccurrenceRow, VenueRow } from "@/lib/admin/types";
import { AdminRelationList, type AdminRelationItem } from "./admin-relation-list";
import { AdminReviewQueue, type AdminReviewQueueItem } from "./admin-data-review";

function linkedArtist(row: ExhibitionRelationDiagnostic) {
  const relation = Array.isArray(row.artists) ? row.artists[0] : row.artists;
  return relation?.name || null;
}

export function exhibitionArtistItems(exhibition: ExhibitionRow): AdminRelationItem[] {
  return (exhibition.exhibition_artists || []).filter((row) => row.relation_status !== "stale").flatMap((row) => {
    const label = linkedArtist(row);
    return label ? [{ id: row.id, label, meta: row.role || null }] : [];
  });
}

export function unresolvedVenueItems(exhibition: ExhibitionRow): AdminReviewQueueItem[] {
  return (exhibition.exhibition_venue_mentions || []).filter((row) => row.is_active !== false && row.resolution_status !== "resolved").map((row) => ({
    id: row.id,
    label: row.source_venue_name || "Venue mention",
    meta: row.resolution_status || row.match_status || "pending",
  }));
}

export function unresolvedArtistItems(exhibition: ExhibitionRow): AdminReviewQueueItem[] {
  return (exhibition.exhibition_artist_mentions || []).filter((row) => row.is_active !== false && row.resolution_status !== "resolved").map((row) => ({
    id: row.id,
    label: row.source_artist_name || "Artist mention",
    meta: row.resolution_status || row.match_status || "pending",
  }));
}

export function ExhibitionRelations({ exhibition, occurrence, venue }: { exhibition: ExhibitionRow; occurrence: OccurrenceRow | null; venue: VenueRow | null }) {
  const artists = exhibitionArtistItems(exhibition);
  const unresolvedVenues = unresolvedVenueItems(exhibition);
  const unresolvedArtists = unresolvedArtistItems(exhibition);
  const venueItems = venue ? [{ id: occurrence?.id || venue.id, label: venue.name, meta: [occurrence?.start_date, occurrence?.end_date].filter(Boolean).join(" – ") || null }] : [];

  return <div className="exhibition-relations">
    <AdminRelationList title="Venue relation" items={venueItems} emptyLabel="Venue relationはありません。"/>
    <AdminRelationList title="Artist relations" items={artists} emptyLabel="Artist relationはありません。"/>
    {(unresolvedVenues.length > 0 || unresolvedArtists.length > 0) && <section className="exhibition-unresolved-relations">
      <h2>要確認</h2>
      <div className="card">
        <AdminReviewQueue title="未解決Venue mention" items={unresolvedVenues}/>
        <AdminReviewQueue title="未解決Artist mention" items={unresolvedArtists}/>
      </div>
    </section>}
  </div>;
}
