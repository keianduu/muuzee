import { createHash } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getCommonsImageMetadata, getWikipediaLeadImage, listCommonsCategoryFiles } from "@/lib/wikimedia-commons/client";
import { autoSetPreferredMasterCandidatePrimary } from "@/lib/admin/master-primary-image";
import type { WikidataArtist } from "./artist-types";

export type ArtistImageSource = "wikidata_p18" | "commons_category" | "wikipedia_article";
export type ArtistImageSubjectType = "portrait_photo" | "artist_at_work" | "self_portrait" | "portrait_artwork" | "other";
export type ArtistImageFile = { fileTitle: string; discoverySource: ArtistImageSource; subjectType: ArtistImageSubjectType; score: number };
const PRIORITY: Record<ArtistImageSource, number> = { wikidata_p18: 3, wikipedia_article: 2, commons_category: 1 };
const SUBJECT_PRIORITY: Record<ArtistImageSubjectType, number> = { portrait_photo: 5, artist_at_work: 4, self_portrait: 3, portrait_artwork: 2, other: 1 };
const EXCLUDED = /(?:\bartwork\b|\bposter\b|\bbook[ _-]?cover\b|\bsignature\b|\blogo\b|\bmap\b|\bdiagram\b|作品|ポスター|署名|ロゴ|地図)/i;
const PERSON = /(?:portrait|self[ _-]?portrait|photograph|photo|headshot|artist|painter|sculptor|photographer|肖像|人物|本人|作家|画家|彫刻家|写真家)/i;

function normalized(value: string) { return value.replace(/^(?:File|ファイル):/i, "").replace(/\.[^.]+$/, "").replace(/[_\W]+/gu, "").toLowerCase(); }
export function classifyArtistImageTitle(fileTitle: string): ArtistImageSubjectType {
  if (/(?:self[ _-]?portrait|autoportrait|selbstbildnis|自画像)/i.test(fileTitle)) return "self_portrait";
  if (/(?:at work|in (?:the )?studio|working|作業中|制作中|アトリエ)/i.test(fileTitle)) return "artist_at_work";
  if (/(?:photograph|photo|headshot|写真)/i.test(fileTitle)) return "portrait_photo";
  if (/(?:portrait|bust|肖像|胸像)/i.test(fileTitle)) return "portrait_artwork";
  return "other";
}

export function scoreArtistImageTitle(fileTitle: string, names: string[], source: ArtistImageSource) {
  const subjectType = classifyArtistImageTitle(fileTitle);
  if (/\.svg$/i.test(fileTitle) || EXCLUDED.test(fileTitle) || (/\b(?:painting|sculpture)\b|絵画|彫刻/i.test(fileTitle) && subjectType !== "self_portrait" && subjectType !== "portrait_artwork")) return null;
  const title = normalized(fileTitle); let score = PRIORITY[source] * 10; let nameMatch = false;
  for (const name of names.filter(Boolean)) { const compact = normalized(name); if (compact.length >= 4 && title.includes(compact)) { score += 24; nameMatch = true; } }
  if (PERSON.test(fileTitle)) score += 12;
  score += SUBJECT_PRIORITY[subjectType];
  if (source !== "wikidata_p18" && !nameMatch && !PERSON.test(fileTitle)) return null;
  return score;
}

export function selectArtistImageFiles(input: { p18: string | null; commonsFiles: string[]; wikipediaFiles: string[]; names: string[]; limit?: number }) {
  const found = new Map<string, ArtistImageFile>();
  const add = (fileTitle: string, discoverySource: ArtistImageSource) => { const score = scoreArtistImageTitle(fileTitle, input.names, discoverySource); if (score == null) return; const key = normalized(fileTitle); const current = found.get(key); if (!current || score > current.score) found.set(key, { fileTitle: fileTitle.replace(/^ファイル:/, "File:"), discoverySource, subjectType: classifyArtistImageTitle(fileTitle), score }); };
  if (input.p18) add(input.p18, "wikidata_p18"); input.wikipediaFiles.forEach((value) => add(value, "wikipedia_article")); input.commonsFiles.forEach((value) => add(value, "commons_category"));
  return [...found.values()].sort((a, b) => PRIORITY[b.discoverySource] - PRIORITY[a.discoverySource] || b.score - a.score).slice(0, Math.max(1, Math.min(3, input.limit || 3)));
}

export async function discoverArtistImageFiles(artist: WikidataArtist) {
  const trace: Array<Record<string, unknown>> = [{ source: "wikidata_p18", found: Boolean(artist.imageFileTitle), fileTitle: artist.imageFileTitle }];
  let commonsFiles: string[] = [], wikipediaFiles: string[] = [];
  if (artist.wikipediaArticleTitle && artist.wikipediaLanguage) try { const lead = await getWikipediaLeadImage(artist.wikipediaArticleTitle, artist.wikipediaLanguage); wikipediaFiles = lead ? [lead] : []; trace.push({ source: "wikipedia_article", article: artist.wikipediaArticleTitle, role: "lead_image", found: wikipediaFiles.length }); } catch (error) { trace.push({ source: "wikipedia_article", error: error instanceof Error ? error.message : "failed" }); }
  if (artist.commonsCategory) try { commonsFiles = await listCommonsCategoryFiles(artist.commonsCategory); trace.push({ source: "commons_category", found: commonsFiles.length }); } catch (error) { trace.push({ source: "commons_category", error: error instanceof Error ? error.message : "failed" }); }
  return { files: selectArtistImageFiles({ p18: artist.imageFileTitle, commonsFiles, wikipediaFiles, names: [artist.name, artist.nameEn || "", ...artist.aliases] }), trace };
}

export async function saveArtistImageDiscovery(db: SupabaseClient, artistId: string, artist: WikidataArtist) {
  const discovery = await discoverArtistImageFiles(artist); const { data: source } = await db.from("data_sources").select("id").eq("key", "wikimedia_commons").single(); if (!source) throw new Error("Wikimedia Commons source missing");
  let added = 0; const saved: Array<ArtistImageFile & { candidateId: string }> = [];
  for (const file of discovery.files) {
    const metadata = await getCommonsImageMetadata(file.fileTitle); if (!metadata) continue;
    const externalId = `artist:${artistId}:${artist.qid}:${metadata.fileTitle}`;
    const { data: record, error } = await db.from("source_records").upsert({ data_source_id: source.id, external_id: externalId, artist_id: artistId, source_url: metadata.sourceUrl, raw_payload: metadata.raw, checksum: createHash("sha256").update(JSON.stringify(metadata.raw)).digest("hex"), fetched_at: new Date().toISOString() }, { onConflict: "data_source_id,external_id" }).select("id").single(); if (error || !record) throw error || new Error("Commons source save failed");
    const { data: prior } = await db.from("source_image_candidates").select("id,review_status,rights_status").eq("source_record_id", record.id).eq("provider", "wikimedia_commons").eq("stable_identifier", metadata.fileTitle).maybeSingle();
    const { data: candidate, error: candidateError } = await db.from("source_image_candidates").upsert({ source_record_id: record.id, image_url: metadata.imageUrl, thumbnail_url: metadata.thumbnailUrl, provider: "wikimedia_commons", stable_identifier: metadata.fileTitle, source_url: metadata.sourceUrl, author: metadata.author, credit: metadata.credit, license_short_name: metadata.licenseShortName, license_url: metadata.licenseUrl, usage_terms: metadata.usageTerms, candidate_entity_id: artist.qid, candidate_entity_label: artist.name, candidate_match_confidence: 1, candidate_match_threshold: 1, candidate_kind: "probable", image_subject_type: file.subjectType, discovery_source: file.discoverySource, contents_rights_type: metadata.licenseShortName, contents_access: metadata.usageTerms, review_status: prior?.review_status || "unreviewed", rights_status: prior?.rights_status || "needs_review", is_active: true, last_seen_at: new Date().toISOString() }, { onConflict: "source_record_id,provider,stable_identifier" }).select("id").single(); if (candidateError || !candidate) throw candidateError || new Error("Candidate save failed");
    if (!prior) added += 1; saved.push({ ...file, candidateId: candidate.id });
  }
  if (saved.length) await autoSetPreferredMasterCandidatePrimary("artists", artistId);
  return { ...discovery, saved, added };
}
