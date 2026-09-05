export const MASTER_ENTITIES = ["venues", "artists", "works"] as const;

export type MasterEntity = (typeof MASTER_ENTITIES)[number];
export type MasterStatus = "draft" | "ready" | "published" | "archived";
export type MasterFieldType = "text" | "textarea" | "url" | "date" | "year" | "number" | "boolean" | "aliases" | "select";

export type MasterField = {
  key: string;
  label: string;
  type: MasterFieldType;
  required?: boolean;
  options?: readonly string[];
  full?: boolean;
  csv?: boolean;
};

import { FIELD_LABELS } from "./master-labels";

export type MasterConfig = {
  entity: MasterEntity;
  singular: "venue" | "artist" | "work";
  label: string;
  titleKey: "name" | "title";
  provenanceTable: "venue_field_sources" | "artist_field_sources" | "work_field_sources";
  ownerKey: "venue_id" | "artist_id" | "work_id";
  fields: readonly MasterField[];
  completeness: readonly { key: string; label: string; test?: (row: Record<string, unknown>) => boolean }[];
};

const commonStatus: MasterField = {
  key: "publication_status", label: "Publication", type: "select",
  options: ["draft", "ready", "published", "archived"], csv: true,
};

export const MASTER_CONFIGS: Record<MasterEntity, MasterConfig> = {
  venues: {
    entity: "venues", singular: "venue", label: "Venue", titleKey: "name",
    provenanceTable: "venue_field_sources", ownerKey: "venue_id",
    fields: [
      { key: "name", label: "Name", type: "text", required: true, csv: true },
      { key: "name_en", label: "English name", type: "text", csv: true },
      { key: "name_native", label: "Native name", type: "text", csv: true },
      { key: "aliases", label: "Aliases（| 区切り）", type: "aliases", full: true, csv: true },
      { key: "venue_type", label: "Venue type", type: "select", options: ["museum", "gallery", "art_space", "commercial_space", "other"], csv: true },
      { key: "country_code", label: "Country code", type: "text", csv: true },
      { key: "region", label: "Region", type: "text", csv: true },
      { key: "prefecture", label: "Prefecture", type: "text", csv: true },
      { key: "city", label: "City", type: "text", csv: true },
      { key: "district", label: "District", type: "text", csv: true },
      { key: "postal_code", label: "Postal code", type: "text", csv: true },
      { key: "address", label: "Address", type: "text", full: true, csv: true },
      { key: "latitude", label: "Latitude", type: "number", csv: true },
      { key: "longitude", label: "Longitude", type: "number", csv: true },
      { key: "official_url", label: "Official URL", type: "url", full: true, csv: true },
      { key: "inception_year", label: "Opening / inception year", type: "year", csv: true },
      { key: "description", label: "Description", type: "textarea", full: true, csv: true },
      { key: "access_text", label: "Access", type: "textarea", full: true, csv: true },
      { key: "opening_hours_text", label: "Opening hours", type: "textarea", full: true, csv: true },
      { key: "closed_days_text", label: "Closed days", type: "textarea", full: true, csv: true },
      { key: "opening_note", label: "Opening note", type: "textarea", full: true, csv: true },
      { key: "is_active", label: "Active", type: "boolean", csv: true },
      commonStatus,
    ],
    completeness: [
      { key: "name", label: "Name" }, { key: "address", label: "Address" },
      { key: "coordinates", label: "Coordinates", test: (row) => row.latitude != null && row.longitude != null },
      { key: "description", label: "Description" },
      { key: "image", label: "Image", test: (row) => Boolean((row.media_assets as Array<{ is_primary?: boolean }> | undefined)?.some((item) => item.is_primary)) },
      { key: "opening_hours_text", label: "Opening Hours" },
    ],
  },
  artists: {
    entity: "artists", singular: "artist", label: "Artist", titleKey: "name",
    provenanceTable: "artist_field_sources", ownerKey: "artist_id",
    fields: [
      { key: "name", label: "Name", type: "text", required: true, csv: true },
      { key: "name_en", label: "English name", type: "text", csv: true },
      { key: "name_native", label: "Native name", type: "text", csv: true },
      { key: "name_kana", label: "Kana", type: "text", csv: true },
      { key: "aliases", label: "Aliases（| 区切り）", type: "aliases", full: true, csv: true },
      { key: "birth_date", label: "Birth date", type: "date", csv: true },
      { key: "birth_year", label: "Birth year", type: "year", csv: true },
      { key: "death_date", label: "Death date", type: "date", csv: true },
      { key: "death_year", label: "Death year", type: "year", csv: true },
      { key: "nationality_country_code", label: "Nationality country code", type: "text", csv: true },
      { key: "birth_country_code", label: "Birth country code", type: "text", csv: true },
      { key: "birth_place", label: "Birth place", type: "text", csv: true },
      { key: "description", label: "Description", type: "textarea", full: true, csv: true },
      { key: "style_summary", label: "Style / genre", type: "textarea", full: true, csv: true },
      { key: "official_url", label: "Official URL", type: "url", full: true, csv: true },
      commonStatus,
    ],
    completeness: [
      { key: "name", label: "Name" },
      { key: "life", label: "Birth / Death", test: (row) => Boolean(row.birth_date || row.birth_year || row.death_date || row.death_year) },
      { key: "country", label: "Country", test: (row) => Boolean(row.nationality_country_code || row.birth_country_code) },
      { key: "description", label: "Description" }, { key: "style_summary", label: "Style" },
      { key: "image", label: "Image", test: (row) => Boolean((row.media_assets as Array<{ is_primary?: boolean }> | undefined)?.some((item) => item.is_primary)) },
    ],
  },
  works: {
    entity: "works", singular: "work", label: "Work", titleKey: "title",
    provenanceTable: "work_field_sources", ownerKey: "work_id",
    fields: [
      { key: "title", label: "Title", type: "text", required: true, csv: true },
      { key: "title_en", label: "English title", type: "text", csv: true },
      { key: "title_original", label: "Original title", type: "text", csv: true },
      { key: "year_text", label: "Year text", type: "text", csv: true },
      { key: "created_year_from", label: "Created year from", type: "year", csv: true },
      { key: "created_year_to", label: "Created year to", type: "year", csv: true },
      { key: "description", label: "Description", type: "textarea", full: true, csv: true },
      { key: "medium", label: "Medium", type: "text", full: true, csv: true },
      { key: "dimensions", label: "Dimensions", type: "text", full: true, csv: true },
      commonStatus,
    ],
    completeness: [
      { key: "title", label: "Title" },
      { key: "artist", label: "Artist", test: (row) => Boolean((row.work_artists as unknown[] | undefined)?.length) },
      { key: "description", label: "Description" },
      { key: "holding", label: "Holding Venue", test: (row) => Boolean((row.collection_holdings as unknown[] | undefined)?.length) },
      { key: "image", label: "Image", test: (row) => Boolean((row.media_assets as Array<{ is_primary?: boolean }> | undefined)?.some((item) => item.is_primary)) },
    ],
  },
};

for (const config of Object.values(MASTER_CONFIGS)) {
  for (const field of config.fields) {
    if (FIELD_LABELS[field.key]) field.label = FIELD_LABELS[field.key];
  }
}

export function isMasterEntity(value: string): value is MasterEntity {
  return (MASTER_ENTITIES as readonly string[]).includes(value);
}
