import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { listMasters, type MasterListOptions } from "@/lib/admin/master-repository";
import { crawlOfficialVenue } from "./crawler";
import type { CrawlVenueInput, OfficialCrawlResult, OfficialCrawlSummary } from "./types";

export type OfficialCrawlRequest = {
  mode: "selected" | "filtered" | "count";
  target?: "selected" | "filtered" | "A" | "A-B" | "A-C";
  ids?: string[];
  limit?: number;
  missingField?: "address" | "postal_code" | "opening_hours_text" | "closed_days_text" | "access_text" | "description" | "";
  filters?: MasterListOptions;
};

function summaryFor(rows: OfficialCrawlResult[]): OfficialCrawlSummary {
  return {
    requested: rows.length,
    processed: rows.length,
    success: rows.filter((row) => row.crawl_status === "success").length,
    partial: rows.filter((row) => row.crawl_status === "partial" || row.crawl_status === "no_relevant_page").length,
    blocked: rows.filter((row) => row.crawl_status === "robots_blocked").length,
    failed: rows.filter((row) => ["fetch_failed", "parse_failed", "timeout", "no_official_url"].includes(row.crawl_status)).length,
    coverage: {
      address: rows.filter((row) => row.address).length,
      postalCode: rows.filter((row) => row.postal_code).length,
      openingHours: rows.filter((row) => row.opening_hours_text).length,
      closedDays: rows.filter((row) => row.closed_days_text).length,
      access: rows.filter((row) => row.access_text).length,
      descriptionSource: rows.filter((row) => row.description_source_url || row.description_source_text).length,
    },
  };
}

async function targetsFor(request: OfficialCrawlRequest): Promise<CrawlVenueInput[]> {
  const requestedLimit = Math.max(1, Math.min(50, Number(request.limit) || 5));
  const db = createSupabaseAdminClient();
  let rows: Array<Record<string, unknown>> = [];
  if (request.mode === "selected") {
    const ids = [...new Set(request.ids || [])].slice(0, 50);
    if (!ids.length) throw new Error("Venueを選択してください。");
    const result = await db.from("venues").select("id,name,official_url,address,postal_code,opening_hours_text,closed_days_text,access_text,description").in("id", ids);
    if (result.error) throw result.error;
    rows = result.data || [];
  } else {
    const targetTier = request.target && !["selected", "filtered"].includes(request.target) ? request.target : undefined;
    for (let page = 1; ; page += 1) {
      const result = await listMasters("venues", { ...(request.filters || {}), tier: targetTier || request.filters?.tier, page, pageSize: 100 });
      if (result.error) throw new Error(result.error);
      rows.push(...result.rows);
      const eligible = rows.filter((row) => String(row.official_url || "").trim() && (!request.missingField || !String(row[request.missingField] || "").trim()));
      if (eligible.length >= requestedLimit || page >= result.totalPages) break;
    }
  }
  if (request.missingField) rows = rows.filter((row) => !String(row[request.missingField!] || "").trim());
  const limit = request.mode === "selected" ? Math.min(50, new Set(request.ids || []).size) : requestedLimit;
  return rows.filter((row) => String(row.official_url || "").trim()).slice(0, limit).map((row) => ({
    id: String(row.id), name: String(row.name), official_url: String(row.official_url),
  }));
}

export async function executeOfficialVenueCrawl(request: OfficialCrawlRequest) {
  const db = createSupabaseAdminClient();
  const targets = await targetsFor(request);
  if (!targets.length) throw new Error("条件に合うOfficial URL付きVenueがありません。");
  const { data: source, error: sourceError } = await db.from("data_sources").select("id").eq("key", "official_website").single();
  if (sourceError || !source) throw sourceError || new Error("official_website Sourceが未登録です。Migrationを適用してください。");
  const { data: run, error: runError } = await db.from("import_runs").insert({
    data_source_id: source.id, operation_type: "official_venue_crawl", status: "running", requested_count: targets.length,
  }).select("id").single();
  if (runError || !run) throw runError || new Error("Crawl runを作成できませんでした。");

  const rows: OfficialCrawlResult[] = [];
  try {
    const concurrency = 2;
    for (let index = 0; index < targets.length; index += concurrency) {
      rows.push(...await Promise.all(targets.slice(index, index + concurrency).map((target) => crawlOfficialVenue(target))));
      const progress = summaryFor(rows);
      await db.from("import_runs").update({ fetched_count: rows.length, error_count: progress.failed, skipped_count: progress.blocked, metrics: { ...progress, totalTargets: targets.length } }).eq("id", run.id);
    }
    const summary = summaryFor(rows);
    const payload = rows.map((row) => ({
      import_run_id: run.id, venue_id: row.venue_id, crawl_status: row.crawl_status, crawled_at: row.crawled_at,
      crawl_source_url: row.crawl_source_url, discovered_urls: row.discovered_urls,
      extracted_values: {
        address: row.address, postal_code: row.postal_code, opening_hours_text: row.opening_hours_text,
        closed_days_text: row.closed_days_text, access_text: row.access_text, description: row.description,
      },
      field_source_urls: {
        address: row.address_source_url, postal_code: row.postal_code_source_url,
        opening_hours_text: row.opening_hours_source_url, closed_days_text: row.closed_days_source_url, access_text: row.access_source_url,
      },
      description_source_text: row.description_source_text, description_source_url: row.description_source_url,
      official_source_text: row.official_source_text,
      phone: row.phone, ambiguous_fields: row.ambiguous_fields, notes: row.notes || null,
    }));
    const { error: resultError } = await db.from("official_venue_crawl_results").insert(payload);
    if (resultError) throw resultError;
    const finalStatus = summary.failed || summary.blocked ? summary.success || summary.partial ? "partial" : "failed" : "completed";
    const { error: updateError } = await db.from("import_runs").update({
      status: finalStatus, fetched_count: summary.processed, updated_count: 0,
      skipped_count: summary.blocked, error_count: summary.failed, metrics: summary, finished_at: new Date().toISOString(),
    }).eq("id", run.id);
    if (updateError) throw updateError;
    return { runId: run.id as string, rows, summary };
  } catch (error) {
    await db.from("import_runs").update({ status: "failed", error_count: 1, errors: [{ message: error instanceof Error ? error.message : "Crawl failed" }], finished_at: new Date().toISOString() }).eq("id", run.id);
    throw error;
  }
}

export async function getOfficialCrawlRows(runId: string): Promise<OfficialCrawlResult[]> {
  const db = createSupabaseAdminClient();
  const { data, error } = await db.from("official_venue_crawl_results").select("*,venues(name,official_url)").eq("import_run_id", runId).order("created_at");
  if (error) throw error;
  return (data || []).map((row) => {
    const venue = Array.isArray(row.venues) ? row.venues[0] : row.venues;
    const values = row.extracted_values || {};
    const sources = row.field_source_urls || {};
    return {
      venue_id: row.venue_id, name: venue?.name || "", official_url: venue?.official_url || "", crawl_source_url: row.crawl_source_url,
      crawl_status: row.crawl_status, crawled_at: row.crawled_at, address: values.address || "", postal_code: values.postal_code || "",
      opening_hours_text: values.opening_hours_text || "", closed_days_text: values.closed_days_text || "", access_text: values.access_text || "",
      description: values.description || "", description_source_url: row.description_source_url || "", description_source_text: row.description_source_text || "",
      official_source_text: row.official_source_text || "",
      phone: row.phone || "", address_source_url: sources.address || "", postal_code_source_url: sources.postal_code || "",
      opening_hours_source_url: sources.opening_hours_text || "", closed_days_source_url: sources.closed_days_text || "",
      access_source_url: sources.access_text || "", ambiguous_fields: row.ambiguous_fields || {}, discovered_urls: row.discovered_urls || [], notes: row.notes || "",
    } as OfficialCrawlResult;
  });
}
