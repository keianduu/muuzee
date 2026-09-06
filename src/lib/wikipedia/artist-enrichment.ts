import { createHash } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { shouldApplySourceField } from "@/lib/venue-enrichment/source-application";
import { resolveWikipediaSite } from "./client";
import { fetchWikipediaArtistProfile } from "./artist-client";

export type WikipediaArtistScope = "A" | "A-B" | "A-C" | "selected";
const METRIC_FIELDS = ["nationality", "nameEn", "aliases", "birth", "death", "birthPlace"] as const;

function tiers(scope: WikipediaArtistScope) { return scope === "A" ? ["A"] : scope === "A-B" ? ["A", "B"] : ["A", "B", "C"]; }
function qid(row: Record<string, unknown>) { return ((row.source_records || []) as Array<{ external_id?: string }>).find((source) => /^Q\d+$/.test(source.external_id || ""))?.external_id || null; }
function present(row: Record<string, unknown>, field: typeof METRIC_FIELDS[number]) {
  if (field === "nationality") return Boolean(row.nationality_country_code);
  if (field === "nameEn") return Boolean(row.name_en);
  if (field === "aliases") return Boolean((row.aliases as unknown[] | undefined)?.length);
  if (field === "birth") return Boolean(row.birth_date || row.birth_year);
  if (field === "death") return Boolean(row.death_date || row.death_year);
  return Boolean(row.birth_place);
}
function coverage(rows: Record<string, unknown>[]) { return Object.fromEntries(METRIC_FIELDS.map((field) => [field, rows.filter((row) => present(row, field)).length])); }

async function targetRows(db: SupabaseClient, options: { scope: WikipediaArtistScope; limit: number; artistIds?: string[] }) {
  let query = db.from("artists").select("*,artist_field_sources(field_name,source,is_current),source_records!source_records_artist_id_fkey(id,external_id,data_sources(key))").in("effective_priority_tier", tiers(options.scope)).order("effective_priority_tier").order("name");
  if (options.scope === "selected") query = query.in("id", options.artistIds || []);
  const { data, error } = await query; if (error) throw error;
  return ((data || []) as Record<string, unknown>[]).filter((row) => !row.nationality_country_code && qid(row)).slice(0, options.limit);
}

async function saveSource(db: SupabaseClient, artist: Record<string, unknown>, qidValue: string, article: NonNullable<Awaited<ReturnType<typeof fetchWikipediaArtistProfile>>>) {
  const { data: source, error: sourceError } = await db.from("data_sources").select("id").eq("key", "wikipedia").single(); if (sourceError || !source) throw sourceError || new Error("Wikipedia source not registered");
  const rawPayload = { qid: qidValue, language: article.language, title: article.title, pageId: article.pageId, profile: article.profile };
  const externalId = `artist:${String(artist.id)}:${article.language}:${article.pageId ?? article.title}`;
  const { data, error } = await db.from("source_records").upsert({ data_source_id: source.id, external_id: externalId, artist_id: artist.id, source_url: article.url, raw_payload: rawPayload, checksum: createHash("sha256").update(JSON.stringify(rawPayload)).digest("hex"), fetched_at: new Date().toISOString() }, { onConflict: "data_source_id,external_id" }).select("id").single();
  if (error || !data) throw error || new Error("Wikipedia source record save failed"); return data.id as string;
}

async function applyProfile(db: SupabaseClient, artist: Record<string, unknown>, sourceRecordId: string, article: NonNullable<Awaited<ReturnType<typeof fetchWikipediaArtistProfile>>>) {
  const currentSources = new Map(((artist.artist_field_sources || []) as Array<{ field_name: string; source: string; is_current: boolean }>).filter((row) => row.is_current).map((row) => [row.field_name, row.source]));
  const incoming: Record<string, unknown> = {
    nationality_country_code: article.profile.nationalityCountryCode,
    name_en: article.profile.nameEn,
    aliases: article.profile.aliases.length ? [...new Set([...(artist.aliases as string[] || []), ...article.profile.aliases])] : null,
    birth_year: article.profile.birthYear,
    death_year: article.profile.deathYear,
    birth_place: article.profile.birthPlace,
  };
  const updates: Record<string, unknown> = {}; const applied: string[] = [];
  for (const [field, value] of Object.entries(incoming)) {
    if (value == null || (Array.isArray(value) && !value.length)) continue;
    if (!shouldApplySourceField(artist[field], currentSources.get(field), "wikipedia")) continue;
    if (JSON.stringify(artist[field]) === JSON.stringify(value)) continue;
    await db.from("artist_field_sources").update({ is_current: false }).eq("artist_id", artist.id).eq("field_name", field).eq("is_current", true);
    const { error } = await db.from("artist_field_sources").insert({ artist_id: artist.id, field_name: field, source: "wikipedia", source_url: article.url, source_record_id: sourceRecordId, value_snapshot: value, generated_by_ai: false, review_status: "applied", is_current: true }); if (error) throw error;
    updates[field] = value; applied.push(field);
  }
  if (applied.length) { const { error } = await db.from("artists").update(updates).eq("id", artist.id); if (error) throw error; }
  return applied;
}

export async function enrichArtistsFromWikipedia(options: { scope?: WikipediaArtistScope; limit?: number; artistIds?: string[]; dryRun?: boolean } = {}, db: SupabaseClient = createSupabaseAdminClient()) {
  const scope = options.scope || "A-C"; const rows = await targetRows(db, { scope, limit: Math.max(1, Math.min(200, options.limit || 35)), artistIds: options.artistIds }); const before = coverage(rows);
  const results: Array<Record<string, unknown>> = [];
  for (const [index, artist] of rows.entries()) {
    if (index) await new Promise((resolve) => setTimeout(resolve, 200));
    try {
      const qidValue = qid(artist)!; const site = await resolveWikipediaSite(qidValue); if (!site) { results.push({ artistId: artist.id, name: artist.name, qid: qidValue, status: "no_article" }); continue; }
      const article = await fetchWikipediaArtistProfile(site); if (!article) { results.push({ artistId: artist.id, name: artist.name, qid: qidValue, status: "no_article" }); continue; }
      const profile = article.profile;
      if (!profile.nationalityCountryCode) { results.push({ artistId: artist.id, name: artist.name, qid: qidValue, status: profile.explicitNationality ? "ambiguous_nationality" : "nationality_not_explicit", article: article.url, profile }); continue; }
      const applicable = Object.entries({ nationality_country_code: profile.nationalityCountryCode, name_en: profile.nameEn, aliases: profile.aliases, birth_year: profile.birthYear, death_year: profile.deathYear, birth_place: profile.birthPlace }).filter(([, value]) => value != null && (!Array.isArray(value) || value.length));
      let applied: string[] = applicable.map(([field]) => field);
      if (!options.dryRun) { const sourceRecordId = await saveSource(db, artist, qidValue, article); applied = await applyProfile(db, artist, sourceRecordId, article); }
      results.push({ artistId: artist.id, name: artist.name, qid: qidValue, status: applied.length ? "applied" : "unchanged", article: article.url, profile, applied });
    } catch (error) { results.push({ artistId: artist.id, name: artist.name, qid: qid(artist), status: "error", message: error instanceof Error ? error.message : "failed" }); }
  }
  const afterRows = options.dryRun ? rows.map((row) => { const result = results.find((item) => item.artistId === row.id && item.status === "applied") as { profile?: Record<string, unknown> } | undefined; return result?.profile ? { ...row, nationality_country_code: result.profile.nationalityCountryCode || row.nationality_country_code, name_en: result.profile.nameEn || row.name_en, aliases: (result.profile.aliases as unknown[] | undefined)?.length ? result.profile.aliases : row.aliases, birth_year: result.profile.birthYear || row.birth_year, death_year: result.profile.deathYear || row.death_year, birth_place: result.profile.birthPlace || row.birth_place } : row; }) : await targetRowsAfter(db, rows.map((row) => String(row.id)));
  return { dryRun: Boolean(options.dryRun), requested: rows.length, processed: results.length, before, after: coverage(afterRows), explicitSingleNationality: results.filter((row) => row.status === "applied").length, noExplicitNationality: results.filter((row) => row.status === "nationality_not_explicit").length, ambiguousNationality: results.filter((row) => row.status === "ambiguous_nationality").length, errors: results.filter((row) => row.status === "error").length, results };
}

async function targetRowsAfter(db: SupabaseClient, ids: string[]) { if (!ids.length) return []; const { data, error } = await db.from("artists").select("*").in("id", ids); if (error) throw error; return data as Record<string, unknown>[]; }
