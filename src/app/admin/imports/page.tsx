import Link from "next/link";
import { ImportForm } from "@/components/admin/import-form";
import { DailySyncForm } from "@/components/admin/daily-sync-form";
import { TargetedResolutionForm } from "@/components/admin/targeted-resolution-form";
import { getImportRuns } from "@/lib/admin/queries";
import { getResolutionOverview } from "@/lib/master-resolution/worker";
import { defaultImportDateRange } from "@/lib/art-commons/importer";

export default async function ImportsPage() {
  const runs = await getImportRuns();
  const overview = runs.configured ? await getResolutionOverview() : { counts: {}, items: [] };
  const dateRange = defaultImportDateRange();
  return <>
    <div className="page-head"><div><p className="eyebrow">Data Acquisition</p><h1>データ取り込み</h1><p className="muted">外部データの取得、要確認項目、反映ルール、履歴をここで管理します。</p></div></div>
    {!runs.configured && <div className="notice">Supabase環境変数が未設定のため、Importは実行できません。</div>}
    {runs.error && runs.configured && <div className="error">{runs.error}</div>}
    <div className="data-acquisition-operation-stack">
      <section className="card data-acquisition-operation" id="acquisition-overview"><p className="eyebrow">Overview</p><h2>取り込み状況を確認する</h2><p className="muted">Exhibition / Venue / Artist / Worksごとに、取得状況、公開状況、不足、要確認件数をread-onlyで確認します。</p><div className="actions"><Link className="button secondary" href="/admin/imports/summary" prefetch={false}>取り込み状況を開く</Link></div></section>
      <DailySyncForm />
      <TargetedResolutionForm overview={overview} />
      <section className="card data-acquisition-operation" id="master-refresh"><p className="eyebrow">Master Refresh</p><h2>Venue / Artist / Worksを定期更新する</h2><p className="muted">初回同期後のMaster差分更新を、月単位でHumanが実行する想定です。現行にはVenue / Artist / Worksをまとめて安全に更新する共通操作がないため、この画面からはまだ実行しません。</p><p className="data-acquisition-operation-meta">Entity別の既存処理は維持し、共通の実行境界が確定するまで自動実行や仮のActionは追加しません。</p></section>
      <section className="card data-acquisition-operation" id="source-policies"><p className="eyebrow">Source Policies</p><h2>データごとの反映ルールを確認する</h2><p className="muted">Source × AssertionごとのAuto Apply、Public visibility、Review Requiredを確認します。Work PresentationとMedia / Imageは常にReview Requiredです。</p><div className="actions"><Link className="button secondary" href="/admin/sources" prefetch={false}>反映ルールを開く</Link></div></section>
      <ImportForm {...dateRange} />
      <section className="data-acquisition-history" id="import-history"><div className="data-acquisition-section-head"><div><p className="eyebrow">Import History</p><h2>取り込み履歴を確認する</h2></div></div><p className="muted">実行日時、Source、処理件数、Error件数を確認します。現行はrun一覧と集計値までで、個別run detailの専用routeはありません。</p>
        <div className="table-wrap"><table><thead><tr><th>開始日時</th><th>状態</th><th>対象期間</th><th>Source</th><th>API hits</th><th>Scanned</th><th>Eligible</th><th>Fetched</th><th>Created</th><th>Updated</th><th>Skipped</th><th>Excluded</th><th>Errors</th></tr></thead><tbody>
          {runs.data.map((run) => <tr key={String(run.id)}><td>{String(run.started_at)}</td><td><span className={`status ${String(run.status)}`}>{String(run.status)}</span></td><td>{run.include_past ? "All" : `${String(run.date_from || "-")} – ${String(run.date_to || "-")}`}</td><td>{String((run.data_sources as {name?: string} | null)?.name || "-")}</td><td>{String(run.source_hit_count || 0)}</td><td>{String(run.scanned_count || 0)}</td><td>{String(run.requested_count)}</td><td>{String(run.fetched_count)}</td><td>{String(run.created_count)}</td><td>{String(run.updated_count)}</td><td>{String(run.skipped_count)}</td><td>{String(run.excluded_count || 0)}</td><td>{String(run.error_count)}</td></tr>)}
          {!runs.data.length && <tr><td colSpan={13} className="muted">取り込み履歴はありません。</td></tr>}
        </tbody></table></div>
      </section>
    </div>
  </>;
}
