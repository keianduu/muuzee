#!/usr/bin/env node
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { createClient } from "@supabase/supabase-js";
import {
  persistArtistManifest,
  validateArtistManifest,
  validateArtistManifestTarget,
} from "./lib/artist-seed-manifest-persistence.mjs";

const stg = process.argv.includes("--stg");
const path = resolve("data/artist-acquisition/mvp-artist-seed-manifest.v1.json");
const manifest = validateArtistManifest(JSON.parse(await readFile(path, "utf8")));
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
validateArtistManifestTarget({ stg, projectRef: process.env.MUUZEE_STG_PROJECT_REF, supabaseUrl });
if (!serviceRole) throw new Error("SUPABASE_SERVICE_ROLE_KEY is required.");
const db = createClient(supabaseUrl, serviceRole, { auth: { persistSession: false, autoRefreshToken: false } });
const result = await persistArtistManifest(db, manifest);
console.log(JSON.stringify({
  target: stg ? "approved-stg" : "local",
  manifestScope: manifest.scope,
  manifestVersion: manifest.version,
  manifestChecksum: manifest.checksum,
  manifestCount: manifest.artists.length,
  runId: result.runId,
  inventoryCount: result.itemCount,
}));
