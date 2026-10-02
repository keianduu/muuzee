/* eslint-disable @next/next/no-img-element */
import Link from "next/link";
import { ExhibitionDetailDrawer } from "@/components/admin/exhibition-detail-drawer";
import { displayStatus } from "@/lib/admin/master-labels";
import { selectedQuery } from "@/lib/admin/master-list-state";
import { firstRelation, getExhibitions } from "@/lib/admin/queries";

export default async function ExhibitionsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams;
  const status = typeof params.status === "string" ? params.status : "";
  const image = typeof params.image === "string" ? params.image : "";
  const schedule = typeof params.schedule === "string" ? params.schedule : "current_upcoming";
  const query = typeof params.q === "string" ? params.q.toLowerCase() : "";
  const selectedId = typeof params.selected === "string" ? params.selected : undefined;
  const currentQuery = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) if (typeof value === "string") currentQuery.set(key, value);
  const today = new Date(Date.now() + 9 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const result = await getExhibitions();
  const rows = result.data.filter((item) => {
    const primary = item.media_assets?.find((asset) => asset.is_primary);
    const occurrence = item.exhibition_occurrences?.[0];
    const isUnknown = !occurrence?.start_date && !occurrence?.end_date;
    const isPast = Boolean(occurrence?.end_date && occurrence.end_date < today);
    const scheduleMatches = schedule === "all" || (schedule === "unknown" ? isUnknown : schedule === "past" ? isPast : !isUnknown && !isPast);
    return scheduleMatches && (!status || item.publication_status === status) && (!image || (image === "missing" ? !primary : Boolean(primary))) && (!query || item.title.toLowerCase().includes(query));
  });
  return <>
    <div className="page-head"><div><p className="eyebrow">Editorial queue</p><h1>Exhibitions</h1></div></div>
    {!result.configured && <div className="notice">Supabase環境変数が未設定です。</div>}{result.error && result.configured && <div className="error">{result.error}</div>}
    <form className="toolbar">
      <div className="field"><label htmlFor="q">タイトル</label><input id="q" name="q" defaultValue={query} /></div>
      <div className="field"><label htmlFor="status">公開状態</label><select id="status" name="status" defaultValue={status}><option value="">すべて</option><option value="draft">非公開</option><option value="published">公開中</option><option value="archived">アーカイブ</option></select></div>
      <div className="field"><label htmlFor="image">画像</label><select id="image" name="image" defaultValue={image}><option value="">すべて</option><option value="missing">なし</option><option value="present">あり</option></select></div>
      <div className="field"><label htmlFor="schedule">会期</label><select id="schedule" name="schedule" defaultValue={schedule}><option value="current_upcoming">開催中・今後</option><option value="past">過去</option><option value="unknown">会期不明</option><option value="all">すべて</option></select></div>
      <button className="button secondary">絞り込む</button>
    </form>
    <div className="table-wrap"><table><thead><tr><th>Thumbnail</th><th>Title</th><th>Venue / dates</th><th>Venue match</th><th>Artists</th><th>Source / sync</th><th>Image</th><th>Publication</th><th>Updated</th></tr></thead><tbody>
      {rows.map((item) => { const occurrence = item.exhibition_occurrences?.[0]; const venue = firstRelation(occurrence?.venues); const venueMention = item.exhibition_venue_mentions?.[0]; const source = item.source_records?.[0]; const primary = item.media_assets?.find((asset) => asset.is_primary); const candidate = source?.source_image_candidates?.find((entry) => entry.is_active); const thumbnail = primary?.signedUrl || candidate?.thumbnail_url || candidate?.image_url; return <tr key={item.id}>
        <td>{thumbnail ? <img className="thumb" alt="" src={thumbnail} /> : <span className="thumb" />}</td>
        <td><Link href={`/admin/exhibitions?${selectedQuery(currentQuery.toString(), item.id)}`} scroll={false}><strong>{item.title}</strong></Link></td>
        <td>{venue?.name || "-"}<br/><span className="muted">{occurrence?.start_date || "?"} – {occurrence?.end_date || "?"}</span></td>
        <td><span className={`status ${venueMention?.resolution_status || (venue ? "resolved" : "pending")}`}>{venueMention?.resolution_status || (venue ? "resolved" : "pending")}</span></td>
        <td>{item.exhibition_artists?.filter((relation) => relation.relation_status !== "stale").length || 0}{item.exhibition_artist_mentions?.some((mention) => mention.resolution_status === "ambiguous" || mention.resolution_status === "pending") ? <><br/><small>unresolved mention</small></> : null}</td>
        <td>{source ? <span>{firstRelation(source.data_sources)?.name || "Source"}<br/><small>{source.external_id}<br/>{source.last_seen_at ? `seen ${new Date(source.last_seen_at).toLocaleString("ja-JP")}` : "legacy import"}</small></span> : "-"}</td>
        <td><span className={`status ${primary?.rights_status || ""}`}>{primary ? primary.rights_status : candidate ? "API candidate" : "missing"}</span></td><td><span className={`status ${item.publication_status}`}>{displayStatus(item.publication_status)}</span></td><td>{new Date(item.updated_at).toLocaleString("ja-JP")}</td>
      </tr>; })}
      {!rows.length && <tr><td colSpan={9} className="muted">条件に合う展覧会はありません。</td></tr>}
    </tbody></table></div>
    <ExhibitionDetailDrawer selectedId={selectedId}/>
  </>;
}
