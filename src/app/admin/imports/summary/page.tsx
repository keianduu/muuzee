import Link from "next/link";
import { DataAcquisitionEntitySwitch } from "@/components/admin/data-acquisition-entity-switch";
import { getDataAcquisitionSummary, normalizeDataAcquisitionEntity, type SummaryMetric } from "@/lib/admin/data-acquisition-summary";

function MetricGrid({ metrics }: { metrics: SummaryMetric[] }) {
  return <div className="data-acquisition-metrics">
    {metrics.map((metric) => {
      const content = <><strong>{metric.value}</strong><span>{metric.label}</span>{metric.note ? <small>{metric.note}</small> : null}</>;
      return metric.href
        ? <Link className="data-acquisition-metric" href={metric.href} key={metric.key} prefetch={false}>{content}<em>一覧で確認 →</em></Link>
        : <div className="data-acquisition-metric" key={metric.key}>{content}</div>;
    })}
  </div>;
}

function VenueQuality({ dashboard }: { dashboard: Extract<NonNullable<Awaited<ReturnType<typeof getDataAcquisitionSummary>>["qualityDashboard"]>, { kind: "venue" }> }) {
  return <>
    <div className="data-acquisition-tier-grid">{dashboard.tiers.map((item) => <div key={item.tier}><span className={`tier-badge tier-${item.tier.toLowerCase()}`}>{item.tier}</span><strong>{item.count}件</strong><small>平均 {item.averageCompleteness}% · Target {item.target}%</small><small>達成 {item.met} / 未達 {item.unmet}</small></div>)}</div>
    <div className="data-acquisition-detail-grid">
      <div><h3>データ品質</h3><dl>{Object.entries(dashboard.missing).map(([key, value]) => <div key={key}><dt>{key}</dt><dd>{value}</dd></div>)}</dl></div>
      <div><h3>画像取得</h3><dl>{Object.entries(dashboard.images).map(([key, value]) => <div key={key}><dt>{key}</dt><dd>{value}</dd></div>)}</dl></div>
      <div><h3>Identity</h3><dl><div><dt>Multiple QID candidates</dt><dd>{dashboard.multipleQidCandidates}</dd></div><div><dt>A〜C Target未達</dt><dd>{dashboard.priorityTargetUnmet}</dd></div></dl></div>
    </div>
  </>;
}

function ArtistQuality({ dashboard }: { dashboard: Extract<NonNullable<Awaited<ReturnType<typeof getDataAcquisitionSummary>>["qualityDashboard"]>, { kind: "artist" }> }) {
  return <>
    <div className="data-acquisition-tier-grid">{dashboard.tiers.map((item) => <div key={item.tier}><span className={`tier-badge tier-${item.tier.toLowerCase()}`}>{item.tier}</span><strong>{item.count}件</strong><small>平均 {item.averageCompleteness}%</small><small>4/4 {item.complete} · 未達 {item.incomplete}</small></div>)}</div>
    <div className="data-acquisition-detail-grid"><div><h3>Missing core fields</h3><dl>{Object.entries(dashboard.missing).map(([key, value]) => <div key={key}><dt>{key}</dt><dd>{value}</dd></div>)}</dl></div></div>
  </>;
}

export default async function DataAcquisitionSummaryPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams;
  const entity = normalizeDataAcquisitionEntity(typeof params.entity === "string" ? params.entity : undefined);
  const summary = await getDataAcquisitionSummary(entity);
  return <>
    <div className="page-head"><div><p className="eyebrow">Data Acquisition</p><h1>データ取得サマリ</h1><p className="muted">取得状況と不足・要確認をEntityごとに俯瞰します。すべてread-onlyです。</p></div></div>
    <DataAcquisitionEntitySwitch entity={entity}/>
    {!summary.configured && <div className="notice">Supabase環境変数が未設定です。</div>}
    {summary.error && summary.configured && <div className="error">{summary.error}</div>}
    {!summary.error && <>
      <section className="data-acquisition-section"><div className="data-acquisition-section-head"><div><p className="eyebrow">Overview</p><h2>取得・公開状況</h2></div></div><MetricGrid metrics={summary.overview}/></section>
      {summary.quality.length > 0 && <section className="data-acquisition-section"><div className="data-acquisition-section-head"><div><p className="eyebrow">Operations</p><h2>要確認</h2></div></div><MetricGrid metrics={summary.quality}/></section>}
      {summary.qualityDashboard?.kind === "venue" && <section className="data-acquisition-section"><div className="data-acquisition-section-head"><div><p className="eyebrow">Data Quality</p><h2>Venue品質</h2></div><p>A〜Cを優先整備</p></div><VenueQuality dashboard={summary.qualityDashboard}/></section>}
      {summary.qualityDashboard?.kind === "artist" && <section className="data-acquisition-section"><div className="data-acquisition-section-head"><div><p className="eyebrow">Data Quality</p><h2>Artist品質</h2></div></div><ArtistQuality dashboard={summary.qualityDashboard}/></section>}
      {summary.runAttributionSupported && <section className="data-acquisition-section"><div className="data-acquisition-section-head"><div><p className="eyebrow">History</p><h2>取得履歴</h2></div><Link href="/admin/imports" prefetch={false}>取り込み実行を見る →</Link></div>
        {summary.runs.length ? <div className="table-wrap"><table className="data-acquisition-runs"><thead><tr><th>Started</th><th>Operation</th><th>Source</th><th>Status</th><th>Requested</th><th>Fetched</th><th>Created</th><th>Updated</th><th>Errors</th></tr></thead><tbody>{summary.runs.map((run) => <tr key={run.id}><td>{new Date(run.startedAt).toLocaleString("ja-JP")}</td><td>{run.operationType}</td><td>{run.sourceName}</td><td><span className={`status ${run.status}`}>{run.status}</span></td><td>{run.requestedCount}</td><td>{run.fetchedCount}</td><td>{run.createdCount}</td><td>{run.updatedCount}</td><td>{run.errorCount}</td></tr>)}</tbody></table></div> : <p className="data-acquisition-empty">取得履歴なし</p>}
      </section>}
    </>}
  </>;
}
