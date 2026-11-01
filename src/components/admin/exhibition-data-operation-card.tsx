import { DataAcquisitionDetailTrigger } from "@/components/admin/data-acquisition-detail-trigger";
import { DailySyncForm } from "@/components/admin/daily-sync-form";
import { TargetedResolutionForm } from "@/components/admin/targeted-resolution-form";
import type { ExhibitionOperatorOverview } from "@/lib/admin/data-acquisition-operator-overview";

type ResolutionOverview = {
  counts: Record<string, number>;
  items: Array<Record<string, unknown>>;
};

export function ExhibitionDataOperationCard({ overview, metricOverview, metricError, actionsEnabled }: { overview: ResolutionOverview | null; metricOverview: ExhibitionOperatorOverview; metricError: string | null; actionsEnabled: boolean }) {
  return <DataAcquisitionDetailTrigger as="section" className="card data-acquisition-operation exhibition-data-operation" id="exhibition-data-update" entity="exhibitions" label="Exhibitionデータ取得サマリを開く">
    <div className="data-acquisition-card-head">
      <div><p className="eyebrow">Exhibition</p><h2>展示会データを更新する</h2></div>
    </div>
    <p className="muted">最近終了した展示会と今後開催予定の展示会を確認し、変更があるデータだけを更新します。</p>
    <div className="master-operator-metric-block exhibition-operator-metric-block">
      <dl className="master-operator-metrics exhibition-operator-metrics" aria-label="Exhibitionの件数">
        <div><dt>MST</dt><dd>{metricOverview.total ?? "—"}</dd></div>
        <div><dt>公開</dt><dd>{metricOverview.published ?? "—"}</dd></div>
        <div><dt>非公開</dt><dd>{metricOverview.unpublished ?? "—"}</dd></div>
        <div><dt>開催終了</dt><dd>{metricOverview.ended ?? "—"}</dd></div>
      </dl>
      {metricError && <p className="data-acquisition-empty-state">{metricError}</p>}
    </div>
    <DailySyncForm actionsEnabled={actionsEnabled}/>
    <TargetedResolutionForm overview={overview} actionsEnabled={actionsEnabled}/>
  </DataAcquisitionDetailTrigger>;
}
