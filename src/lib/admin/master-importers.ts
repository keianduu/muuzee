import type { MasterEntity } from "./master-config";

export type MasterImportResult = {
  fetched: number;
  created: number;
  linked?: number;
  updated: number;
  skipped: number;
  unchanged?: number;
  sourceSelectionRequired: number;
  imageCandidatesAdded?: number;
  errors: string[];
};

export type MasterImporter = {
  key: string;
  label: string;
  entity: MasterEntity;
  sampleAvailable: boolean;
  fullSyncAvailable: boolean;
  description: string;
};

export const MASTER_IMPORTERS: Record<MasterEntity, MasterImporter[]> = {
  venues: [
    {
      key: "wikidata-venue-import",
      label: "Wikidata",
      entity: "venues",
      sampleAvailable: true,
      fullSyncAvailable: true,
      description: "日本のMuseum / Art GalleryをQIDで同期します。新規はDraft、複数のidentity候補だけSource Selectionになります。",
    },
    {
      key: "wikidata-enrichment",
      label: "Wikidata / Existing Venue Enrichment",
      entity: "venues",
      sampleAvailable: true,
      fullSyncAvailable: false,
      description: "既存Venueの候補探索を少量実行します。座標・画像候補は人の確認前に採用されません。",
    },
  ],
  artists: [],
  works: [],
};
