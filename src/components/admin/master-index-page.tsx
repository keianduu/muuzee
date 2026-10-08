import { AdminListControls, AdminWorkViewTabs } from "./admin-list-controls";
import { AdminMasterListActions } from "./admin-master-list-actions";
import { MasterList } from "./master-list";
import { listMasters } from "@/lib/admin/master-repository";
import { MASTER_CONFIGS, type MasterEntity } from "@/lib/admin/master-config";
import { normalizePublicationStatus, type WorkListView } from "@/lib/admin/master-list-state";

function stringParams(input: Record<string, string | string[] | undefined>): Record<string, string> {
  return Object.fromEntries(Object.entries(input).flatMap(([key, value]) => typeof value === "string" ? [[key, value]] : []));
}

export async function MasterIndexPage({ entity, searchParams }: { entity: MasterEntity; searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const rawParams = stringParams(await searchParams);
  const workView: WorkListView = rawParams.view === "candidates" ? "candidates" : "adopted";
  const params: Record<string, string> = { ...rawParams, status: normalizePublicationStatus(rawParams.status) };
  const result = await listMasters(entity, {
    q: params.q, status: params.status, type: entity === "venues" ? params.type : undefined, image: params.image,
    coordinates: entity === "venues" ? params.coordinates : undefined,
    artistRelation: params.artistRelation, holdingRelation: params.holdingRelation, presentation: params.presentation,
    page: 1, pageSize: 50,
  });
  const query = new URLSearchParams(params);
  for (const key of ["page", "pageSize", "selected", "active", "source", "match", "completeness", "tier", "nationality"]) query.delete(key);
  if (entity !== "venues") for (const key of ["type", "coordinates"]) query.delete(key);
  if (entity !== "works") for (const key of ["artistRelation", "holdingRelation", "presentation", "view"]) query.delete(key);
  const config = MASTER_CONFIGS[entity];
  return <>
    <div className="page-head"><div><p className="eyebrow">Master Admin v1</p><h1>{config.label}s</h1><p className="muted">正規マスターデータ · Content全体を公開状態で最終管理します</p></div>{(entity !== "works" || workView === "adopted") && <AdminMasterListActions entity={entity}/>}</div>
    {!result.configured && <div className="notice">Supabase環境変数が未設定です。</div>}
    {result.error && <div className="error">{result.error}</div>}
    {entity === "works" && <AdminWorkViewTabs view={workView}/>}
    {(entity !== "works" || workView === "adopted") && <AdminListControls entity={entity} params={params}/>}
    <MasterList entity={entity} result={result} queryString={query.toString()} workView={workView}/>
  </>;
}
