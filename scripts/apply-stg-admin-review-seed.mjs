import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { deflateSync } from "node:zlib";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";

export const APPROVED_STG_PROJECT_REF = "steibqgeoqcsfsafaqcv";
export const APPROVED_STG_APP_ORIGIN = "https://muuzee-stg.vercel.app";
export const FIXTURE_UUID_PREFIX = "32590000-0000-4325-8325-";
export const FIXTURE_COUNTS = Object.freeze({
  exhibitions: 56,
  venues: 56,
  artists: 56,
  works: 56,
  sourceRecords: 48,
  imageCandidates: 12,
  mediaAssets: 24,
  occurrences: 54,
  exhibitionArtists: 50,
  venueMentions: 2,
  artistMentions: 2,
  workArtists: 58,
  collectionHoldings: 57,
  workPresentations: 12,
});
export const FIXTURE_DB_COUNTS = Object.freeze({
  dataSources: 1,
  dataSourceExact: 1,
  ...FIXTURE_COUNTS,
});

const LOCAL_DB_CONTAINER = "supabase_db_muuzee";
const MEDIA_BUCKET = "exhibition-images";
const MEDIA_PREFIX = "stg-admin-review";
const STORAGE_LIST_LIMIT = 100;
const STORAGE_MAX_ENTRIES = 100;
const seedPath = fileURLToPath(new URL("../supabase/seeds/stg_admin_review.sql", import.meta.url));
const cleanupPath = fileURLToPath(new URL("../supabase/seeds/stg_admin_review_cleanup.sql", import.meta.url));
const statePath = fileURLToPath(new URL("../supabase/seeds/stg_admin_review_state.sql", import.meta.url));
const seedSql = readFileSync(seedPath, "utf8");
const cleanupSql = readFileSync(cleanupPath, "utf8");
const stateSql = readFileSync(statePath, "utf8");

const MEDIA_MATRIX = Object.freeze([
  ...[1, 2, 3, 4, 5, 6].map((index) => ["venue", index]),
  ...[4, 5, 6, 9, 10, 11].map((index) => ["artist", index]),
  ...[1, 2, 3, 4, 5, 6].map((index) => ["work", index]),
  ...[1, 2, 3, 4, 5, 6].map((index) => ["exhibition", index]),
]);

const OWNER_DIGITS = Object.freeze({
  venue: "1",
  artist: "2",
  work: "3",
  exhibition: "4",
});

function invariant(condition, message) {
  if (!condition) throw new Error(message);
}

export function fixtureUuid(ownerType, index) {
  const digit = OWNER_DIGITS[ownerType];
  invariant(Boolean(digit), `Unknown fixture owner type: ${ownerType}`);
  invariant(Number.isInteger(index) && index >= 1 && index <= 56, "Fixture index must be an integer from 1 to 56.");
  return `${FIXTURE_UUID_PREFIX}${digit}${String(index).padStart(11, "0")}`;
}

export function fixtureMediaObjects() {
  return MEDIA_MATRIX.map(([ownerType, index], order) => ({
    ownerType,
    ownerId: fixtureUuid(ownerType, index),
    storagePath: `stg-admin-review/${ownerType}s/${fixtureUuid(ownerType, index)}/primary.png`,
    variant: order % 4,
  }));
}

export const FIXTURE_STATE = Object.freeze({
  CLEAN: "CLEAN",
  COMPLETE: "COMPLETE",
  PARTIAL: "PARTIAL",
});

export function classifyFixtureState({ dbCounts, storagePaths }) {
  const expectedStoragePaths = fixtureMediaObjects().map((object) => object.storagePath).sort();
  const actualStoragePaths = [...storagePaths].sort();
  const dbEntries = Object.entries(FIXTURE_DB_COUNTS);
  const dbIsClean = dbEntries.every(([key]) => dbCounts[key] === 0);
  const dbIsComplete = dbEntries.every(([key, expected]) => dbCounts[key] === expected);
  const storageIsClean = actualStoragePaths.length === 0;
  const storageIsComplete = actualStoragePaths.length === expectedStoragePaths.length
    && actualStoragePaths.every((path, index) => path === expectedStoragePaths[index]);

  if (dbIsClean && storageIsClean) return FIXTURE_STATE.CLEAN;
  if (dbIsComplete && storageIsComplete) return FIXTURE_STATE.COMPLETE;
  return FIXTURE_STATE.PARTIAL;
}

export function parseFixtureArguments(argv) {
  const allowed = new Set(["--local", "--stg", "--cleanup"]);
  const unexpected = argv.filter((argument) => !allowed.has(argument));
  invariant(unexpected.length === 0, `Unexpected argument(s): ${unexpected.join(", ")}`);
  const local = argv.includes("--local");
  const stg = argv.includes("--stg");
  invariant(local !== stg, "Exactly one explicit target is required: --local or --stg.");
  return { target: local ? "local" : "stg", cleanup: argv.includes("--cleanup") };
}

export function validateLocalConfiguration({ supabaseUrl, vercel, nodeEnv }) {
  invariant(!vercel && nodeEnv !== "production", "Refusing to modify LOCAL fixture data from a Production/Vercel runtime.");
  let parsed;
  try {
    parsed = new URL(supabaseUrl);
  } catch {
    throw new Error("NEXT_PUBLIC_SUPABASE_URL must be a valid LOCAL URL.");
  }
  invariant(["127.0.0.1", "localhost"].includes(parsed.hostname), "LOCAL fixture target must use localhost or 127.0.0.1.");
  return parsed;
}

export function validateStgConfiguration({ projectRef, databaseUrl, supabaseUrl }) {
  invariant(projectRef === APPROVED_STG_PROJECT_REF, `MUUZEE_STG_PROJECT_REF must equal ${APPROVED_STG_PROJECT_REF}.`);
  let database;
  let api;
  try {
    database = new URL(databaseUrl);
  } catch {
    throw new Error("SUPABASE_DB_URL must be a valid PostgreSQL URL.");
  }
  try {
    api = new URL(supabaseUrl);
  } catch {
    throw new Error("NEXT_PUBLIC_SUPABASE_URL must be a valid STG Supabase URL.");
  }
  const databaseIdentity = `${database.hostname}/${decodeURIComponent(database.username)}`;
  invariant(databaseIdentity.includes(APPROVED_STG_PROJECT_REF), "SUPABASE_DB_URL does not identify the approved Muuzee STG project.");
  invariant(api.protocol === "https:" && api.hostname === `${APPROVED_STG_PROJECT_REF}.supabase.co`, "NEXT_PUBLIC_SUPABASE_URL does not identify the approved Muuzee STG project.");
  return { database, api };
}

function crc32(buffer) {
  let crc = 0xffffffff;
  for (const byte of buffer) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) crc = (crc >>> 1) ^ ((crc & 1) ? 0xedb88320 : 0);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function pngChunk(type, data) {
  const name = Buffer.from(type, "ascii");
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const checksum = Buffer.alloc(4);
  checksum.writeUInt32BE(crc32(Buffer.concat([name, data])));
  return Buffer.concat([length, name, data, checksum]);
}

export function createSyntheticPng(variant = 0) {
  const palettes = [
    [[185, 111, 85], [247, 245, 241]],
    [[71, 94, 116], [226, 234, 237]],
    [[98, 121, 101], [232, 238, 230]],
    [[78, 69, 91], [238, 232, 241]],
  ];
  const colors = palettes[((variant % palettes.length) + palettes.length) % palettes.length];
  const width = 64;
  const height = 64;
  const stride = width * 4 + 1;
  const raw = Buffer.alloc(stride * height);
  for (let y = 0; y < height; y += 1) {
    raw[y * stride] = 0;
    for (let x = 0; x < width; x += 1) {
      const color = colors[(Math.floor(x / 16) + Math.floor(y / 16)) % 2];
      const offset = y * stride + 1 + x * 4;
      raw[offset] = color[0];
      raw[offset + 1] = color[1];
      raw[offset + 2] = color[2];
      raw[offset + 3] = 255;
    }
  }
  const header = Buffer.alloc(13);
  header.writeUInt32BE(width, 0);
  header.writeUInt32BE(height, 4);
  header[8] = 8;
  header[9] = 6;
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    pngChunk("IHDR", header),
    pngChunk("IDAT", deflateSync(raw)),
    pngChunk("IEND", Buffer.alloc(0)),
  ]);
}

function run(command, args, options = {}) {
  const result = spawnSync(command, args, { encoding: "utf8", stdio: ["pipe", "inherit", "inherit"], ...options });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`${command} exited with status ${result.status ?? 1}.`);
}

function runCapture(command, args, options = {}) {
  const result = spawnSync(command, args, { encoding: "utf8", stdio: ["pipe", "pipe", "inherit"], ...options });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`${command} exited with status ${result.status ?? 1}.`);
  return result.stdout.trim();
}

function postgresEnvironment(database) {
  const environment = {
    ...process.env,
    PGHOST: database.hostname,
    PGPORT: database.port || "5432",
    PGDATABASE: decodeURIComponent(database.pathname.replace(/^\//, "") || "postgres"),
    PGUSER: decodeURIComponent(database.username),
    PGPASSWORD: decodeURIComponent(database.password),
    PGSSLMODE: database.searchParams.get("sslmode") || "require",
  };
  delete environment.SUPABASE_DB_URL;
  return environment;
}

export async function uploadFixtureMedia(db) {
  for (const object of fixtureMediaObjects()) {
    const { error } = await db.storage.from(MEDIA_BUCKET).upload(object.storagePath, createSyntheticPng(object.variant), {
      contentType: "image/png",
      cacheControl: "3600",
      upsert: true,
    });
    if (error) throw new Error(`Upload ${object.storagePath}: ${error.message}`);
  }
}

export async function removeFixtureMedia(db) {
  const paths = fixtureMediaObjects().map((object) => object.storagePath);
  const { error } = await db.storage.from(MEDIA_BUCKET).remove(paths);
  if (error) throw new Error(`Remove fixture Storage objects: ${error.message}`);
}

export async function listFixtureStoragePaths(db) {
  const paths = [];
  let inspectedEntries = 0;

  async function visit(prefix, depth) {
    invariant(depth <= 4, `Fixture Storage path exceeds the bounded depth: ${prefix}`);
    let offset = 0;
    while (true) {
      const { data, error } = await db.storage.from(MEDIA_BUCKET).list(prefix, {
        limit: STORAGE_LIST_LIMIT,
        offset,
        sortBy: { column: "name", order: "asc" },
      });
      if (error) throw new Error(`List fixture Storage path ${prefix}: ${error.message}`);
      const entries = data ?? [];
      inspectedEntries += entries.length;
      invariant(inspectedEntries <= STORAGE_MAX_ENTRIES, `Fixture Storage inspection exceeded ${STORAGE_MAX_ENTRIES} entries.`);
      for (const entry of entries) {
        const path = `${prefix}/${entry.name}`;
        if (entry.id) paths.push(path);
        else await visit(path, depth + 1);
      }
      if (entries.length < STORAGE_LIST_LIMIT) break;
      offset += entries.length;
    }
  }

  await visit(MEDIA_PREFIX, 0);
  return paths.sort();
}

function applySql({ target, sql, fixtureBaseUrl, database }) {
  const variables = ["-v", "ON_ERROR_STOP=1", "-v", `fixture_base_url=${fixtureBaseUrl}`];
  if (target === "local") {
    run("docker", ["exec", "-i", LOCAL_DB_CONTAINER, "psql", ...variables, "-U", "postgres", "-d", "postgres"], { input: sql });
    return;
  }
  run("psql", [...variables], { input: sql, env: postgresEnvironment(database) });
}

function queryFixtureDbCounts({ target, database }) {
  let output;
  if (target === "local") {
    output = runCapture("docker", ["exec", "-i", LOCAL_DB_CONTAINER, "psql", "-tA", "-v", "ON_ERROR_STOP=1", "-U", "postgres", "-d", "postgres"], { input: stateSql });
  } else {
    output = runCapture("psql", ["-tA", "-v", "ON_ERROR_STOP=1"], { input: stateSql, env: postgresEnvironment(database) });
  }
  const jsonLine = output.split("\n").map((line) => line.trim()).filter(Boolean).at(-1);
  invariant(Boolean(jsonLine), "Fixture DB state query returned no result.");
  const counts = JSON.parse(jsonLine);
  for (const key of Object.keys(FIXTURE_DB_COUNTS)) {
    invariant(Number.isInteger(counts[key]), `Fixture DB state is missing integer count: ${key}.`);
  }
  return counts;
}

export async function inspectFixtureState({ target, database, db }) {
  const dbCounts = queryFixtureDbCounts({ target, database });
  const storagePaths = await listFixtureStoragePaths(db);
  return {
    classification: classifyFixtureState({ dbCounts, storagePaths }),
    dbCounts,
    storagePaths,
  };
}

function stateSummary(state) {
  return {
    classification: state.classification,
    dbCounts: state.dbCounts,
    storageObjectCount: state.storagePaths.length,
  };
}

export async function applyFixtureSafely({ initialState, upload, seed, remove, inspect }) {
  invariant(
    initialState.classification === FIXTURE_STATE.CLEAN || initialState.classification === FIXTURE_STATE.COMPLETE,
    `Fixture state is ${initialState.classification}; explicit cleanup is required before apply.`,
  );

  try {
    await upload();
    await seed();
  } catch (error) {
    if (initialState.classification === FIXTURE_STATE.CLEAN) {
      try {
        await remove();
        const restoredState = await inspect();
        invariant(restoredState.classification === FIXTURE_STATE.CLEAN, `CLEAN apply compensation left fixture state ${restoredState.classification}.`);
      } catch (compensationError) {
        throw new AggregateError([error, compensationError], "Fixture apply failed and CLEAN-state compensation did not complete.");
      }
    } else {
      try {
        const preservedState = await inspect();
        invariant(preservedState.classification === FIXTURE_STATE.COMPLETE, `Failed COMPLETE reapply left fixture state ${preservedState.classification}.`);
      } catch (verificationError) {
        throw new AggregateError([error, verificationError], "Fixture reapply failed and the pre-existing COMPLETE state could not be verified.");
      }
    }
    throw error;
  }

  const finalState = await inspect();
  invariant(finalState.classification === FIXTURE_STATE.COMPLETE, `Fixture apply ended in ${finalState.classification} state.`);
  return finalState;
}

async function main() {
  const options = parseFixtureArguments(process.argv.slice(2));
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  invariant(Boolean(supabaseUrl), "NEXT_PUBLIC_SUPABASE_URL is required.");
  invariant(Boolean(serviceRoleKey), "SUPABASE_SERVICE_ROLE_KEY is required.");

  let database = null;
  let fixtureBaseUrl;
  if (options.target === "local") {
    validateLocalConfiguration({ supabaseUrl, vercel: process.env.VERCEL, nodeEnv: process.env.NODE_ENV });
    fixtureBaseUrl = process.env.MUUZEE_LOCAL_APP_ORIGIN || "http://127.0.0.1:3000";
    validateLocalConfiguration({ supabaseUrl: fixtureBaseUrl, vercel: null, nodeEnv: "development" });
  } else {
    const validated = validateStgConfiguration({
      projectRef: process.env.MUUZEE_STG_PROJECT_REF,
      databaseUrl: process.env.SUPABASE_DB_URL,
      supabaseUrl,
    });
    database = validated.database;
    fixtureBaseUrl = APPROVED_STG_APP_ORIGIN;
  }

  const forceSqlFailure = process.env.MUUZEE_ADMIN_REVIEW_FORCE_SQL_FAILURE === "1";
  invariant(
    !forceSqlFailure || (options.target === "local" && process.env.NODE_ENV === "test"),
    "Forced SQL failure is restricted to explicit LOCAL test runs.",
  );

  const db = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const inspect = () => inspectFixtureState({ target: options.target, database, db });
  const initialState = await inspect();
  console.log(JSON.stringify({ action: "preflight", target: options.target.toUpperCase(), ...stateSummary(initialState) }, null, 2));

  if (options.cleanup) {
    applySql({ target: options.target, sql: cleanupSql, fixtureBaseUrl, database });
    await removeFixtureMedia(db);
    const finalState = await inspect();
    invariant(finalState.classification === FIXTURE_STATE.CLEAN, `Fixture cleanup ended in ${finalState.classification} state.`);
  } else {
    await applyFixtureSafely({
      initialState,
      upload: () => uploadFixtureMedia(db),
      seed: () => {
        if (forceSqlFailure) throw new Error("Forced Order 325.9 LOCAL SQL failure.");
        applySql({ target: options.target, sql: seedSql, fixtureBaseUrl, database });
      },
      remove: () => removeFixtureMedia(db),
      inspect,
    });
  }

  console.log(JSON.stringify({
    action: options.cleanup ? "cleanup" : "apply",
    target: options.target.toUpperCase(),
    fixtureNamespace: `${FIXTURE_UUID_PREFIX}*`,
    counts: options.cleanup ? { exhibitions: 0, venues: 0, artists: 0, works: 0 } : FIXTURE_COUNTS,
    storageObjectCount: options.cleanup ? 0 : fixtureMediaObjects().length,
    migration: 0,
  }, null, 2));
}

const invokedPath = process.argv[1] ? resolve(process.argv[1]) : null;
if (invokedPath === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}
