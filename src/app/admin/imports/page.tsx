import { ExhibitionDataOperationCard } from "@/components/admin/exhibition-data-operation-card";
import { MasterDataOperationCard } from "@/components/admin/master-data-operation-card";
import { getMasterOperatorOverviews } from "@/lib/admin/data-acquisition-operator-overview";
import { buildResolutionOverview, getResolutionOverview } from "@/lib/master-resolution/worker";

export default async function ImportsPage() {
  const masters = await getMasterOperatorOverviews();
  let overview: Awaited<ReturnType<typeof getResolutionOverview>> = buildResolutionOverview([]);
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
    {!masters.configured && <div className="notice">データ環境が未設定のため、件数の確認と更新操作を利用できません。</div>}
    {masters.error && masters.configured && <div className="error">{masters.error}</div>}
    {resolutionError && <div className="error">{resolutionError}</div>}
    <div className="data-acquisition-operation-stack">
      <MasterDataOperationCard overviews={masters.data}/>
      <ExhibitionDataOperationCard overview={overview}/>
    </div>
  </>;
}
