import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import {
  APPROVED_STG_PROJECT_REF,
  VENUE_DISCOVERY_OPERATION,
} from "./venue-discovery-inventory-generator.mjs";

export const APPROVED_STG_REMOTE_ARGUMENT = `--remote=${APPROVED_STG_PROJECT_REF}`;
export const SUPABASE_CLI_EXECUTABLE = fileURLToPath(
  new URL("../../node_modules/.bin/supabase", import.meta.url),
);

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const QID_PATTERN = /^Q[0-9]+$/;
const GENERATION_STATUSES = new Set(["running", "partial"]);
const UPDATE_FIELDS = new Set(["status", "errors", "finished_at", "metrics"]);

function fail(message) {
  throw new Error(message);
}

export function assertUuid(value, label = "UUID") {
  if (typeof value !== "string" || !UUID_PATTERN.test(value)) fail(`${label} must be a UUID.`);
  return value;
}

export function assertQid(value, label = "QID") {
  if (typeof value !== "string" || !QID_PATTERN.test(value)) fail(`${label} must be a QID.`);
  return value;
}

export function sqlStringLiteral(value) {
  if (typeof value !== "string" || value.includes("\0")) fail("SQL text value is invalid.");
  return `'${value.replaceAll("'", "''")}'`;
}

export function sqlJsonLiteral(value) {
  const serialized = JSON.stringify(value);
  if (serialized === undefined) fail("SQL JSON value is invalid.");
  return `${sqlStringLiteral(serialized)}::jsonb`;
}

function sqlUuidLiteral(value, label) {
  return `${sqlStringLiteral(assertUuid(value, label))}::uuid`;
}

function sqlQidLiteral(value, label) {
  return sqlStringLiteral(assertQid(value, label));
}

function sqlQidArrayLiteral(values) {
  if (!Array.isArray(values)) fail("Discovery QIDs must be an array.");
  if (values.length === 0) return "'{}'::text[]";
  return `array[${values.map((value) => sqlQidLiteral(value, "Discovery QID")).join(", ")}]::text[]`;
}

function sqlTimestampLiteral(value) {
  if (value === null) return "null";
  if (typeof value !== "string" || Number.isNaN(Date.parse(value))) fail("Timestamp must be an ISO date string or null.");
  return `${sqlStringLiteral(value)}::timestamptz`;
}

function parseCliJson(stdout) {
  const output = String(stdout || "").trim();
  if (!output) fail("Supabase CLI returned no JSON output.");

  let payload;
  try {
    payload = JSON.parse(output);
  } catch {
    const jsonStart = output.indexOf("{");
    if (jsonStart < 0) fail("Supabase CLI returned invalid JSON output.");
    try {
      payload = JSON.parse(output.slice(jsonStart));
    } catch {
      fail("Supabase CLI returned invalid JSON output.");
    }
  }
  if (!payload || !Array.isArray(payload.rows)) fail("Supabase CLI JSON output is missing rows.");
  return payload;
}

export function createSupabaseCliExecutor({
  executable = SUPABASE_CLI_EXECUTABLE,
  spawn = spawnSync,
  timeoutMs = 60_000,
} = {}) {
  return function executeSupabaseCli(args) {
    if (!Array.isArray(args) || args.some((argument) => typeof argument !== "string")) {
      fail("Supabase CLI arguments must be a string array.");
    }
    const result = spawn(executable, args, {
      encoding: "utf8",
      maxBuffer: 1024 * 1024,
      shell: false,
      timeout: timeoutMs,
    });
    if (result?.error?.code === "ENOENT") fail("Supabase CLI is unavailable.");
    if (result?.error || result?.status !== 0) fail("Supabase CLI query failed.");
    const targetMarker = `(${APPROVED_STG_PROJECT_REF})`;
    if (!String(result.stderr || "").includes(targetMarker)) {
      fail("Supabase CLI target could not be verified as the approved STG project.");
    }
    return parseCliJson(result.stdout);
  };
}

async function must(promise, context) {
  const result = await promise;
  if (result.error) throw new Error(`${context}: ${result.error.message}`);
  return result.data;
}

export function createLocalVenueDiscoveryPersistence(db) {
  if (!db) fail("LOCAL Supabase client is required.");
  return {
    target: "local",
    async preflight() {},
    async loadDataSource() {
      const source = await must(
        db.from("data_sources").select("id").eq("key", "wikidata").single(),
        "Load Wikidata source",
      );
      return source.id;
    },
    async findResumableGeneration(dataSourceId) {
      return must(
        db.from("import_runs")
          .select("id,data_source_id,status,operation_type,metrics")
          .eq("data_source_id", dataSourceId)
          .eq("operation_type", VENUE_DISCOVERY_OPERATION)
          .in("status", ["running", "partial"])
          .order("started_at", { ascending: false })
          .limit(1)
          .maybeSingle(),
        "Find resumable discovery generation",
      );
    },
    async loadGeneration(generationId) {
      return must(
        db.from("import_runs")
          .select("id,data_source_id,status,operation_type,metrics")
          .eq("id", generationId)
          .single(),
        "Load requested discovery generation",
      );
    },
    async createGeneration({ dataSourceId, checkpoint }) {
      return must(
        db.from("import_runs").insert({
          data_source_id: dataSourceId,
          operation_type: VENUE_DISCOVERY_OPERATION,
          status: "running",
          metrics: checkpoint,
        }).select("id").single(),
        "Create discovery generation",
      );
    },
    async updateGeneration(generationId, updates, context = "Update discovery generation") {
      await must(db.from("import_runs").update(updates).eq("id", generationId), context);
    },
    async recordPage({ dataSourceId, generationId, rootQid, externalIds }) {
      await must(db.rpc("record_venue_discovery_inventory_page", {
        p_data_source_id: dataSourceId,
        p_generation_id: generationId,
        p_root_id: rootQid,
        p_external_ids: externalIds,
      }), "Persist discovery page");
    },
    async completeGeneration({ generationId, checkpoint }) {
      await must(db.rpc("complete_venue_discovery_inventory_generation", {
        p_generation_id: generationId,
        p_metrics: checkpoint,
      }), "Complete discovery generation");
    },
  };
}

function buildReadArguments(sql) {
  return [
    "db",
    "query",
    sql,
    "--read-only",
    APPROVED_STG_REMOTE_ARGUMENT,
    "--output-format=json",
  ];
}

function buildMutationArguments(sql) {
  return [
    "db",
    "query",
    sql,
    APPROVED_STG_REMOTE_ARGUMENT,
    "--output-format=json",
    "--yes",
  ];
}

function rowOrNull(payload) {
  return payload.rows[0] || null;
}

function validateUpdates(updates) {
  if (!updates || typeof updates !== "object" || Array.isArray(updates)) fail("Generation updates must be an object.");
  for (const key of Object.keys(updates)) {
    if (!UPDATE_FIELDS.has(key)) fail(`Unsupported generation update field: ${key}`);
  }
  if ("status" in updates && !GENERATION_STATUSES.has(updates.status)) fail("Invalid generation status.");
  if ("errors" in updates && updates.errors !== null && !Array.isArray(updates.errors)) fail("Generation errors must be an array or null.");
  if ("metrics" in updates && (!updates.metrics || typeof updates.metrics !== "object" || Array.isArray(updates.metrics))) {
    fail("Generation metrics must be an object.");
  }
}

export function createStgVenueDiscoveryPersistence({ executeCli, applyIntent }) {
  if (typeof executeCli !== "function") fail("Supabase CLI executor is required.");

  async function read(sql) {
    return executeCli(buildReadArguments(sql));
  }

  async function mutate(sql) {
    if (applyIntent !== true) fail("STG mutation requires explicit --stg --apply intent.");
    return executeCli(buildMutationArguments(sql));
  }

  return {
    target: "stg",
    async preflight() {
      const payload = await read(`select ${sqlStringLiteral(APPROVED_STG_PROJECT_REF)}::text as approved_project_ref;`);
      if (rowOrNull(payload)?.approved_project_ref !== APPROVED_STG_PROJECT_REF) {
        fail("Supabase CLI target could not be verified as the approved STG project.");
      }
    },
    async loadDataSource() {
      const payload = await read("select id::text as id from public.data_sources where key = 'wikidata' order by id limit 2;");
      if (payload.rows.length !== 1) fail("Approved STG Wikidata source could not be resolved uniquely.");
      return assertUuid(payload.rows[0].id, "Wikidata source ID");
    },
    async findResumableGeneration(dataSourceId) {
      const payload = await read(`select id::text as id, data_source_id::text as data_source_id, status, operation_type, metrics
from public.import_runs
where data_source_id = ${sqlUuidLiteral(dataSourceId, "Data source ID")}
  and operation_type = ${sqlStringLiteral(VENUE_DISCOVERY_OPERATION)}
  and status in ('running', 'partial')
order by started_at desc
limit 1;`);
      return rowOrNull(payload);
    },
    async loadGeneration(generationId) {
      const payload = await read(`select id::text as id, data_source_id::text as data_source_id, status, operation_type, metrics
from public.import_runs
where id = ${sqlUuidLiteral(generationId, "Generation ID")}
limit 2;`);
      if (payload.rows.length !== 1) fail("Requested discovery generation could not be resolved uniquely.");
      return payload.rows[0];
    },
    async createGeneration({ dataSourceId, checkpoint }) {
      const payload = await mutate(`insert into public.import_runs (data_source_id, operation_type, status, metrics)
values (
  ${sqlUuidLiteral(dataSourceId, "Data source ID")},
  ${sqlStringLiteral(VENUE_DISCOVERY_OPERATION)},
  'running',
  ${sqlJsonLiteral(checkpoint)}
)
returning id::text as id;`);
      if (payload.rows.length !== 1) fail("Discovery generation creation did not return an ID.");
      return { id: assertUuid(payload.rows[0].id, "Generation ID") };
    },
    async updateGeneration(generationId, updates) {
      assertUuid(generationId, "Generation ID");
      validateUpdates(updates);
      const assignments = [];
      if ("status" in updates) assignments.push(`status = ${sqlStringLiteral(updates.status)}`);
      if ("errors" in updates) assignments.push(`errors = ${updates.errors === null ? "null" : sqlJsonLiteral(updates.errors)}`);
      if ("finished_at" in updates) assignments.push(`finished_at = ${sqlTimestampLiteral(updates.finished_at)}`);
      if ("metrics" in updates) assignments.push(`metrics = ${sqlJsonLiteral(updates.metrics)}`);
      if (assignments.length === 0) fail("Generation update must include at least one field.");
      const payload = await mutate(`update public.import_runs
set ${assignments.join(",\n    ")}
where id = ${sqlUuidLiteral(generationId, "Generation ID")}
returning id::text as id;`);
      if (payload.rows.length !== 1) fail("Discovery generation update did not affect exactly one row.");
    },
    async recordPage({ dataSourceId, generationId, rootQid, externalIds }) {
      const payload = await mutate(`select public.record_venue_discovery_inventory_page(
  ${sqlUuidLiteral(dataSourceId, "Data source ID")},
  ${sqlUuidLiteral(generationId, "Generation ID")},
  ${sqlQidLiteral(rootQid, "Discovery root QID")},
  ${sqlQidArrayLiteral(externalIds)}
) as affected;`);
      if (payload.rows.length !== 1) fail("Discovery page persistence returned an invalid result.");
    },
    async completeGeneration({ generationId, checkpoint }) {
      const payload = await mutate(`select public.complete_venue_discovery_inventory_generation(
  ${sqlUuidLiteral(generationId, "Generation ID")},
  ${sqlJsonLiteral(checkpoint)}
) as result;`);
      if (payload.rows.length !== 1) fail("Discovery generation completion returned an invalid result.");
    },
  };
}
