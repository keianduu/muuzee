import { createSupabaseAdminClient, hasSupabaseAdminEnvironment } from "@/lib/supabase/admin";
import type { ExhibitionRow, MediaAssetRow, VenueRow } from "./types";

export type AdminData<T> = { data: T; error: string | null; configured: boolean };

async function safe<T>(fallback: T, work: () => Promise<T>): Promise<AdminData<T>> {
  if (!hasSupabaseAdminEnvironment()) {
    return { data: fallback, error: "Supabase環境変数が未設定です。", configured: false };
  }
  try {
    return { data: await work(), error: null, configured: true };
  } catch (error) {
    return { data: fallback, error: error instanceof Error ? error.message : "Unknown database error", configured: true };
  }
}

export async function getDashboardData() {
  return safe(
    { total: 0, draft: 0, imageMissing: 0, ready: 0, published: 0, lastImport: null as Record<string, unknown> | null },
    async () => {
      const db = createSupabaseAdminClient();
      const [exhibitions, assets, imports] = await Promise.all([
        db.from("exhibitions").select("id, publication_status"),
        db.from("media_assets").select("exhibition_id").eq("is_primary", true),
        db.from("import_runs").select("*, data_sources(name)").order("started_at", { ascending: false }).limit(1),
      ]);
      if (exhibitions.error) throw exhibitions.error;
      if (assets.error) throw assets.error;
      if (imports.error) throw imports.error;
      const rows = exhibitions.data || [];
      const withImage = new Set((assets.data || []).map((asset) => asset.exhibition_id));
      return {
        total: rows.length,
        draft: rows.filter((row) => row.publication_status === "draft").length,
        imageMissing: rows.filter((row) => !withImage.has(row.id)).length,
        ready: rows.filter((row) => row.publication_status === "ready").length,
        published: rows.filter((row) => row.publication_status === "published").length,
        lastImport: imports.data?.[0] || null,
      };
    },
  );
}

export async function getImportRuns() {
  return safe([] as Record<string, unknown>[], async () => {
    const { data, error } = await createSupabaseAdminClient()
      .from("import_runs")
      .select("*, data_sources(name)")
      .order("started_at", { ascending: false })
      .limit(30);
    if (error) throw error;
    return data || [];
  });
}

export async function getExhibitions() {
  return safe([] as ExhibitionRow[], async () => {
    const db = createSupabaseAdminClient();
    const { data, error } = await db
      .from("exhibitions")
      .select("*, exhibition_occurrences(*, venues(*)), exhibition_artists(id,artist_id,relation_status), exhibition_artist_mentions(id,match_status,resolution_status), exhibition_venue_mentions(id,match_status,resolution_status,last_seen_at), media_assets(*), source_records(*, data_sources(name,key), source_image_candidates(*))")
      .order("updated_at", { ascending: false });
    if (error) throw error;
    const exhibitions = (data || []) as unknown as ExhibitionRow[];
    return Promise.all(exhibitions.map(async (exhibition) => ({
      ...exhibition,
      media_assets: await Promise.all((exhibition.media_assets || []).map(async (asset) => {
        if (!asset.is_primary) return asset;
        const { data: signed } = await db.storage.from("exhibition-images").createSignedUrl(asset.storage_path, 3600);
        return { ...asset, signedUrl: signed?.signedUrl || null };
      })),
    })));
  });
}

export async function getExhibition(id: string) {
  return safe(null as ExhibitionRow | null, async () => {
    const db = createSupabaseAdminClient();
    const { data, error } = await db
      .from("exhibitions")
      .select("*, exhibition_occurrences(*, venues(*)), exhibition_artists(id,artist_id,relation_status), exhibition_artist_mentions(id,match_status,resolution_status), exhibition_venue_mentions(id,match_status,resolution_status,last_seen_at), media_assets(*), source_records(*, data_sources(name,key), source_image_candidates(*))")
      .eq("id", id)
      .single();
    if (error) throw error;
    const exhibition = data as unknown as ExhibitionRow;
    exhibition.media_assets = await Promise.all(
      (exhibition.media_assets || []).map(async (asset: MediaAssetRow) => {
        const { data: signed } = await db.storage.from("exhibition-images").createSignedUrl(asset.storage_path, 3600);
        return { ...asset, signedUrl: signed?.signedUrl || null };
      }),
    );
    return exhibition;
  });
}

async function withSignedVenueAssets(venue: VenueRow, db: ReturnType<typeof createSupabaseAdminClient>) {
  return {
    ...venue,
    media_assets: await Promise.all((venue.media_assets || []).map(async (asset) => {
      const { data: signed } = await db.storage.from("exhibition-images").createSignedUrl(asset.storage_path, 3600);
      return { ...asset, signedUrl: signed?.signedUrl || null };
    })),
  };
}

export async function getVenues() {
  return safe([] as VenueRow[], async () => {
    const db = createSupabaseAdminClient();
    const { data, error } = await db.from("venues")
      .select("*, exhibition_occurrences(id), media_assets(*), source_records!source_records_venue_id_fkey(*, data_sources(name,key), source_image_candidates(*)), venue_external_match_candidates(*)")
      .order("updated_at", { ascending: false });
    if (error) throw error;
    return Promise.all(((data || []) as unknown as VenueRow[]).map((venue) => withSignedVenueAssets(venue, db)));
  });
}

export async function getVenue(id: string) {
  return safe(null as VenueRow | null, async () => {
    const db = createSupabaseAdminClient();
    const { data, error } = await db.from("venues")
      .select("*, exhibition_occurrences(*, exhibitions(*)), media_assets(*), source_records!source_records_venue_id_fkey(*, data_sources(name,key), source_image_candidates(*)), venue_external_match_candidates(*)")
      .eq("id", id).single();
    if (error) throw error;
    return withSignedVenueAssets(data as unknown as VenueRow, db);
  });
}

export function firstRelation<T>(value: T | T[] | null | undefined): T | null {
  return Array.isArray(value) ? value[0] || null : value || null;
}
