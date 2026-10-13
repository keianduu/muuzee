import { describe, expect, it } from "vitest";
import type { MediaAssetRow } from "./types";
import { applyMediaAssetMutation, applyMediaMutationToLoadedCache, shouldSetManualMediaPrimary } from "./media-asset-state";

function asset(id: string, primary = false): MediaAssetRow {
  return { id, exhibition_id: null, venue_id: "venue-1", artist_id: null, work_id: null, kind: "image", storage_path: `${id}.jpg`, original_filename: `${id}.jpg`, source_type: "other", source_url: null, credit: null, usage_note: null, reported_license: null, reported_license_url: null, reported_author: null, reported_usage_terms: null, rights_status: "needs_review", rights_checked_at: null, valid_until: null, is_primary: primary, created_at: "2026-10-04T00:00:00Z", signedUrl: `https://signed.example/${id}.jpg` };
}

describe("immediate media asset state", () => {
  it("adds the returned upload as primary and demotes the previous local primary", () => {
    expect(applyMediaAssetMutation([asset("old", true)], { asset: asset("new", true) })).toEqual([
      asset("new", true), asset("old", false),
    ]);
  });

  it("removes the deleted asset so the zero-image acquisition state can render immediately", () => {
    expect(applyMediaAssetMutation([asset("only", true)], { removedAssetId: "only" })).toEqual([]);
  });

  it("adds an asset to an already-loaded lazy media cache", () => {
    const current = { id: "venue-1", media_assets: [asset("old", true)] };
    expect(applyMediaMutationToLoadedCache(current, "venues", "venue-1", {
      entity: "venues",
      ownerId: "venue-1",
      asset: asset("new"),
    })?.media_assets).toEqual([asset("old", true), asset("new")]);
  });

  it("removes an asset from an already-loaded lazy media cache", () => {
    const current = { id: "venue-1", media_assets: [asset("only", true)] };
    expect(applyMediaMutationToLoadedCache(current, "venues", "venue-1", {
      entity: "venues",
      ownerId: "venue-1",
      removedAssetId: "only",
    })?.media_assets).toEqual([]);
  });

  it("keeps exactly one Primary asset in the loaded lazy media cache", () => {
    const current = { id: "venue-1", media_assets: [asset("old", true), asset("other")] };
    expect(applyMediaMutationToLoadedCache(current, "venues", "venue-1", {
      entity: "venues",
      ownerId: "venue-1",
      asset: asset("new", true),
    })?.media_assets).toEqual([asset("new", true), asset("old"), asset("other")]);
  });

  it.each([
    { entity: "artists" as const, ownerId: "venue-1" },
    { entity: "venues" as const, ownerId: "venue-2" },
  ])("ignores a media mutation for another entity or owner", (mutation) => {
    const current = { id: "venue-1", media_assets: [asset("old", true)] };
    expect(applyMediaMutationToLoadedCache(current, "venues", "venue-1", {
      ...mutation,
      asset: asset("new", true),
    })).toBe(current);
  });

  it("does not materialize a lazy media cache that has not been loaded", () => {
    expect(applyMediaMutationToLoadedCache(undefined, "venues", "venue-1", {
      entity: "venues",
      ownerId: "venue-1",
      asset: asset("new", true),
    })).toBeUndefined();
  });

  it.each(["venues", "artists", "works", "exhibitions"])("uses the same automatic-primary rule for %s", () => {
    expect(shouldSetManualMediaPrimary(0)).toBe(true);
    expect(shouldSetManualMediaPrimary(1)).toBe(false);
  });
});
