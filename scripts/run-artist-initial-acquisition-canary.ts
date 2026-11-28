#!/usr/bin/env -S npx vite-node
import { createClient } from "@supabase/supabase-js";
import { runArtistInitialAcquisition } from "../src/lib/wikidata/artist-initial-acquisition";
import { validateArtistCanaryTarget } from "./lib/artist-canary-target";

function option(name: string, fallback: string) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : fallback;
}

const stg = process.argv.includes("--stg");
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
const { count, batch } = validateArtistCanaryTarget({
  stg,
  projectRef: process.env.MUUZEE_STG_PROJECT_REF,
  supabaseUrl,
  count: Number(option("--count", stg ? "150" : "50")),
  batch: Number(option("--batch", "50")),
});
if (!serviceRole) throw new Error("SUPABASE_SERVICE_ROLE_KEY is required.");
const db = createClient(supabaseUrl, serviceRole, { auth: { persistSession: false, autoRefreshToken: false } });
const started = performance.now();
let claimed = 0;
const totals = { created: 0, exactSource: 0, review: 0, invalid: 0 };
while (claimed < count) {
  const result = await runArtistInitialAcquisition(db, { limit: Math.min(batch, count - claimed) });
  if (!result.claimed) break;
  claimed += result.claimed;
  totals.created += result.created;
  totals.exactSource += result.exactSource;
  totals.review += result.review;
  totals.invalid += result.invalid;
}
console.log(JSON.stringify({
  target: stg ? "approved-stg" : "local",
  requested: count,
  batch,
  claimed,
  ...totals,
  durationMs: Math.round(performance.now() - started),
  imageDiscoveryExecuted: false,
}));
