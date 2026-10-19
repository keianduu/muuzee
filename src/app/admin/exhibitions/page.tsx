import { redirect } from "next/navigation";
import { AdminListControls } from "@/components/admin/admin-list-controls";
import { ExhibitionList } from "@/components/admin/exhibition-list";
import { canonicalizeExhibitionScheduleQuery, normalizeExhibitionSchedule, normalizePublicationStatus } from "@/lib/admin/master-list-state";
import { listExhibitions } from "@/lib/admin/exhibition-list-repository";

export default async function ExhibitionsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams;
  const rawQuery = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) if (typeof value === "string") rawQuery.set(key, value);
  const canonicalQuery = canonicalizeExhibitionScheduleQuery(rawQuery.toString());
  if (canonicalQuery !== rawQuery.toString()) redirect(`/admin/exhibitions${canonicalQuery ? `?${canonicalQuery}` : ""}`);
  const status = normalizePublicationStatus(typeof params.status === "string" ? params.status : undefined);
  const image = typeof params.image === "string" ? params.image : "";
  const schedule = normalizeExhibitionSchedule(typeof params.schedule === "string" ? params.schedule : undefined);
  const queryValue = typeof params.q === "string" ? params.q : "";
  const selectedId = typeof params.selected === "string" ? params.selected : undefined;
  const listParams = Object.fromEntries(Object.entries(params).flatMap(([key, value]) => typeof value === "string" ? [[key, value]] : []));
  listParams.status = status;
  for (const key of ["selected", "panel", "candidate", "page", "pageSize"]) delete listParams[key];
  if (schedule === "current_upcoming") delete listParams.schedule;
  const queryString = new URLSearchParams(listParams).toString();
  const result = await listExhibitions({ status, image, schedule, q: queryValue, page: 1, pageSize: 50 });
  return <>
    <div className="page-head"><div><p className="eyebrow">Editorial queue</p><h1>Exhibitions</h1></div></div>
    {!result.configured && <div className="notice">Supabase環境変数が未設定です。</div>}{result.error && result.configured && <div className="error">{result.error}</div>}
    <AdminListControls entity="exhibitions" params={{ ...listParams, q: queryValue, image, schedule }}/>
    <ExhibitionList result={result} queryString={queryString} initialSelectedId={selectedId}/>
  </>;
}
