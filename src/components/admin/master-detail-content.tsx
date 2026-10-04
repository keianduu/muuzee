"use client";

import { useSearchParams } from "next/navigation";
import { useState } from "react";
import { MasterEditor } from "./master-editor";
import { MasterTags } from "./master-tags";
import { WorkRelations } from "./work-relations";
import { VenueEditor } from "./venue-editor";
import { createVenueImageResearchPrompt } from "@/lib/admin/venue-image-research-prompt";
import { MASTER_CONFIGS, type MasterEntity } from "@/lib/admin/master-config";
import type { MasterRecord } from "@/lib/admin/master-repository";
import type { VenueRow } from "@/lib/admin/types";
import type { DetailPanel } from "@/lib/admin/master-list-state";

export type DetailRecord = MasterRecord & Record<string, unknown> & {
  completeness: { percent: number; items: Array<{ key: string; label: string; met: boolean }> };
  signedImageUrl: string | null;
};

type DetailTab = "status" | "edit" | "data";

export function MasterDetailContent({ entity, record, onOpenImageCandidate, onOpenReviewPanel }: { entity: MasterEntity; record: DetailRecord; onOpenImageCandidate?: (candidateId: string | null) => void; onOpenReviewPanel?: (panel: DetailPanel, options?: { candidateId?: string | null; runId?: string | null; targetUrl?: string | null }) => void }) {
  const searchParams = useSearchParams();
  const [tab, setTab] = useState<DetailTab>(() => entity === "venues" && searchParams.has("venueEdit") ? "edit" : "status");
  const config = MASTER_CONFIGS[entity];
  return <>
    <div className="detail-tabs" role="tablist" aria-label="Detail sections">
      {(["status", "edit", "data"] as const).map((value) => <button key={value} type="button" role="tab" aria-selected={tab === value} className={tab === value ? "is-active" : ""} onClick={() => setTab(value)}>{value === "status" ? "状態" : value === "edit" ? "編集" : "データ"}</button>)}
    </div>
    <div role="tabpanel" className="detail-tab-panel">
      {(entity !== "venues" || tab === "status") && <MasterEditor entity={entity} record={record} view={tab} embeddedInList/>}
      {tab === "edit" && entity !== "venues" && (
        <MasterTags entity={entity} masterId={record.id} rows={(record[`${config.singular}_tags`] || []) as Array<Record<string, unknown>>}/>
      )}
      {tab === "edit" && entity === "works" && <WorkRelations workId={record.id} artists={(record.work_artists || []) as Array<Record<string, unknown>>} holdings={(record.collection_holdings || []) as Array<Record<string, unknown>>} presentations={(record.work_presentations || []) as Array<Record<string, unknown>>}/>}
      {entity === "venues" && (
        <VenueEditor key={record.id} venue={record as unknown as VenueRow} prompt={createVenueImageResearchPrompt({ name: String(record.name), address: record.address ? String(record.address) : null, officialUrl: record.official_url ? String(record.official_url) : null })} showBasicForm={false} view={tab} tagRows={(record.venue_tags || []) as Array<Record<string, unknown>>} onOpenImageCandidate={onOpenImageCandidate} onOpenReviewPanel={onOpenReviewPanel}/>
      )}
    </div>
  </>;
}
