import Link from "next/link";
import { DailySyncForm } from "@/components/admin/daily-sync-form";
import { TargetedResolutionForm } from "@/components/admin/targeted-resolution-form";

type ResolutionOverview = {
  counts: Record<string, number>;
  items: Array<Record<string, unknown>>;
};

export function ExhibitionDataOperationCard({ overview }: { overview: ResolutionOverview }) {
  return <section className="card data-acquisition-operation exhibition-data-operation" id="exhibition-data-update">
    <div className="data-acquisition-card-head">
      <div><p className="eyebrow">Exhibition</p><h2>展示会データを更新する</h2></div>
      <Link href="/admin/imports/summary?entity=exhibitions" prefetch={false}>詳細 →</Link>
    </div>
    <p className="muted">最近終了した展示会と今後開催予定の展示会を確認し、変更があるデータだけを更新します。</p>
    <DailySyncForm/>
    <TargetedResolutionForm overview={overview}/>
  </section>;
}
