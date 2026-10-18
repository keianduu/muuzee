import type { ExhibitionRow } from "@/lib/admin/types";
import { AdminDataReview, AdminDataSection, AdminExternalSourceList, AdminReviewQueue } from "./admin-data-review";
import { unresolvedArtistItems, unresolvedVenueItems } from "./exhibition-relations";

export function ExhibitionDataReview({ exhibition }: { exhibition: ExhibitionRow }) {
  const venues = unresolvedVenueItems(exhibition);
  const artists = unresolvedArtistItems(exhibition);
  return <AdminDataReview className="exhibition-data-review">
    <AdminDataSection title="外部データ"><AdminExternalSourceList sourceRecords={exhibition.source_records || []}/></AdminDataSection>
    {(venues.length > 0 || artists.length > 0) && <AdminDataSection title="要確認">
      <AdminReviewQueue title="未解決Venue mention" items={venues}/>
      <AdminReviewQueue title="未解決Artist mention" items={artists}/>
    </AdminDataSection>}
  </AdminDataReview>;
}
