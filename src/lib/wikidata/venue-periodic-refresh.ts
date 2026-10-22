import "server-only";

import { createHash } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { VENUE_REVIEW_FIELDS, reviewValuesEqual } from "@/lib/admin/venue-data-review";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { shouldApplySourceField, wikidataFields } from "@/lib/venue-enrichment/source-application";
import { getWikidataEntities } from "./client";
import { mapWikidataVenue } from "./venue-mapper";
import type { WikidataVenue } from "./venue-import-types";

const OPERATION_TYPE = "venue_periodic_refresh";
const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 50;
const QID = /^Q[1-9]\d*$/;

type CurrentSource = { field_name: string; source: string; is_current: boolean };
type SourceRecord = {
  id: string;
  external_id: string;
  venue_id: string;
  source_url: string | null;
  raw_payload: unknown;
  checksum: string | null;
};

export type VenueRefreshTarget = {
  sourceRecord: SourceRecord;
  venue: Record<string, unknown> & { id: string; name: string };
  sources: CurrentSource[];
};

export type VenueRefreshPlan = {
  target: VenueRefreshTarget;
  normalized: WikidataVenue;
  changes: Array<{ field: string; value: unknown }>;
  protectedChanges: Array<{ field: string; value: unknown }>;
};

export type VenuePeriodicRefreshResult = {
  dryRun: boolean;
  runId: string | null;
  limit: number;
  requested: number;
  scanned: number;
  fetched: number;
  changed: number;
  unchanged: number;
  protected: number;
  protectedFields: number;
  errors: Array<{ qid?: string; venueId?: string; message: string }>;
  records: Array<{ venueId: string; venueName: string; qid: string; changedFields: string[]; protectedFields: string[]; status: "changed" | "unchanged" | "error" }>;
};

type RefreshDependencies = {
  loadTargets: (db: SupabaseClient, limit: number) => Promise<VenueRefreshTarget[]>;
  fetchVenues: (targets: VenueRefreshTarget[]) => Promise<{ venues: Map<string, WikidataVenue>; errors: Map<string, string> }>;
  createRun: (db: SupabaseClient, limit: number) => Promise<string>;
  applyPlan: (db: SupabaseClient, plan: VenueRefreshPlan) => Promise<void>;
  finishRun: (db: SupabaseClient, result: VenuePeriodicRefreshResult) => Promise<void>;
};

export function normalizeVenueRefreshLimit(value?: number) {
  if (!Number.isFinite(value)) return DEFAULT_LIMIT;
  return Math.max(1, Math.min(MAX_LIMIT, Math.floor(value as number)));
}

export function selectBoundedVenueRefreshSources(rows: SourceRecord[], limit: number) {
  const seenVenueIds = new Set<string>();
  return [...rows]
    .filter((row) => Boolean(row.venue_id) && QID.test(row.external_id))
    .sort((left, right) => left.venue_id.localeCompare(right.venue_id) || left.external_id.localeCompare(right.external_id))
    .filter((row) => {
      if (seenVenueIds.has(row.venue_id)) return false;
      seenVenueIds.add(row.venue_id);
      return true;
    })
    .slice(0, normalizeVenueRefreshLimit(limit));
}

export function buildVenueRefreshPlan(target: VenueRefreshTarget, normalized: WikidataVenue): VenueRefreshPlan {
  const currentSources = new Map(target.sources.filter((row) => row.is_current).map((row) => [row.field_name, row.source]));
  const candidate = wikidataFields(normalized);
  const changes: VenueRefreshPlan["changes"] = [];
  const protectedChanges: VenueRefreshPlan["protectedChanges"] = [];
  for (const [field] of VENUE_REVIEW_FIELDS) {
    const value = candidate[field];
    if (value == null || (Array.isArray(value) && value.length === 0) || reviewValuesEqual(target.venue[field], value)) continue;
    const change = { field, value };
    if (shouldApplySourceField(target.venue[field], currentSources.get(field), "wikidata")) changes.push(change);
    else protectedChanges.push(change);
  }
  return { target, normalized, changes, protectedChanges };
}

async function wikidataSourceId(db: SupabaseClient) {
  const { data, error } = await db.from("data_sources").select("id").eq("key", "wikidata").single();
  if (error || !data) throw error || new Error("Wikidata data source is missing");
  return data.id as string;
}

async function loadTargets(db: SupabaseClient, limit: number) {
  const dataSourceId = await wikidataSourceId(db);
  const linked: SourceRecord[] = [];
  for (let offset = 0; ; offset += 500) {
    const { data, error } = await db.from("source_records")
      .select("id,external_id,venue_id,source_url,raw_payload,checksum")
      .eq("data_source_id", dataSourceId)
      .not("venue_id", "is", null)
      .order("venue_id")
      .order("external_id")
      .range(offset, offset + 499);
    if (error) throw error;
    const page = (data || []) as SourceRecord[];
    linked.push(...page);
    if (selectBoundedVenueRefreshSources(linked, limit).length >= limit || page.length < 500) break;
  }
  if (!linked.length) return [];
  const selected = selectBoundedVenueRefreshSources(linked, limit);
  const venueIds = selected.map((row) => row.venue_id);
  const [{ data: venues, error: venueError }, { data: sources, error: sourceError }] = await Promise.all([
    db.from("venues").select("*").in("id", venueIds),
    db.from("venue_field_sources").select("venue_id,field_name,source,is_current").in("venue_id", venueIds).eq("is_current", true),
  ]);
  if (venueError) throw venueError;
  if (sourceError) throw sourceError;
  const venueById = new Map(((venues || []) as Array<Record<string, unknown> & { id: string; name: string }>).map((venue) => [venue.id, venue]));
  return selected.flatMap((sourceRecord) => {
    const venue = venueById.get(sourceRecord.venue_id);
    if (!venue) return [];
    return [{
      sourceRecord,
      venue,
      sources: ((sources || []) as Array<CurrentSource & { venue_id: string }>).filter((row) => row.venue_id === venue.id),
    }];
  });
}

async function fetchVenues(targets: VenueRefreshTarget[]) {
  const venues = new Map<string, WikidataVenue>();
  const errors = new Map<string, string>();
  let candidates: Awaited<ReturnType<typeof getWikidataEntities>>;
  try {
    candidates = await getWikidataEntities(targets.map((target) => target.sourceRecord.external_id));
  } catch (error) {
    const message = error instanceof Error ? error.message : "Wikidata entity request failed";
    for (const target of targets) errors.set(target.sourceRecord.external_id, message);
    return { venues, errors };
  }
  const candidateById = new Map(candidates.map((candidate) => [candidate.id, candidate]));
  const administrativeIds = [...new Set(candidates.flatMap((candidate) => {
    const claims = (candidate.raw as { claims?: Record<string, Array<{ mainsnak?: { datavalue?: { value?: unknown } } }>> } | null)?.claims;
    return (claims?.P131 || []).flatMap((claim) => {
      const value = claim.mainsnak?.datavalue?.value;
      return value && typeof value === "object" && "id" in value ? [String((value as { id: unknown }).id)] : [];
    });
  }))];
  let labels = new Map<string, string>();
  try {
    const administrative = administrativeIds.length ? await getWikidataEntities(administrativeIds.slice(0, 50)) : [];
    labels = new Map(administrative.map((item) => [item.id, item.labelJa || item.labelEn || item.id]));
  } catch {
    // Administrative labels are optional; individual Venue data remains usable.
  }
  for (const target of targets) {
    const qid = target.sourceRecord.external_id;
    const candidate = candidateById.get(qid);
    if (!candidate) { errors.set(qid, "Wikidata entity was not returned"); continue; }
    const stored = target.sourceRecord.raw_payload as { normalized?: { discoveryRootIds?: string[] } } | null;
    const normalized = mapWikidataVenue(candidate, stored?.normalized?.discoveryRootIds || [], labels);
    if (!normalized) { errors.set(qid, "Wikidata entity is not a supported Japanese Venue"); continue; }
    venues.set(qid, normalized);
  }
  return { venues, errors };
}

function sourceEnvelope(venue: WikidataVenue) {
  return { qid: venue.qid, discoveryRootIds: venue.discoveryRootIds, rawTypeIds: venue.rawTypeIds, normalized: venue, raw: venue.raw };
}

function checksum(value: unknown) {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

async function saveProvenance(db: SupabaseClient, plan: VenueRefreshPlan, field: string, value: unknown, current: boolean) {
  const venueId = plan.target.venue.id;
  const sourceRecordId = plan.target.sourceRecord.id;
  const snapshot = JSON.stringify(value);
  const { data: existing, error: existingError } = await db.from("venue_field_sources")
    .select("id,value_snapshot")
    .eq("venue_id", venueId).eq("field_name", field).eq("source_record_id", sourceRecordId);
  if (existingError) throw existingError;
  const same = (existing || []).find((row) => JSON.stringify(row.value_snapshot) === snapshot);
  if (current) {
    const { error } = await db.from("venue_field_sources").update({ is_current: false }).eq("venue_id", venueId).eq("field_name", field).eq("is_current", true);
    if (error) throw error;
  }
  if (same) {
    const { error } = await db.from("venue_field_sources").update({ is_current: current, review_status: current ? "applied" : "unreviewed", updated_at: new Date().toISOString() }).eq("id", same.id);
    if (error) throw error;
    return;
  }
  const { error } = await db.from("venue_field_sources").insert({
    venue_id: venueId,
    field_name: field,
    source: "wikidata",
    source_url: `https://www.wikidata.org/wiki/${plan.normalized.qid}`,
    source_record_id: sourceRecordId,
    value_snapshot: value,
    generated_by_ai: false,
    review_status: current ? "applied" : "unreviewed",
    is_current: current,
  });
  if (error) throw error;
}

async function applyPlan(db: SupabaseClient, plan: VenueRefreshPlan) {
  const envelope = sourceEnvelope(plan.normalized);
  const nextChecksum = checksum(envelope);
  const now = new Date().toISOString();
  const sourceUpdates: Record<string, unknown> = { raw_payload: envelope, checksum: nextChecksum, fetched_at: now, last_seen_at: now };
  if (nextChecksum !== plan.target.sourceRecord.checksum) sourceUpdates.last_changed_at = now;
  const { error: sourceError } = await db.from("source_records").update(sourceUpdates).eq("id", plan.target.sourceRecord.id);
  if (sourceError) throw sourceError;
  if (plan.changes.length) {
    const updates = Object.fromEntries(plan.changes.map((change) => [change.field, change.value])) as Record<string, unknown>;
    if (plan.changes.some((change) => change.field === "latitude" || change.field === "longitude")) {
      updates.coordinate_source = "wikidata";
      updates.coordinate_precision = "exact";
      updates.coordinate_status = "approved";
    }
    updates.enriched_at = now;
    const { error } = await db.from("venues").update(updates).eq("id", plan.target.venue.id);
    if (error) throw error;
  }
  for (const change of plan.changes) await saveProvenance(db, plan, change.field, change.value, true);
  for (const change of plan.protectedChanges) await saveProvenance(db, plan, change.field, change.value, false);
}

async function createRun(db: SupabaseClient, limit: number) {
  const dataSourceId = await wikidataSourceId(db);
  const { data, error } = await db.from("import_runs").insert({
    data_source_id: dataSourceId,
    operation_type: OPERATION_TYPE,
    status: "running",
    requested_count: limit,
    metrics: { mode: "bounded", entity: "venue", limit },
  }).select("id").single();
  if (error || !data) throw error || new Error("Venue periodic refresh run could not be created");
  return data.id as string;
}

async function finishRun(db: SupabaseClient, result: VenuePeriodicRefreshResult) {
  if (!result.runId) return;
  const status = result.errors.length === 0 ? "completed" : result.fetched > 0 ? "partial" : "failed";
  const { error } = await db.from("import_runs").update({
    status,
    fetched_count: result.fetched,
    created_count: 0,
    updated_count: result.changed,
    skipped_count: result.unchanged,
    error_count: result.errors.length,
    errors: result.errors.length ? result.errors : null,
    metrics: result,
    finished_at: new Date().toISOString(),
  }).eq("id", result.runId);
  if (error) throw error;
}

const defaults: RefreshDependencies = { loadTargets, fetchVenues, createRun, applyPlan, finishRun };

export async function runVenuePeriodicRefresh(
  input: { dryRun?: boolean; limit?: number },
  db: SupabaseClient = createSupabaseAdminClient(),
  overrides: Partial<RefreshDependencies> = {},
) {
  const dependencies = { ...defaults, ...overrides };
  const dryRun = input.dryRun !== false;
  const limit = normalizeVenueRefreshLimit(input.limit);
  const targets = await dependencies.loadTargets(db, limit);
  const records: VenuePeriodicRefreshResult["records"] = [];
  const result: VenuePeriodicRefreshResult = {
    dryRun, runId: null, limit, requested: limit, scanned: targets.length, fetched: 0, changed: 0, unchanged: 0,
    protected: 0, protectedFields: 0, errors: [], records,
  };
  if (!dryRun) result.runId = await dependencies.createRun(db, limit);
  try {
    const fetched = await dependencies.fetchVenues(targets);
    for (const target of targets) {
      const qid = target.sourceRecord.external_id;
      const normalized = fetched.venues.get(qid);
      if (!normalized) {
        const message = fetched.errors.get(qid) || "Wikidata Venue could not be fetched";
        result.errors.push({ qid, venueId: target.venue.id, message });
        records.push({ venueId: target.venue.id, venueName: target.venue.name, qid, changedFields: [], protectedFields: [], status: "error" });
        continue;
      }
      result.fetched += 1;
      const plan = buildVenueRefreshPlan(target, normalized);
      if (plan.protectedChanges.length) result.protected += 1;
      result.protectedFields += plan.protectedChanges.length;
      if (!dryRun) {
        try { await dependencies.applyPlan(db, plan); }
        catch (error) {
          result.errors.push({ qid, venueId: target.venue.id, message: error instanceof Error ? error.message : "Venue refresh apply failed" });
          records.push({ venueId: target.venue.id, venueName: target.venue.name, qid, changedFields: [], protectedFields: plan.protectedChanges.map((item) => item.field), status: "error" });
          continue;
        }
      }
      if (plan.changes.length) result.changed += 1; else result.unchanged += 1;
      records.push({
        venueId: target.venue.id,
        venueName: target.venue.name,
        qid,
        changedFields: plan.changes.map((item) => item.field),
        protectedFields: plan.protectedChanges.map((item) => item.field),
        status: plan.changes.length ? "changed" : "unchanged",
      });
    }
  } catch (error) {
    result.errors.push({ message: error instanceof Error ? error.message : "Venue periodic refresh failed" });
  }
  if (!dryRun) await dependencies.finishRun(db, result);
  return result;
}
