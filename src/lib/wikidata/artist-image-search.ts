import type { SupabaseClient } from "@supabase/supabase-js";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { saveArtistImageDiscovery } from "./artist-image-discovery";
import type { WikidataArtist } from "./artist-types";

export async function searchPriorityArtistImages(options: { limit?: number; artistIds?: string[]; dryRun?: boolean } = {}, db: SupabaseClient = createSupabaseAdminClient()) {
  let query = db.from("artists").select("id,name,effective_priority_tier,media_assets(id,is_primary),source_records!source_records_artist_id_fkey(id,raw_payload,external_id,data_sources(key),source_image_candidates(id,is_active))").in("effective_priority_tier", ["A", "B", "C"]).order("effective_priority_tier").order("name");
  if (options.artistIds?.length) query = query.in("id", options.artistIds);
  const { data, error } = await query.limit(Math.max(1, Math.min(200, options.limit || 20))); if (error) throw error;
  const rows = data || []; let processed = 0, candidateFound = 0, noCandidate = 0, added = 0; const errors: Array<{ artistId: string; message: string }> = [];
  for (const row of rows) {
    const source = (row.source_records || []).find((item: { external_id?: string; raw_payload?: unknown }) => /^Q\d+$/.test(item.external_id || "") && (item.raw_payload as { normalized?: unknown } | null)?.normalized);
    const artist = (source?.raw_payload as { normalized?: WikidataArtist } | undefined)?.normalized;
    if (!artist) { noCandidate += 1; continue; }
    processed += 1;
    try {
      if (options.dryRun) {
        const { discoverArtistImageFiles } = await import("./artist-image-discovery");
        const result = await discoverArtistImageFiles(artist); candidateFound += result.files.length ? 1 : 0; noCandidate += result.files.length ? 0 : 1;
      } else {
        const result = await saveArtistImageDiscovery(db, row.id, artist); candidateFound += result.saved.length ? 1 : 0; noCandidate += result.saved.length ? 0 : 1; added += result.added;
      }
    } catch (cause) { errors.push({ artistId: row.id, message: cause instanceof Error ? cause.message : "Artist image discovery failed" }); }
  }
  return { dryRun: Boolean(options.dryRun), requested: rows.length, processed, candidateFound, noCandidate, added, errors };
}
