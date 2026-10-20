import { createSupabaseAdminClient, hasSupabaseAdminEnvironment } from "@/lib/supabase/admin";
import { normalizeExhibitionSchedule, normalizePublicationStatus, type ExhibitionSchedule } from "./master-list-state";
import { exhibitionListRowMatchesFilters, occurrenceMatchesSchedule, type ExhibitionListResult, type ExhibitionListRow, type ExhibitionListRowMembershipResult } from "./exhibition-list-state";

export type ExhibitionListOptions = {
  q?: string;
  status?: string;
  image?: string;
  schedule?: string;
  page?: number;
  pageSize?: number;
  today?: string;
};

type BaseRow = { id: string; title: string; updated_at: string; publication_status: string };
type OccurrenceRow = { exhibition_id: string; start_date: string | null; end_date: string | null; venue_id: string; venues: { id: string; name: string } | Array<{ id: string; name: string }> | null };
type PrimaryImageRow = { exhibition_id: string; storage_path: string; rights_status: string };

function firstLinked<T>(value: T | T[] | null | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function escapePostgrest(value: string) {
  return value.replaceAll("\\", "\\\\").replaceAll("%", "\\%").replaceAll("_", "\\_").replaceAll(",", "\\,");
}

function tokyoToday() {
  return new Date(Date.now() + 9 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

async function scheduleExhibitionIds(schedule: ExhibitionSchedule, today: string) {
  if (schedule === "all") return null;
  const db = createSupabaseAdminClient();
  const base = () => db.from("exhibition_occurrences").select("exhibition_id").neq("relation_status", "stale");
  if (schedule === "past") {
    const { data, error } = await base().lt("end_date", today);
    if (error) throw error;
    return [...new Set((data || []).map((row) => row.exhibition_id))];
  }
  if (schedule === "unknown") {
    const [undated, withoutActiveOccurrence] = await Promise.all([
      base().is("start_date", null).is("end_date", null),
      db.from("exhibitions")
        .select("id,exhibition_occurrences()")
        .neq("exhibition_occurrences.relation_status", "stale")
        .is("exhibition_occurrences", null),
    ]);
    if (undated.error) throw undated.error;
    if (withoutActiveOccurrence.error) throw withoutActiveOccurrence.error;
    return [...new Set([
      ...(undated.data || []).map((row) => row.exhibition_id),
      ...(withoutActiveOccurrence.data || []).map((row) => row.id),
    ])];
  }
  const [dated, openEnded] = await Promise.all([
    base().gte("end_date", today),
    base().is("end_date", null).not("start_date", "is", null),
  ]);
  if (dated.error) throw dated.error;
  if (openEnded.error) throw openEnded.error;
  return [...new Set([...(dated.data || []), ...(openEnded.data || [])].map((row) => row.exhibition_id))];
}

async function primaryExhibitionIds() {
  const db = createSupabaseAdminClient();
  const { data, error } = await db.from("media_assets").select("exhibition_id").eq("is_primary", true).not("exhibition_id", "is", null);
  if (error) throw error;
  return [...new Set((data || []).map((row) => row.exhibition_id).filter(Boolean) as string[])];
}

function intersectIds(left: string[] | null, right: string[] | null) {
  if (!left) return right;
  if (!right) return left;
  const accepted = new Set(right);
  return left.filter((id) => accepted.has(id));
}

async function hydrateRows(baseRows: BaseRow[], schedule: ExhibitionSchedule = "all", today = tokyoToday()): Promise<ExhibitionListRow[]> {
  if (!baseRows.length) return [];
  const db = createSupabaseAdminClient();
  const ids = baseRows.map((row) => row.id);
  const [occurrences, venueMentions, artistRelations, artistMentions, primaryImages, candidates] = await Promise.all([
    db.from("exhibition_occurrences").select("exhibition_id,start_date,end_date,venue_id,venues(id,name)").in("exhibition_id", ids).neq("relation_status", "stale").order("start_date", { ascending: true, nullsFirst: false }),
    db.from("exhibition_venue_mentions").select("exhibition_id,resolution_status,last_seen_at").in("exhibition_id", ids).eq("is_active", true).order("last_seen_at", { ascending: false }),
    db.from("exhibition_artists").select("exhibition_id").in("exhibition_id", ids).neq("relation_status", "stale"),
    db.from("exhibition_artist_mentions").select("exhibition_id,resolution_status").in("exhibition_id", ids).eq("is_active", true).in("resolution_status", ["pending", "ambiguous"]),
    db.from("media_assets").select("exhibition_id,storage_path,rights_status").in("exhibition_id", ids).eq("is_primary", true),
    db.from("source_image_candidates").select("id,thumbnail_url,image_url,source_records!inner(exhibition_id)").eq("is_active", true).in("source_records.exhibition_id", ids).order("last_seen_at", { ascending: false }),
  ]);
  for (const result of [occurrences, venueMentions, artistRelations, artistMentions, primaryImages, candidates]) {
    if (result.error) throw result.error;
  }

  const occurrencesById = new Map<string, OccurrenceRow[]>();
  for (const row of (occurrences.data || []) as unknown as OccurrenceRow[]) occurrencesById.set(row.exhibition_id, [...(occurrencesById.get(row.exhibition_id) || []), row]);
  const venueStatusById = new Map<string, string>();
  for (const row of venueMentions.data || []) if (!venueStatusById.has(row.exhibition_id)) venueStatusById.set(row.exhibition_id, row.resolution_status);
  const artistCounts = new Map<string, number>();
  for (const row of artistRelations.data || []) artistCounts.set(row.exhibition_id, (artistCounts.get(row.exhibition_id) || 0) + 1);
  const unresolvedArtists = new Set((artistMentions.data || []).map((row) => row.exhibition_id));
  const primaryById = new Map<string, PrimaryImageRow>();
  for (const row of (primaryImages.data || []) as PrimaryImageRow[]) primaryById.set(row.exhibition_id, row);
  const candidateById = new Map<string, string>();
  for (const row of candidates.data || []) {
    const source = firstLinked(row.source_records as { exhibition_id: string } | Array<{ exhibition_id: string }> | null);
    if (source?.exhibition_id && !candidateById.has(source.exhibition_id)) candidateById.set(source.exhibition_id, row.thumbnail_url || row.image_url);
  }
  const signedPrimary = new Map<string, string | null>();
  await Promise.all([...primaryById.entries()].map(async ([id, asset]) => {
    const { data } = await db.storage.from("exhibition-images").createSignedUrl(asset.storage_path, 3600);
    signedPrimary.set(id, data?.signedUrl || null);
  }));

  return baseRows.map((row) => {
    const occurrenceRows = occurrencesById.get(row.id) || [];
    const occurrence = occurrenceRows.find((item) => occurrenceMatchesSchedule(item, schedule, today)) || occurrenceRows[0];
    const venue = firstLinked(occurrence?.venues);
    const primary = primaryById.get(row.id);
    const candidate = candidateById.get(row.id) || null;
    return {
      ...row,
      occurrence: occurrence ? { start_date: occurrence.start_date, end_date: occurrence.end_date, venue: venue ? { id: venue.id, name: venue.name } : null } : null,
      venue_resolution_status: venueStatusById.get(row.id) || (venue ? "resolved" : "pending"),
      artist_count: artistCounts.get(row.id) || 0,
      has_unresolved_artist: unresolvedArtists.has(row.id),
      image: primary
        ? { kind: "primary" as const, rights_status: primary.rights_status, thumbnail_url: signedPrimary.get(row.id) || null }
        : candidate
          ? { kind: "candidate" as const, rights_status: null, thumbnail_url: candidate }
          : { kind: "missing" as const, rights_status: null, thumbnail_url: null },
    };
  });
}

export async function listExhibitions(options: ExhibitionListOptions = {}): Promise<ExhibitionListResult> {
  const pageSize = Number(options.pageSize) === 50 ? 50 : 50;
  const page = Math.max(1, Number(options.page) || 1);
  const fallback: ExhibitionListResult = { rows: [], total: 0, allTotal: 0, page, pageSize, totalPages: 1, configured: hasSupabaseAdminEnvironment(), error: null };
  if (!hasSupabaseAdminEnvironment()) return { ...fallback, error: "Supabase環境変数が未設定です。" };
  try {
    const db = createSupabaseAdminClient();
    const schedule = normalizeExhibitionSchedule(options.schedule);
    const today = options.today || tokyoToday();
    const publicationStatus = normalizePublicationStatus(options.status);
    const [scheduleIds, imageIds, allCount] = await Promise.all([
      scheduleExhibitionIds(schedule, today),
      options.image === "present" || options.image === "missing" ? primaryExhibitionIds() : Promise.resolve(null),
      db.from("exhibitions").select("id", { count: "exact", head: true }),
    ]);
    if (allCount.error) throw allCount.error;
    const allowedIds = options.image === "present" ? intersectIds(scheduleIds, imageIds) : scheduleIds;
    if (allowedIds && !allowedIds.length) return { ...fallback, allTotal: allCount.count || 0, configured: true };

    let query = db.from("exhibitions").select("id,title,updated_at,publication_status", { count: "exact" });
    if (publicationStatus === "unpublished") query = query.neq("publication_status", "published").neq("publication_status", "archived");
    else query = query.eq("publication_status", publicationStatus);
    if (options.q?.trim()) query = query.ilike("title", `%${escapePostgrest(options.q.trim())}%`);
    if (allowedIds) query = query.in("id", allowedIds);
    if (options.image === "missing" && imageIds?.length) query = query.not("id", "in", `(${imageIds.join(",")})`);
    query = query.order("updated_at", { ascending: false }).order("id", { ascending: true }).range((page - 1) * pageSize, page * pageSize - 1);
    const { data, error, count } = await query;
    if (error) throw error;
    const rows = await hydrateRows((data || []) as BaseRow[], schedule, today);
    const total = count || 0;
    return { rows, total, allTotal: allCount.count || 0, page, pageSize, totalPages: Math.max(1, Math.ceil(total / pageSize)), configured: true, error: null };
  } catch (error) {
    return { ...fallback, configured: true, error: error instanceof Error ? error.message : "展覧会一覧の取得に失敗しました。" };
  }
}

export async function getExhibitionListRow(id: string, options: Pick<ExhibitionListOptions, "q" | "status" | "image" | "schedule" | "today"> = {}) {
  if (!hasSupabaseAdminEnvironment()) return { data: null, error: "Supabase環境変数が未設定です。", configured: false };
  try {
    const db = createSupabaseAdminClient();
    const { data, error } = await db.from("exhibitions").select("id,title,updated_at,publication_status").eq("id", id).single();
    if (error) throw error;
    const today = options.today || tokyoToday();
    const [row] = await hydrateRows([data as BaseRow], normalizeExhibitionSchedule(options.schedule), today);
    const result: ExhibitionListRowMembershipResult = exhibitionListRowMatchesFilters(row, options, today)
      ? { matches: true, row }
      : { matches: false };
    return { data: result, error: null, configured: true };
  } catch (error) {
    return { data: null, error: error instanceof Error ? error.message : "展覧会一覧行の取得に失敗しました。", configured: true };
  }
}
