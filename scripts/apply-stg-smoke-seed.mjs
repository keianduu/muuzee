import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const STG_PROJECT_REF = "steibqgeoqcsfsafaqcv";
const LOCAL_DB_CONTAINER = "supabase_db_muuzee";
const seedPath = fileURLToPath(new URL("../supabase/seeds/stg_smoke.sql", import.meta.url));
const seedSql = readFileSync(seedPath, "utf8");
const target = process.argv[2];

function fail(message) {
  console.error(message);
  process.exit(1);
}

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    encoding: "utf8",
    stdio: ["pipe", "inherit", "inherit"],
    input: seedSql,
    ...options,
  });
  if (result.error) fail(result.error.message);
  if (result.status !== 0) process.exit(result.status ?? 1);
}

if (target === "--local") {
  run("docker", ["exec", "-i", LOCAL_DB_CONTAINER, "psql", "-v", "ON_ERROR_STOP=1", "-U", "postgres", "-d", "postgres"]);
  console.log("Applied deterministic smoke seed to LOCAL Supabase.");
  process.exit(0);
}

if (target === "--stg") {
  const databaseUrl = process.env.SUPABASE_DB_URL;
  const confirmedRef = process.env.MUUZEE_STG_PROJECT_REF;
  if (!databaseUrl) fail("SUPABASE_DB_URL is required for --stg.");
  if (confirmedRef !== STG_PROJECT_REF) {
    fail(`MUUZEE_STG_PROJECT_REF must equal the approved STG ref (${STG_PROJECT_REF}).`);
  }

  let parsed;
  try {
    parsed = new URL(databaseUrl);
  } catch {
    fail("SUPABASE_DB_URL must be a valid PostgreSQL URL.");
  }
  const targetIdentity = `${parsed.hostname}/${decodeURIComponent(parsed.username)}`;
  if (!targetIdentity.includes(STG_PROJECT_REF)) {
    fail("SUPABASE_DB_URL does not identify the approved Muuzee STG project.");
  }

  const postgresEnvironment = {
    ...process.env,
    PGHOST: parsed.hostname,
    PGPORT: parsed.port || "5432",
    PGDATABASE: decodeURIComponent(parsed.pathname.replace(/^\//, "") || "postgres"),
    PGUSER: decodeURIComponent(parsed.username),
    PGPASSWORD: decodeURIComponent(parsed.password),
    PGSSLMODE: parsed.searchParams.get("sslmode") || "require",
  };
  delete postgresEnvironment.SUPABASE_DB_URL;

  run("psql", ["-v", "ON_ERROR_STOP=1"], { env: postgresEnvironment });
  console.log(`Applied deterministic smoke seed to approved STG project ${STG_PROJECT_REF}.`);
  process.exit(0);
}

fail("Usage: node scripts/apply-stg-smoke-seed.mjs --local|--stg");
