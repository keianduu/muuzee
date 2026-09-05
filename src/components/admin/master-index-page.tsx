import { MasterFilter } from "./master-filter";
import { MasterList } from "./master-list";
import { listMasters } from "@/lib/admin/master-repository";
import { MASTER_CONFIGS, type MasterEntity } from "@/lib/admin/master-config";

function stringParams(input: Record<string, string | string[] | undefined>) {
  return Object.fromEntries(Object.entries(input).flatMap(([key, value]) => typeof value === "string" ? [[key, value]] : []));
}

export async function MasterIndexPage({ entity, searchParams }: { entity: MasterEntity; searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = stringParams(await searchParams);
  const result = await listMasters(entity, {
    q: params.q, status: params.status, type: params.type, active: params.active, image: params.image, coordinates: params.coordinates,
    source: params.source, match: params.match, completeness: params.completeness, page: 1, pageSize: 50,
  });
  const query = new URLSearchParams(params); query.delete("page"); query.delete("pageSize"); query.delete("selected");
  const config = MASTER_CONFIGS[entity];
  return <>
    <div className="page-head"><div><p className="eyebrow">Master Admin v1</p><h1>{config.label}s</h1><p className="muted">正規マスターデータ · 公開前に人の確認が必要です</p></div></div>
    {!result.configured && <div className="notice">Supabase環境変数が未設定です。</div>}
    {result.error && <div className="error">{result.error}</div>}
    <MasterFilter entity={entity} params={params}/>
    <MasterList entity={entity} result={result} queryString={query.toString()}/>
  </>;
}
