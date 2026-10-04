import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { MediaAssetRow } from "./types";

export async function signedMediaAsset(db: SupabaseClient, assetId: string): Promise<MediaAssetRow> {
  const { data: asset, error } = await db.from("media_assets").select("*").eq("id", assetId).single();
  if (error || !asset) throw error || new Error("登録画像を読み込めませんでした。");
  const { data: signed } = await db.storage.from("exhibition-images").createSignedUrl(asset.storage_path, 3600);
  return { ...asset, signedUrl: signed?.signedUrl || null } as MediaAssetRow;
}
