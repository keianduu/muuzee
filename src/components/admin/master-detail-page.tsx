import Link from "next/link";
import { notFound } from "next/navigation";
import { MasterEditor } from "./master-editor";
import { WorkRelations } from "./work-relations";
import { MasterTags } from "./master-tags";
import { VenueEditor } from "./venue-editor";
import { createVenueImageResearchPrompt } from "@/lib/admin/venue-image-research-prompt";
import { getAdjacentMasters, getMaster, type MasterRecord } from "@/lib/admin/master-repository";
import { MASTER_CONFIGS, type MasterEntity } from "@/lib/admin/master-config";
import type { VenueRow } from "@/lib/admin/types";

export async function MasterDetailPage({ entity, id, returnTo: rawReturnTo }: { entity: MasterEntity; id: string; returnTo?: string }) {
  const result = await getMaster(entity, id);
  if (result.configured && !result.data && result.error?.includes("0 rows")) notFound();
  if (!result.data) return <><h1>{MASTER_CONFIGS[entity].label}</h1><div className={result.error ? "error" : "notice"}>{result.error || "Masterが見つかりません。"}</div></>;
  const row = result.data as MasterRecord & Record<string, unknown> & { completeness: { percent: number; items: Array<{ key: string; label: string; met: boolean }> }; signedImageUrl: string | null };
  const config = MASTER_CONFIGS[entity];
  const adjacent = await getAdjacentMasters(entity, row as MasterRecord);
  const returnTo = rawReturnTo?.startsWith(`/admin/${entity}`) ? rawReturnTo : `/admin/${entity}`;
  return <>
    <nav className="breadcrumbs"><Link href="/admin">Admin</Link><span>/</span><Link href={returnTo}>{config.label}s</Link><span>/</span><strong>{String(row[config.titleKey])}</strong></nav>
    <div className="detail-navigation"><Link className="button secondary" href={returnTo}>← Back to list</Link><div className="actions">{adjacent.previous ? <Link className="button secondary" href={`/admin/${entity}/${adjacent.previous.id}?returnTo=${encodeURIComponent(returnTo)}`}>← Previous</Link> : <span/>}{adjacent.next ? <Link className="button secondary" href={`/admin/${entity}/${adjacent.next.id}?returnTo=${encodeURIComponent(returnTo)}`}>Next →</Link> : <span/>}</div></div>
    <div className="page-head"><div><p className="eyebrow">{config.label} Master</p><h1>{String(row[config.titleKey])}</h1><p className="muted">ID: {row.id}</p></div></div>
    <MasterEditor entity={entity} record={row}/>
    <MasterTags entity={entity} masterId={row.id} rows={(row[`${config.singular}_tags`] || []) as Array<Record<string, unknown>>}/>
    {entity === "works" && <WorkRelations workId={row.id} artists={(row.work_artists || []) as Array<Record<string, unknown>>} holdings={(row.collection_holdings || []) as Array<Record<string, unknown>>}/>}
    {entity === "venues" && <section className="legacy-enrichment"><h2>Venue Source & Media Enrichment</h2><VenueEditor venue={row as unknown as VenueRow} prompt={createVenueImageResearchPrompt({ name: String(row.name), address: row.address ? String(row.address) : null, officialUrl: row.official_url ? String(row.official_url) : null })} showBasicForm={false}/></section>}
  </>;
}
