import { createHash } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getArtCommonsItem, getJapanSearchRequestDelayMs, scrollArtCommons } from "./client";
import { mapArtCommonsItem, mapSourceImages, normalizeVenueIdentity, parseExplicitDate } from "./mapper";
import type { ArtCommonsItem } from "./types";
import { importedSlug, slugify } from "@/lib/admin/slug";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

const DATA_SOURCE_KEY = "art_commons_jpsearch";

export type ImportRequest = {
  keyword: string;
  dateFrom?: string | null;
  dateTo?: string | null;
  includePast?: boolean;
};
export type ImportResult = {
  runId: string;
  sourceHitCount: number;
  scannedCount: number;
  eligibleCount: number;
  fetchedCount: number;
  createdCount: number;
  updatedCount: number;
  skippedCount: number;
  excludedCount: number;
  errorCount: number;
  errors: { externalId?: string; message: string }[];
};

export function defaultImportDateRange(now = new Date()) {
  const japanNow = new Date(now.getTime() + 9 * 60 * 60 * 1000);
  const dateFrom = japanNow.toISOString().slice(0, 10);
  const end = new Date(`${dateFrom}T00:00:00Z`);
  end.setUTCFullYear(end.getUTCFullYear() + 1);
  return { dateFrom, dateTo: end.toISOString().slice(0, 10) };
}

function safeRangeDate(value: string | null | undefined, fallback: string) {
  return parseExplicitDate(value) || fallback;
}

export function matchesImportDateRange(item: ArtCommonsItem, dateFrom: string, dateTo: string) {
  const temporal = item.common?.temporal || [];
  const start = parseExplicitDate(temporal[0]);
  const end = parseExplicitDate(temporal[1]);
  if (!start && !end) return false;
  const rangeStart = start || end as string;
  const rangeEnd = end || start as string;
  return rangeEnd >= dateFrom && rangeStart <= dateTo;
}

export function hasMinimumImportFields(item: ArtCommonsItem) {
  const title = typeof item["exhib-名称-s"] === "string" ? item["exhib-名称-s"] : item.common?.title;
  const venue = typeof item["exhib-会場表記-s"] === "string" ? item["exhib-会場表記-s"] : item.common?.location?.[0];
  return Boolean(title?.trim() && venue?.trim());
}

type ExistingSourceRecord = {
  id: string;
  exhibition_id: string | null;
  checksum: string | null;
};

export function checksumPayload(payload: unknown) {
  return createHash("sha256").update(JSON.stringify(payload)).digest("hex");
}

export function shouldSkipExistingRecord(existing: ExistingSourceRecord | null, checksum: string) {
  return Boolean(existing?.exhibition_id && existing.checksum === checksum);
}

function rawSourceUpdatedAt(raw: Awaited<ReturnType<typeof getArtCommonsItem>>) {
  const timestamp = raw.common?.lastUpdatedDate;
  if (typeof timestamp !== "number" || !Number.isFinite(timestamp)) return null;
  const date = new Date(timestamp);
  return Number.isNaN(date.valueOf()) ? null : date.toISOString();
}

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function requireDataSource(db: SupabaseClient) {
  const { data, error } = await db
    .from("data_sources")
    .select("id")
    .eq("key", DATA_SOURCE_KEY)
    .single();
  if (error || !data) throw new Error(`Data source is unavailable: ${error?.message || DATA_SOURCE_KEY}`);
  return data.id as string;
}

export async function syncSourceImageCandidates(db: SupabaseClient, sourceRecordId: string, item: ArtCommonsItem) {
  const { error: deactivateError } = await db
    .from("source_image_candidates")
    .update({ is_active: false })
    .eq("source_record_id", sourceRecordId);
  if (deactivateError) throw deactivateError;
  const candidates = mapSourceImages(item);
  if (!candidates.length) return;
  const now = new Date().toISOString();
  const { error } = await db.from("source_image_candidates").upsert(
    candidates.map((candidate) => ({
      source_record_id: sourceRecordId,
      image_url: candidate.imageUrl,
      thumbnail_url: candidate.thumbnailUrl,
      provider: candidate.provider,
      contents_rights_type: candidate.contentsRightsType,
      contents_access: candidate.contentsAccess,
      is_active: true,
      last_seen_at: now,
    })),
    { onConflict: "source_record_id,image_url" },
  );
  if (error) throw error;
}

async function findOrCreateVenue(
  db: SupabaseClient,
  exhibitionId: string | null,
  venue: { name: string; address: string | null },
) {
  if (exhibitionId) {
    const { data } = await db
      .from("exhibition_occurrences")
      .select("venue_id")
      .eq("exhibition_id", exhibitionId)
      .limit(1)
      .maybeSingle();
    if (data?.venue_id) return data.venue_id as string;
  }

  const normalizedName = normalizeVenueIdentity(venue.name);
  const normalizedAddress = normalizeVenueIdentity(venue.address) || null;
  let query = db.from("venues").select("id").eq("normalized_name", normalizedName);
  query = normalizedAddress
    ? query.eq("normalized_address", normalizedAddress)
    : query.is("normalized_address", null);
  const { data: matched, error: matchError } = await query.limit(2);
  if (matchError) throw matchError;
  if (matched?.length === 1) return matched[0].id as string;

  const uniqueSuffix = createHash("sha1")
    .update(`${venue.name}|${venue.address || ""}|${Date.now()}|${Math.random()}`)
    .digest("hex")
    .slice(0, 8);
  const { data: created, error } = await db
    .from("venues")
    .insert({
      slug: `${slugify(venue.name)}-${uniqueSuffix}`,
      name: venue.name,
      address: venue.address,
      normalized_name: normalizedName,
      normalized_address: normalizedAddress,
      venue_type: "other",
    })
    .select("id")
    .single();
  if (error || !created) throw error || new Error("Venue could not be created");
  return created.id as string;
}

async function saveNormalizedItem(
  db: SupabaseClient,
  sourceRecord: ExistingSourceRecord,
  raw: Awaited<ReturnType<typeof getArtCommonsItem>>,
) {
  const item = mapArtCommonsItem(raw);
  let exhibitionId = sourceRecord.exhibition_id;
  let created = false;

  if (exhibitionId) {
    const { error } = await db
      .from("exhibitions")
      .update({
        title: item.title,
        title_en: item.titleEn,
        description: item.description,
        exhibition_type: item.exhibitionType,
        official_url: item.officialUrl,
      })
      .eq("id", exhibitionId);
    if (error) throw error;
  } else {
    const { data, error } = await db
      .from("exhibitions")
      .insert({
        slug: importedSlug(item.title, item.externalId),
        title: item.title,
        title_en: item.titleEn,
        description: item.description,
        exhibition_type: item.exhibitionType,
        official_url: item.officialUrl,
        publication_status: "draft",
      })
      .select("id")
      .single();
    if (error || !data) throw error || new Error("Exhibition could not be created");
    exhibitionId = data.id as string;
    created = true;
  }

  const venueId = await findOrCreateVenue(db, exhibitionId, item.venue);
  const occurrenceValues = {
    exhibition_id: exhibitionId,
    venue_id: venueId,
    start_date: item.occurrence.startDate,
    end_date: item.occurrence.endDate,
    opening_hours_text: item.occurrence.openingHoursText,
    closed_days_text: item.occurrence.closedDaysText,
    ticket_url: item.occurrence.ticketUrl,
  };
  const { data: occurrence } = await db
    .from("exhibition_occurrences")
    .select("id")
    .eq("exhibition_id", exhibitionId)
    .limit(1)
    .maybeSingle();
  const occurrenceQuery = occurrence
    ? db.from("exhibition_occurrences").update(occurrenceValues).eq("id", occurrence.id)
    : db.from("exhibition_occurrences").insert(occurrenceValues);
  const { error: occurrenceError } = await occurrenceQuery;
  if (occurrenceError) throw occurrenceError;

  const { error: linkError } = await db
    .from("source_records")
    .update({ exhibition_id: exhibitionId, source_url: item.sourceUrl })
    .eq("id", sourceRecord.id);
  if (linkError) throw linkError;
  return { created };
}

export async function importArtCommons(
  request: ImportRequest,
  db: SupabaseClient = createSupabaseAdminClient(),
): Promise<ImportResult> {
  const defaults = defaultImportDateRange();
  const includePast = Boolean(request.includePast);
  const dateFrom = safeRangeDate(request.dateFrom, defaults.dateFrom);
  const dateTo = safeRangeDate(request.dateTo, defaults.dateTo);
  if (!includePast && dateFrom > dateTo) throw new Error("dateFrom must not be after dateTo");
  const dataSourceId = await requireDataSource(db);
  const { data: run, error: runError } = await db
    .from("import_runs")
    .insert({ data_source_id: dataSourceId, status: "running", requested_count: 0, date_from: includePast ? null : dateFrom, date_to: includePast ? null : dateTo, include_past: includePast })
    .select("id")
    .single();
  if (runError || !run) throw runError || new Error("Import run could not be created");

  const result: ImportResult = {
    runId: run.id as string,
    sourceHitCount: 0,
    scannedCount: 0,
    eligibleCount: 0,
    fetchedCount: 0,
    createdCount: 0,
    updatedCount: 0,
    skippedCount: 0,
    excludedCount: 0,
    errorCount: 0,
    errors: [],
  };

  try {
    const selected: ArtCommonsItem[] = [];
    const seenIds = new Set<string>();
    for await (const page of scrollArtCommons({
      keyword: request.keyword,
      yearFrom: includePast ? undefined : Number(dateFrom.slice(0, 4)),
      yearTo: includePast ? undefined : Number(dateTo.slice(0, 4)),
    })) {
      result.sourceHitCount = page.hit;
      for (const item of page.list) {
        if (seenIds.has(item.id)) continue;
        seenIds.add(item.id);
        result.scannedCount += 1;
        if (hasMinimumImportFields(item) && (includePast || matchesImportDateRange(item, dateFrom, dateTo))) {
          selected.push(item);
        } else {
          result.excludedCount += 1;
        }
      }
      if (page.scrollId) await wait(getJapanSearchRequestDelayMs());
    }
    result.eligibleCount = selected.length;
    await db.from("import_runs").update({
      requested_count: result.eligibleCount,
      source_hit_count: result.sourceHitCount,
      scanned_count: result.scannedCount,
      excluded_count: result.excludedCount,
    }).eq("id", result.runId);

    for (let index = 0; index < selected.length; index += 1) {
      const searchItem = selected[index];
      try {
        if (index > 0) await wait(getJapanSearchRequestDelayMs());
        const raw = await getArtCommonsItem(searchItem.id);
        result.fetchedCount += 1;
        const checksum = checksumPayload(raw);
        const { data: existingData, error: existingError } = await db
          .from("source_records")
          .select("id, exhibition_id, checksum")
          .eq("data_source_id", dataSourceId)
          .eq("external_id", raw.id)
          .maybeSingle();
        if (existingError) throw existingError;
        const existing = existingData as ExistingSourceRecord | null;

        const rawValues = {
          data_source_id: dataSourceId,
          external_id: raw.id,
          source_url: (raw["exhib-URL-u"] as string | undefined) || raw.common?.linkUrl || null,
          raw_payload: raw,
          checksum,
          // Store the source payload before normalization. A malformed record must
          // remain inspectable even when mapping fails later in this import run.
          source_updated_at: rawSourceUpdatedAt(raw),
          fetched_at: new Date().toISOString(),
        };
        const { data: stored, error: storeError } = await db
          .from("source_records")
          .upsert(rawValues, { onConflict: "data_source_id,external_id" })
          .select("id, exhibition_id, checksum")
          .single();
        if (storeError || !stored) throw storeError || new Error("Raw source record could not be stored");

        await syncSourceImageCandidates(db, stored.id as string, raw);

        if (shouldSkipExistingRecord(existing, checksum)) {
          result.skippedCount += 1;
          continue;
        }
        const linkedRecord: ExistingSourceRecord = {
          id: stored.id as string,
          exhibition_id: existing?.exhibition_id || (stored.exhibition_id as string | null),
          checksum,
        };
        const saved = await saveNormalizedItem(db, linkedRecord, raw);
        if (saved.created) result.createdCount += 1;
        else result.updatedCount += 1;
      } catch (error) {
        result.errorCount += 1;
        result.errors.push({
          externalId: searchItem.id,
          message: error instanceof Error ? error.message : "Unknown import error",
        });
      }
    }
    const status = result.errorCount === 0 ? "completed" : result.fetchedCount > 0 ? "partial" : "failed";
    await db.from("import_runs").update({
      status,
      requested_count: result.eligibleCount,
      source_hit_count: result.sourceHitCount,
      scanned_count: result.scannedCount,
      fetched_count: result.fetchedCount,
      created_count: result.createdCount,
      updated_count: result.updatedCount,
      skipped_count: result.skippedCount,
      excluded_count: result.excludedCount,
      error_count: result.errorCount,
      errors: result.errors.length ? result.errors : null,
      finished_at: new Date().toISOString(),
    }).eq("id", result.runId);
    return result;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Import failed";
    result.errorCount += 1;
    result.errors.push({ message });
    await db.from("import_runs").update({
      status: "failed",
      requested_count: result.eligibleCount,
      source_hit_count: result.sourceHitCount,
      scanned_count: result.scannedCount,
      fetched_count: result.fetchedCount,
      created_count: result.createdCount,
      updated_count: result.updatedCount,
      skipped_count: result.skippedCount,
      excluded_count: result.excludedCount,
      error_count: result.errorCount,
      errors: result.errors,
      finished_at: new Date().toISOString(),
    }).eq("id", result.runId);
    throw error;
  }
}
