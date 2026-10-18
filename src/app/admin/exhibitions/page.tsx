import { redirect } from "next/navigation";
import { AdminListControls } from "@/components/admin/admin-list-controls";
import { ExhibitionList } from "@/components/admin/exhibition-list";
import { canonicalizeExhibitionScheduleQuery, normalizeExhibitionSchedule, normalizePublicationStatus, publicationMatches } from "@/lib/admin/master-list-state";
import { getExhibitions } from "@/lib/admin/queries";

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
  const query = queryValue.toLowerCase();
  const selectedId = typeof params.selected === "string" ? params.selected : undefined;
  const listParams = Object.fromEntries(Object.entries(params).flatMap(([key, value]) => typeof value === "string" ? [[key, value]] : []));
  listParams.status = status;
  const today = new Date(Date.now() + 9 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const result = await getExhibitions();
  const rows = result.data.filter((item) => {
    const primary = item.media_assets?.find((asset) => asset.is_primary);
    const occurrence = item.exhibition_occurrences?.[0];
    const isUnknown = !occurrence?.start_date && !occurrence?.end_date;
    const isPast = Boolean(occurrence?.end_date && occurrence.end_date < today);
    const scheduleMatches = schedule === "all"
      || (schedule === "unknown" ? isUnknown
        : schedule === "past" ? isPast
          : !isUnknown && !isPast);
    return scheduleMatches && publicationMatches(item.publication_status, status) && (!image || (image === "missing" ? !primary : Boolean(primary))) && (!query || item.title.toLowerCase().includes(query));
  });
  return <>
    <div className="page-head"><div><p className="eyebrow">Editorial queue</p><h1>Exhibitions</h1></div></div>
    {!result.configured && <div className="notice">Supabase環境変数が未設定です。</div>}{result.error && result.configured && <div className="error">{result.error}</div>}
    <AdminListControls entity="exhibitions" params={{ ...listParams, q: queryValue, image, schedule }}/>
    <ExhibitionList rows={rows} initialSelectedId={selectedId}/>
  </>;
}
