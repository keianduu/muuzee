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
import { AdminTabs } from "./admin-tabs";

export type DetailRecord = MasterRecord & Record<string, unknown> & {
  completeness: { percent: number; items: Array<{ key: string; label: string; met: boolean }> };
  signedImageUrl: string | null;
};

type DetailTab = "status" | "edit" | "data";
type ArtistEditTab = "basic" | "image" | "relations";

const DETAIL_TABS = [{ id: "status", label: "状態" }, { id: "edit", label: "編集" }, { id: "data", label: "データ" }] as const;
const ARTIST_EDIT_TABS = [{ id: "basic", label: "基本情報" }, { id: "image", label: "画像登録" }, { id: "relations", label: "関連情報" }] as const;

export function MasterDetailContent({ entity, record, onOpenImageCandidate, onOpenReviewPanel }: { entity: MasterEntity; record: DetailRecord; onOpenImageCandidate?: (candidateId: string | null) => void; onOpenReviewPanel?: (panel: DetailPanel, options?: { candidateId?: string | null; runId?: string | null; targetUrl?: string | null }) => void }) {
  const searchParams = useSearchParams();
  const [tab, setTab] = useState<DetailTab>(() => entity === "venues" && searchParams.has("venueEdit") ? "edit" : "status");
  const [artistEditTab, setArtistEditTab] = useState<ArtistEditTab>("basic");
  const config = MASTER_CONFIGS[entity];
  return <>
    <AdminTabs tabs={DETAIL_TABS} value={tab} onChange={setTab} label="詳細セクション"/>
    <div role="tabpanel" className="detail-tab-panel">
      {(entity !== "venues" || tab === "status") && !(entity === "artists" && tab === "edit") && <MasterEditor entity={entity} record={record} view={tab} embeddedInList/>}
      {tab === "edit" && entity === "artists" && <div className="artist-edit-surface">
        <AdminTabs tabs={ARTIST_EDIT_TABS} value={artistEditTab} onChange={setArtistEditTab} label="Artist編集セクション" variant="edit" returnAnchor="image"/>
        <MasterEditor entity={entity} record={record} view="edit" editSection={artistEditTab} embeddedInList onOpenImageCandidate={onOpenImageCandidate}/>
        {artistEditTab === "relations" && <MasterTags entity={entity} masterId={record.id} rows={(record[`${config.singular}_tags`] || []) as Array<Record<string, unknown>>}/>}
      </div>}
      {tab === "edit" && entity !== "venues" && entity !== "artists" && (
        <MasterTags entity={entity} masterId={record.id} rows={(record[`${config.singular}_tags`] || []) as Array<Record<string, unknown>>}/>
      )}
      {tab === "edit" && entity === "works" && <WorkRelations workId={record.id} artists={(record.work_artists || []) as Array<Record<string, unknown>>} holdings={(record.collection_holdings || []) as Array<Record<string, unknown>>} presentations={(record.work_presentations || []) as Array<Record<string, unknown>>}/>}
      {entity === "venues" && (
        <VenueEditor key={record.id} venue={record as unknown as VenueRow} prompt={createVenueImageResearchPrompt({ name: String(record.name), address: record.address ? String(record.address) : null, officialUrl: record.official_url ? String(record.official_url) : null })} showBasicForm={false} view={tab} tagRows={(record.venue_tags || []) as Array<Record<string, unknown>>} onOpenImageCandidate={onOpenImageCandidate} onOpenReviewPanel={onOpenReviewPanel}/>
      )}
    </div>
  </>;
}
