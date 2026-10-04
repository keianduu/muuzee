import type { MediaAssetRow } from "./types";

export type AdminMediaEntity = "venues" | "artists" | "works" | "exhibitions";

export type AdminMediaMutation = {
  entity: AdminMediaEntity;
  ownerId: string;
  asset?: MediaAssetRow;
  removedAssetId?: string;
};

export const ADMIN_MEDIA_UPDATED_EVENT = "muuzee:admin-media-updated";

export function shouldSetManualMediaPrimary(registeredCount: number | null) {
  return registeredCount === 0;
}

export function applyMediaAssetMutation(current: MediaAssetRow[], mutation: Pick<AdminMediaMutation, "asset" | "removedAssetId">) {
  if (mutation.removedAssetId) return current.filter((asset) => asset.id !== mutation.removedAssetId);
  if (!mutation.asset) return current;
  const next = current.filter((asset) => asset.id !== mutation.asset!.id).map((asset) => mutation.asset!.is_primary ? { ...asset, is_primary: false } : asset);
  return [mutation.asset, ...next].sort((a, b) => Number(b.is_primary) - Number(a.is_primary));
}

export function dispatchAdminMediaMutation(mutation: AdminMediaMutation) {
  window.dispatchEvent(new CustomEvent(ADMIN_MEDIA_UPDATED_EVENT, { detail: mutation }));
}
