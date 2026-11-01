import Link from "next/link";
import { DataAcquisitionEntitySwitch } from "@/components/admin/data-acquisition-entity-switch";
import { DataAcquisitionSummaryContent } from "@/components/admin/data-acquisition-summary-content";
import { getDataAcquisitionSummary, normalizeDataAcquisitionEntity } from "@/lib/admin/data-acquisition-summary";

export default async function DataAcquisitionSummaryPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams;
  const entity = normalizeDataAcquisitionEntity(typeof params.entity === "string" ? params.entity : undefined);
  const summary = await getDataAcquisitionSummary(entity);
  return <>
    <div className="page-head"><div><p className="eyebrow">Data Acquisition</p><h1>データ取得サマリ</h1><p className="muted">取得状況と不足・要確認をEntityごとに俯瞰します。すべてread-onlyです。</p></div><Link className="button secondary" href="/admin/imports" prefetch={false}>データ取り込みへ戻る</Link></div>
    <DataAcquisitionEntitySwitch entity={entity}/>
    <DataAcquisitionSummaryContent summary={summary}/>
  </>;
}
