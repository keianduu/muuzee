import Link from "next/link";
import { VenueInitialAcquisitionForm } from "@/components/admin/venue-initial-acquisition-form";
import { VenuePeriodicRefreshForm } from "@/components/admin/venue-periodic-refresh-form";
import type { MasterOperatorEntity, MasterOperatorOverview } from "@/lib/admin/data-acquisition-operator-overview";
import type { VenueInitialAcquisitionState } from "@/lib/admin/venue-initial-acquisition-state";

const LABELS: Record<MasterOperatorEntity, string> = {
  venues: "Venue",
  artists: "Artist",
  works: "Works",
};

function MasterMetrics({ overview }: { overview: MasterOperatorOverview }) {
  const available = overview.total !== null;
  return <div className="master-operator-metric-block">
    <dl className="master-operator-metrics" aria-label={`${LABELS[overview.entity]}の件数`}>
      <div><dt>Master total</dt><dd>{overview.total ?? "—"}</dd></div>
      <div><dt>公開</dt><dd>{overview.published ?? "—"}</dd></div>
      <div><dt>非公開</dt><dd>{overview.unpublished ?? "—"}</dd></div>
    </dl>
    {!available && <p className="data-acquisition-empty-state">件数を取得できません。</p>}
  </div>;
}

export function MasterDataOperationCard({ overviews, actionsEnabled, venueAcquisition }: {
  overviews: MasterOperatorOverview[];
  actionsEnabled: boolean;
  venueAcquisition: VenueInitialAcquisitionState;
}) {
  return <section className="card data-acquisition-operation master-data-operation" id="master-data">
    <p className="eyebrow">Master Data</p>
    <h2>Masterデータ</h2>
    <p className="muted">Venue / Artist / Worksの登録・公開状況を確認し、利用できる更新操作を行います。</p>
    <div className="master-operator-list">
      {overviews.map((overview) => <article className="master-operator-row" key={overview.entity}>
        <div className="master-operator-row-head">
          <h3>{LABELS[overview.entity]}</h3>
          <Link href={`/admin/imports/summary?entity=${overview.entity}`} prefetch={false}>詳細 →</Link>
        </div>
        <div className="master-operator-row-body">
          <MasterMetrics overview={overview}/>
          {overview.entity === "venues"
            ? <div className="venue-operator-actions">
              <VenueInitialAcquisitionForm status={venueAcquisition.status} actionsEnabled={actionsEnabled}/>
              {venueAcquisition.linkedVenueCount !== null && venueAcquisition.linkedVenueCount > 0
                ? <VenuePeriodicRefreshForm actionsEnabled={actionsEnabled}/>
                : <div className="master-operator-pending"><p>初回取り込み後に情報更新を利用できます。</p></div>}
            </div>
            : <div className="master-operator-pending"><span className="status">準備中</span><p>現在利用できる更新操作はありません。</p></div>}
        </div>
      </article>)}
    </div>
  </section>;
}
