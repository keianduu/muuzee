"use client";

import { useState } from "react";
import { MasterEditor } from "./master-editor";
import { MasterTags } from "./master-tags";
import { WorkRelations } from "./work-relations";
import { VenueEditor } from "./venue-editor";
import { createVenueImageResearchPrompt } from "@/lib/admin/venue-image-research-prompt";
import { MASTER_CONFIGS, type MasterEntity } from "@/lib/admin/master-config";
import type { MasterRecord } from "@/lib/admin/master-repository";
import type { VenueRow } from "@/lib/admin/types";

export type DetailRecord = MasterRecord & Record<string, unknown> & {
  completeness: { percent: number; items: Array<{ key: string; label: string; met: boolean }> };
  signedImageUrl: string | null;
};

type DetailTab = "status" | "edit" | "data";

export function MasterDetailContent({ entity, record }: { entity: MasterEntity; record: DetailRecord }) {
  const [tab, setTab] = useState<DetailTab>("status");
  const config = MASTER_CONFIGS[entity];
  return <>
    <div className="detail-tabs" role="tablist" aria-label="Detail sections">
      {(["status", "edit", "data"] as const).map((value) => <button key={value} type="button" role="tab" aria-selected={tab === value} className={tab === value ? "is-active" : ""} onClick={() => setTab(value)}>{value === "status" ? "状態" : value === "edit" ? "編集" : "データ"}</button>)}
    </div>
    <div role="tabpanel" className="detail-tab-panel">
      <MasterEditor entity={entity} record={record} view={tab} embeddedInList/>
      {tab === "edit" && <MasterTags entity={entity} masterId={record.id} rows={(record[`${config.singular}_tags`] || []) as Array<Record<string, unknown>>}/>}
      {tab === "edit" && entity === "works" && <WorkRelations workId={record.id} artists={(record.work_artists || []) as Array<Record<string, unknown>>} holdings={(record.collection_holdings || []) as Array<Record<string, unknown>>} presentations={(record.work_presentations || []) as Array<Record<string, unknown>>}/>}
      {entity === "venues" && <VenueEditor venue={record as unknown as VenueRow} prompt={createVenueImageResearchPrompt({ name: String(record.name), address: record.address ? String(record.address) : null, officialUrl: record.official_url ? String(record.official_url) : null })} showBasicForm={false} view={tab}/>}
    </div>
  </>;
}
