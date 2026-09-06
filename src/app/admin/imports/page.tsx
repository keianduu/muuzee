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
    <div className="page-head"><div><p className="eyebrow">Japan Search / Art Commons</p><h1>Imports</h1></div></div>
    {!runs.configured && <div className="notice">Supabase環境変数が未設定のため、Importは実行できません。</div>}
    {runs.error && runs.configured && <div className="error">{runs.error}</div>}
    <DailySyncForm />
    <TargetedResolutionForm overview={overview} />
    <ImportForm {...dateRange} />
    <h2>Import history</h2>
    <div className="table-wrap"><table><thead><tr><th>Started</th><th>Status</th><th>Range</th><th>Source</th><th>API hits</th><th>Scanned</th><th>Eligible</th><th>Fetched</th><th>Created</th><th>Updated</th><th>Skipped</th><th>Excluded</th><th>Errors</th></tr></thead><tbody>
      {runs.data.map((run) => <tr key={String(run.id)}><td>{String(run.started_at)}</td><td><span className={`status ${String(run.status)}`}>{String(run.status)}</span></td><td>{run.include_past ? "All" : `${String(run.date_from || "-")} – ${String(run.date_to || "-")}`}</td><td>{String((run.data_sources as {name?: string} | null)?.name || "-")}</td><td>{String(run.source_hit_count || 0)}</td><td>{String(run.scanned_count || 0)}</td><td>{String(run.requested_count)}</td><td>{String(run.fetched_count)}</td><td>{String(run.created_count)}</td><td>{String(run.updated_count)}</td><td>{String(run.skipped_count)}</td><td>{String(run.excluded_count || 0)}</td><td>{String(run.error_count)}</td></tr>)}
      {!runs.data.length && <tr><td colSpan={13} className="muted">Import履歴はありません。</td></tr>}
    </tbody></table></div>
  </>;
}
