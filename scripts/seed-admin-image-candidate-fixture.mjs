import { createClient } from "@supabase/supabase-js";

const VENUE_ID = "32500000-0000-4325-8325-000000000001";
const VENUE_SLUG = "order325-local-image-candidate-venue";
const SOURCE_KEY = "muuzee_local_fixture";
const SOURCE_EXTERNAL_ID = "order325-local-image-candidate";
const CANDIDATE_STABLE_ID = "order325-venue-candidate-v1";
const FIXTURE_PATH = "/fixtures/order325-venue-candidate.svg";

function fail(message) {
  console.error(message);
  process.exit(1);
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!supabaseUrl || !serviceRoleKey) fail("LOCAL Supabase environment is required.");

let parsedUrl;
try {
  parsedUrl = new URL(supabaseUrl);
} catch {
  fail("NEXT_PUBLIC_SUPABASE_URL must be a valid LOCAL URL.");
}

if (process.env.VERCEL || process.env.NODE_ENV === "production" || !["127.0.0.1", "localhost"].includes(parsedUrl.hostname)) {
  fail("Refusing to modify a non-LOCAL Supabase project.");
}

const db = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

async function must(result, label) {
  const resolved = await result;
  if (resolved.error) fail(`${label}: ${resolved.error.message}`);
  return resolved.data;
}

if (process.argv.includes("--cleanup")) {
  await must(db.from("venues").delete().eq("id", VENUE_ID), "Delete fixture Venue");
  await must(db.from("data_sources").delete().eq("key", SOURCE_KEY), "Delete fixture Data Source");
  console.log(JSON.stringify({ action: "cleanup", venueId: VENUE_ID, candidateCount: 0 }, null, 2));
  process.exit(0);
}

await must(db.from("venues").upsert({
  id: VENUE_ID,
  slug: VENUE_SLUG,
  name: "LOCAL Image Candidate Venue",
  name_en: "LOCAL Image Candidate Venue",
  venue_type: "museum",
  postal_code: "100-0005",
  prefecture: "東京都",
  city: "千代田区",
  address: "東京都千代田区丸の内1丁目",
  country_code: "JP",
  latitude: 35.681236,
  longitude: 139.767125,
  coordinate_source: "manual",
  coordinate_precision: "exact",
  coordinate_status: "manual",
  normalized_name: "local image candidate venue",
  normalized_address: "東京都千代田区丸の内1丁目",
  description: "Order 325のLOCAL Admin QA専用fixtureです。Productionデータではありません。",
  publication_status: "draft",
  is_active: true,
}, { onConflict: "id" }), "Upsert fixture Venue");

const dataSource = await must(db.from("data_sources").upsert({
  key: SOURCE_KEY,
  name: "Muuzee LOCAL QA Fixture",
  base_url: "http://127.0.0.1:3000",
  terms_url: null,
  metadata_license: "Synthetic fixture; LOCAL QA only",
}, { onConflict: "key" }).select("id").single(), "Upsert fixture Data Source");

const sourceRecord = await must(db.from("source_records").upsert({
  data_source_id: dataSource.id,
  external_id: SOURCE_EXTERNAL_ID,
  source_url: `http://127.0.0.1:3000${FIXTURE_PATH}`,
  venue_id: VENUE_ID,
  raw_payload: { fixture: true, task: "Order 325", environment: "LOCAL" },
  fetched_at: new Date().toISOString(),
}, { onConflict: "data_source_id,external_id" }).select("id").single(), "Upsert fixture Source Record");

await must(db.from("source_image_candidates").upsert({
  source_record_id: sourceRecord.id,
  image_url: FIXTURE_PATH,
  thumbnail_url: FIXTURE_PATH,
  provider: SOURCE_KEY,
  stable_identifier: CANDIDATE_STABLE_ID,
  source_url: `http://127.0.0.1:3000${FIXTURE_PATH}`,
  author: "Muuzee",
  credit: "Synthetic LOCAL-only QA fixture",
  license_short_name: "CC0 1.0",
  license_url: "https://creativecommons.org/publicdomain/zero/1.0/",
  usage_terms: "Synthetic fixture created for LOCAL Admin QA.",
  rights_status: "needs_review",
  candidate_entity_id: VENUE_ID,
  candidate_entity_label: "LOCAL Image Candidate Venue",
  candidate_match_confidence: 1,
  candidate_match_threshold: 1,
  candidate_kind: "reference",
  discovery_source: "open_collection",
  source_type: "open_collection",
  commercial_use: "allowed",
  modification_crop: "allowed",
  attribution_requirement: "not_required",
  review_status: "unreviewed",
  is_active: true,
  notes: "Deterministic LOCAL-only fixture for Order 325 image candidate QA.",
  last_seen_at: new Date().toISOString(),
}, { onConflict: "source_record_id,provider,stable_identifier" }), "Upsert fixture Image Candidate");

const candidates = await must(db.from("source_image_candidates").select("id").eq("source_record_id", sourceRecord.id), "Count fixture Image Candidates");
console.log(JSON.stringify({
  action: "seed",
  venueId: VENUE_ID,
  venueName: "LOCAL Image Candidate Venue",
  candidateCount: candidates.length,
  openPath: `/admin/venues?selected=${VENUE_ID}&venueEdit=image`,
  cleanup: "npm run db:cleanup:admin-image-candidate-local",
}, null, 2));
