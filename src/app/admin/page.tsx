import Link from "next/link";
import { getDashboardData } from "@/lib/admin/queries";
import { getMasterDashboardCounts } from "@/lib/admin/master-repository";

export default async function AdminDashboard() {
  const [result, masterResult] = await Promise.all([getDashboardData(), getMasterDashboardCounts()]);
  const metrics = Object.entries(masterResult.data).flatMap(([entity, counts]) => [[entity, counts.total, counts.published] as const]);
  return <>
    <div className="page-head"><div><p className="eyebrow">Production content</p><h1>Admin Dashboard</h1></div></div>
    {!result.configured && <div className="notice">Supabase未接続です。.env.localを設定し、migrationを適用してください。</div>}
    {(result.error || masterResult.error) && result.configured && <div className="error">{result.error || masterResult.error}</div>}
    <section className="metrics master-metrics">{metrics.map(([label, total, published]) => <Link className="metric" href={`/admin/${label}`} key={label}><strong>{total}</strong><span>{label} total</span><small>{published} published</small></Link>)}</section>
    <section className="card"><h2>Master Admin v1</h2><p className="muted">Venue / Artist / WorkをManual、CSV、利用可能な外部Sourceから管理します。Source値は優先順位に従ってMasterへ反映し、プロダクト利用はPublicationで管理します。人の選択は複数のSource候補がある場合だけです。</p><div className="actions"><Link className="button" href="/admin/venues">Venues</Link><Link className="button secondary" href="/admin/artists">Artists</Link><Link className="button secondary" href="/admin/works">Works</Link><Link className="button secondary" href="/admin/imports">Exhibition Import</Link></div></section>
    {result.data.lastImport && <section><h2>Latest import</h2><pre>{JSON.stringify(result.data.lastImport, null, 2)}</pre></section>}
  </>;
}
