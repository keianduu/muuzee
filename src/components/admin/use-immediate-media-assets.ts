"use client";

import { useEffect, useState } from "react";
import { ADMIN_MEDIA_UPDATED_EVENT, applyMediaAssetMutation, type AdminMediaEntity, type AdminMediaMutation } from "@/lib/admin/media-asset-state";
import type { MediaAssetRow } from "@/lib/admin/types";

export const EMPTY_MEDIA_ASSETS: MediaAssetRow[] = [];

export function useImmediateMediaAssets(initialAssets: MediaAssetRow[], entity: AdminMediaEntity, ownerId: string) {
  const [assets, setAssets] = useState(initialAssets);

  useEffect(() => setAssets(initialAssets), [initialAssets]);
  useEffect(() => {
    const update = (event: Event) => {
      const mutation = (event as CustomEvent<AdminMediaMutation>).detail;
      if (mutation?.entity !== entity || mutation.ownerId !== ownerId) return;
      setAssets((current) => applyMediaAssetMutation(current, mutation));
    };
    window.addEventListener(ADMIN_MEDIA_UPDATED_EVENT, update);
    return () => window.removeEventListener(ADMIN_MEDIA_UPDATED_EVENT, update);
  }, [entity, ownerId]);

  return assets;
}
