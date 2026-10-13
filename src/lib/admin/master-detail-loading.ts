import type { MasterEntity } from "./master-config";

export type MasterDetailTab = "status" | "edit" | "data";
export type ArtistEditTab = "basic" | "image" | "relations";
export type DeferredMasterScope = "data" | "media";

export function deferredMasterScopes(entity: MasterEntity, tab: MasterDetailTab, artistEditTab: ArtistEditTab, venueEditTab: string | null) {
  const scopes = new Set<DeferredMasterScope>();
  if (tab === "data") scopes.add("data");
  if (tab !== "edit") return [...scopes];
  if (entity === "works" || (entity === "artists" && artistEditTab === "image") || (entity === "venues" && venueEditTab === "image")) {
    scopes.add("data");
    scopes.add("media");
  }
  return [...scopes];
}
