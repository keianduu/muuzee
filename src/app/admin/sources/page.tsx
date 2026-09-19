import { SourcePolicyTable } from "@/components/admin/source-policy-table";
import { listAdminSourcePolicies } from "@/lib/admin/source-policy";

export default async function AdminSourcesPage() {
  const result = await listAdminSourcePolicies();
  return <>
    <div className="page-head"><div><p className="eyebrow">External source policy</p><h1>Sources（外部ソース）</h1></div></div>
    <section className="card"><h2>Auto Apply / Public visibility</h2><p className="muted">Sourceごと・Assertionごとに適用境界を管理します。Work Artist / Collection Holdingはdeterministic resolution時だけAuto Applyできます。PresentationとMediaはReview Required固定です。API secretはこの画面・JSONへ返しません。</p></section>
    {!result.configured && <div className="notice">Supabase未接続です。.env.localを設定し、migrationを適用してください。</div>}
    {result.error && result.configured && <div className="error">{result.error}</div>}
    <SourcePolicyTable sources={result.data}/>
  </>;
}
