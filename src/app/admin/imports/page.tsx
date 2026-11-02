import { ExhibitionDataOperationCard } from "@/components/admin/exhibition-data-operation-card";
import { MasterDataOperationCard } from "@/components/admin/master-data-operation-card";
import { DataAcquisitionSummaryContent } from "@/components/admin/data-acquisition-summary-content";
import { DataAcquisitionSummaryDrawer } from "@/components/admin/data-acquisition-summary-drawer";
import { normalizeDataAcquisitionDetail } from "@/lib/admin/data-acquisition-detail-state";
import { getExhibitionOperatorOverview, getMasterOperatorOverviews } from "@/lib/admin/data-acquisition-operator-overview";
import { getDataAcquisitionSummary } from "@/lib/admin/data-acquisition-summary";
import { getVenueInitialAcquisitionState } from "@/lib/admin/venue-initial-acquisition-state";
import { isVenueInitialAcquisitionEnabled } from "@/lib/admin/venue-initial-acquisition-capability";
import { getResolutionOverview } from "@/lib/master-resolution/worker";

export default async function ImportsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams;
  const detailEntity = normalizeDataAcquisitionDetail(typeof params.detail === "string" ? params.detail : undefined);
  const [masters, exhibitions, venueAcquisition, detailSummary] = await Promise.all([
    getMasterOperatorOverviews(),
    getExhibitionOperatorOverview(),
    getVenueInitialAcquisitionState(),
    detailEntity ? getDataAcquisitionSummary(detailEntity) : Promise.resolve(null),
  ]);
  let overview: Awaited<ReturnType<typeof getResolutionOverview>> | null = null;
  let resolutionError = "";
  if (masters.configured) {
    try {
      overview = await getResolutionOverview();
    } catch {
      resolutionError = "Venue / Artistの要確認状況を取得できませんでした。時間をおいて再度お試しください。";
    }
  }
  return <>
    <div className="page-head"><div><p className="eyebrow">Data Acquisition</p><h1>データ取り込み</h1><p className="muted">Masterデータと展示会データの登録・更新状況を確認し、必要な操作を行います。</p></div></div>
    {!masters.configured && <div className="notice">データを利用できないため、件数の確認と更新操作を利用できません。</div>}
    {masters.error && masters.configured && <div className="error">{masters.error}</div>}
    {resolutionError && <div className="error">{resolutionError}</div>}
    <div className="data-acquisition-operation-stack">
      <MasterDataOperationCard
        overviews={masters.data}
        actionsEnabled={masters.configured}
        venueAcquisition={venueAcquisition}
        initialAcquisitionEnabled={isVenueInitialAcquisitionEnabled()}
      />
      <ExhibitionDataOperationCard overview={overview} metricOverview={exhibitions.data} metricError={exhibitions.error} actionsEnabled={masters.configured}/>
    </div>
    {detailEntity && detailSummary && <DataAcquisitionSummaryDrawer entity={detailEntity}><DataAcquisitionSummaryContent summary={detailSummary}/></DataAcquisitionSummaryDrawer>}
  </>;
}
