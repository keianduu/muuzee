import type { SupabaseClient } from "@supabase/supabase-js";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { importWikidataArtists } from "@/lib/wikidata/artist-importer";
import { resolveWikidataArtistNames } from "@/lib/wikidata/artist-discovery";
import { extractKnownArtistsFromTitle, extractStructuredArtistMentions, matchArtistMention, normalizeArtistName, type MatchableArtist } from "./mention";

type Source = { id: string; raw_payload: unknown; data_sources?: { key?: string } | Array<{ key?: string }> };
type Exhibition = { id: string; title: string; source_records?: Source[] };

function sourcePriority(source: Source) {
  const rows = Array.isArray(source.data_sources) ? source.data_sources : source.data_sources ? [source.data_sources] : [];
  return rows.some((item) => item.key === "art_commons_jpsearch") ? 0 : 1;
}

async function loadArtists(db: SupabaseClient): Promise<MatchableArtist[]> {
  const { data, error } = await db.from("artists").select("id,name,name_en,aliases,birth_year,source_records!source_records_artist_id_fkey(external_id)");
  if (error) throw error;
  return (data || []).map((row) => ({ ...row, qid: (row.source_records || []).find((source: { external_id?: string }) => /^Q\d+$/.test(source.external_id || ""))?.external_id || null }));
}

async function loadExhibitions(db: SupabaseClient, limit: number): Promise<Exhibition[]> {
  const { data, error } = await db.from("exhibitions").select("id,title,source_records!source_records_exhibition_id_fkey(id,raw_payload,data_sources(key))").order("updated_at", { ascending: false }).limit(limit);
  if (error) throw error;
  return (data || []) as unknown as Exhibition[];
}

export type ExhibitionArtistMatchSummary = {
  dryRun: boolean;
  exhibitionsScanned: number;
  mentions: number;
  structuredMentions: number;
  titleMentions: number;
  matched: number;
  ambiguous: number;
  unmatched: number;
  targetedImports: number;
  relationsCreated: number;
  relationsExisting: number;
  errors: Array<{ exhibitionId?: string; name?: string; message: string }>;
};

export async function matchExhibitionArtists(options: { limit?: number; dryRun?: boolean } = {}, db: SupabaseClient = createSupabaseAdminClient()): Promise<ExhibitionArtistMatchSummary> {
  const limit = Math.max(1, Math.min(1000, options.limit || 500));
  let artists = await loadArtists(db);
  const exhibitions = await loadExhibitions(db, limit);
  const summary: ExhibitionArtistMatchSummary = { dryRun: Boolean(options.dryRun), exhibitionsScanned: exhibitions.length, mentions: 0, structuredMentions: 0, titleMentions: 0, matched: 0, ambiguous: 0, unmatched: 0, targetedImports: 0, relationsCreated: 0, relationsExisting: 0, errors: [] };

  for (const exhibition of exhibitions) {
    try {
      const sources = [...(exhibition.source_records || [])].sort((a, b) => sourcePriority(a) - sourcePriority(b));
      const structured = sources.flatMap((source) => extractStructuredArtistMentions(source.raw_payload).map((mention) => ({ ...mention, sourceRecordId: source.id })));
      const mentions = structured.length ? structured : extractKnownArtistsFromTitle(exhibition.title, artists).map((mention) => ({ ...mention, sourceRecordId: null }));
      summary.mentions += mentions.length;
      summary.structuredMentions += structured.length;
      summary.titleMentions += structured.length ? 0 : mentions.length;

      for (const mention of mentions) {
        let match = matchArtistMention(mention.name, artists);
        let targetedQid: string | null = null;
        if (match.status === "unmatched" && mention.method === "structured_source") {
          const [resolution] = await resolveWikidataArtistNames([mention.name]);
          if (resolution?.status === "matched" && resolution.qid) {
            targetedQid = resolution.qid;
            if (!options.dryRun) {
              const imported = await importWikidataArtists({ mode: "count", qids: [resolution.qid] }, db);
              summary.targetedImports += imported.newArtists + imported.linkedExisting;
              artists = await loadArtists(db);
              match = matchArtistMention(mention.name, artists);
            }
          }
        }
        if (match.status === "matched") summary.matched += 1;
        else if (match.status === "ambiguous") summary.ambiguous += 1;
        else summary.unmatched += 1;

        if (options.dryRun) continue;
        const matched = match.status === "matched" ? match.candidates[0] : null;
        const { error: mentionError } = await db.from("exhibition_artist_mentions").upsert({
          exhibition_id: exhibition.id,
          source_record_id: mention.sourceRecordId,
          source_artist_name: mention.name,
          normalized_name: normalizeArtistName(mention.name),
          role: mention.role,
          extraction_method: mention.method,
          match_status: matched ? "matched" : match.status === "ambiguous" ? "candidate" : "unmatched",
          matched_artist_id: matched?.id || null,
          candidate_artist_ids: match.candidates.map((artist) => artist.id),
          targeted_import_qid: targetedQid,
          match_reason: matched ? "Exact canonical name/name_en/alias" : match.status === "ambiguous" ? "Multiple exact name/alias candidates" : "No exact canonical candidate",
        }, { onConflict: "exhibition_id,normalized_name" });
        if (mentionError) throw mentionError;
        if (matched) {
          const { data: prior, error: priorError } = await db.from("exhibition_artists").select("id").eq("exhibition_id", exhibition.id).eq("artist_id", matched.id).maybeSingle();
          if (priorError) throw priorError;
          if (prior) summary.relationsExisting += 1;
          else {
            const { error } = await db.from("exhibition_artists").insert({ exhibition_id: exhibition.id, artist_id: matched.id, source_artist_name: mention.name, role: mention.role, match_status: "matched" });
            if (error) throw error;
            summary.relationsCreated += 1;
          }
        }
      }
    } catch (error) {
      summary.errors.push({ exhibitionId: exhibition.id, message: error instanceof Error ? error.message : "Exhibition Artist matching failed" });
    }
  }
  if (!options.dryRun && summary.errors.length === 0) {
    const { error } = await db.rpc("refresh_artist_priority_tiers", { p_as_of: new Date().toISOString().slice(0, 10) });
    if (error) summary.errors.push({ message: error.message });
  }
  return summary;
}
