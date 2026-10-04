import { createClient } from "@supabase/supabase-js";

const VENUE_ID = "32500000-0000-4325-8325-000000000003";
const VENUE_NAME = "LOCAL Multi Candidate Review Venue";
const VENUE_SLUG = "order325-local-multi-candidate-review-venue";
const DATA_SOURCE_ID = "32500000-0000-4325-8325-000000000010";
const SOURCE_RECORD_ID = "32500000-0000-4325-8325-000000000011";
const SOURCE_KEY = "muuzee_local_multi_candidate_fixture";
const SOURCE_EXTERNAL_ID = "order325-local-multi-candidate-review";
const FIXTURE_SOURCE_PATH = "/fixtures/order325-multi-candidate-source.html";

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

async function cleanupFixture() {
  const media = await must(db.from("media_assets").select("storage_path").eq("venue_id", VENUE_ID), "Read fixture Media Assets");
  const storagePaths = (media || []).map((item) => item.storage_path).filter(Boolean);
  if (storagePaths.length) {
    await must(db.storage.from("exhibition-images").remove(storagePaths), "Delete fixture Storage objects");
  }
  await must(db.from("source_records").delete().eq("venue_id", VENUE_ID), "Delete fixture Source Records");
  await must(db.from("venues").delete().eq("id", VENUE_ID), "Delete fixture Venue");
  await must(db.from("data_sources").delete().eq("id", DATA_SOURCE_ID).eq("key", SOURCE_KEY), "Delete fixture Data Source");
}

if (process.argv.includes("--cleanup")) {
  await cleanupFixture();
  console.log(JSON.stringify({
    action: "cleanup",
    venueId: VENUE_ID,
    venueName: VENUE_NAME,
    imageCandidateCount: 0,
    coordinateCandidateCount: 0,
    wikidataCandidateCount: 0,
  }, null, 2));
  process.exit(0);
}

// Reset only this deterministic fixture so every run restores the same
// pre-review state, including zero registered Media Assets / Primary images.
await cleanupFixture();

await must(db.from("venues").insert({
  id: VENUE_ID,
  slug: VENUE_SLUG,
  name: VENUE_NAME,
  name_en: "LOCAL Multi Candidate Review Venue",
  venue_type: "museum",
  postal_code: "100-0005",
  prefecture: "東京都",
  city: "千代田区",
  address: "東京都千代田区丸の内1丁目 LOCAL fixture",
  country_code: "JP",
  latitude: null,
  longitude: null,
  coordinate_source: null,
  coordinate_precision: null,
  coordinate_status: "candidate",
  normalized_name: "local multi candidate review venue",
  normalized_address: "東京都千代田区丸の内1丁目 local fixture",
  description: "Order 325の複数候補Human Review専用LOCAL fixtureです。Productionデータではありません。",
  publication_status: "draft",
  image_search_status: "image_candidate_found",
  wikidata_match_status: "unmatched",
  is_active: true,
}), "Insert fixture Venue");

await must(db.from("data_sources").insert({
  id: DATA_SOURCE_ID,
  key: SOURCE_KEY,
  name: "Muuzee LOCAL Multi Candidate QA Fixture",
  base_url: "http://127.0.0.1:3000/fixtures",
  terms_url: null,
  metadata_license: "Synthetic fixture; LOCAL QA only",
}), "Insert fixture Data Source");

await must(db.from("source_records").insert({
  id: SOURCE_RECORD_ID,
  data_source_id: DATA_SOURCE_ID,
  external_id: SOURCE_EXTERNAL_ID,
  source_url: `http://127.0.0.1:3000${FIXTURE_SOURCE_PATH}`,
  venue_id: VENUE_ID,
  raw_payload: { fixture: true, task: "Order 325", environment: "LOCAL", kind: "multi_candidate_review" },
  fetched_at: new Date().toISOString(),
}), "Insert fixture Source Record");

const imageCandidates = [
  {
    id: "32500000-0000-4325-8325-000000000101",
    imagePath: "/fixtures/order325-multi-candidate-a.svg",
    assetUrl: "https://raw.githubusercontent.com/keianduu/muuzee/main/prototype/assets/images/exhibitions/exhibition-08.jpg",
    stableIdentifier: "LOCAL-order325-candidate-a",
    discoverySource: "wikidata_p18",
    confidence: 1,
    threshold: 1,
    rightsStatus: "needs_review",
    reviewStatus: "unreviewed",
    commercialUse: "unknown",
    modificationCrop: "unknown",
    attributionRequirement: "required",
    note: "Synthetic strongest-candidate state for LOCAL Admin QA.",
  },
  {
    id: "32500000-0000-4325-8325-000000000102",
    imagePath: "/fixtures/order325-multi-candidate-b.svg",
    assetUrl: "https://raw.githubusercontent.com/keianduu/muuzee/main/prototype/assets/images/exhibitions/exhibition-09.jpg",
    stableIdentifier: "LOCAL-order325-candidate-b",
    discoverySource: "commons_category",
    confidence: 0.82,
    threshold: 0.7,
    rightsStatus: "approved",
    reviewStatus: "unreviewed",
    commercialUse: "allowed",
    modificationCrop: "allowed",
    attributionRequirement: "not_required",
    note: "Synthetic relaxed-depth approved state for LOCAL Admin QA.",
  },
  {
    id: "32500000-0000-4325-8325-000000000103",
    imagePath: "/fixtures/order325-multi-candidate-c.svg",
    assetUrl: "https://raw.githubusercontent.com/keianduu/muuzee/main/prototype/assets/images/exhibitions/exhibition-04.jpg",
    stableIdentifier: "LOCAL-order325-candidate-c",
    discoverySource: "wikipedia_article",
    confidence: 0.65,
    threshold: 0.55,
    rightsStatus: "rejected",
    reviewStatus: "rejected",
    commercialUse: "forbidden",
    modificationCrop: "forbidden",
    attributionRequirement: "required",
    note: "Synthetic low-confidence rejected state for LOCAL Admin QA.",
  },
].map((candidate) => ({
  id: candidate.id,
  source_record_id: SOURCE_RECORD_ID,
  image_url: candidate.assetUrl,
  thumbnail_url: candidate.imagePath,
  provider: "repository_fixture",
  stable_identifier: candidate.stableIdentifier,
  source_url: `http://127.0.0.1:3000${candidate.imagePath}`,
  author: "Muuzee LOCAL Fixture",
  credit: `Synthetic LOCAL-only QA fixture · ${candidate.stableIdentifier}`,
  license_short_name: "CC0 1.0",
  license_url: "https://creativecommons.org/publicdomain/zero/1.0/",
  usage_terms: "Synthetic repository fixture. Deliberate review metadata is for UI QA only.",
  rights_status: candidate.rightsStatus,
  candidate_entity_id: VENUE_ID,
  candidate_entity_label: VENUE_NAME,
  candidate_match_confidence: candidate.confidence,
  candidate_match_threshold: candidate.threshold,
  candidate_kind: candidate.confidence === 1 ? "probable" : "reference",
  discovery_source: candidate.discoverySource,
  source_type: "open_collection",
  commercial_use: candidate.commercialUse,
  modification_crop: candidate.modificationCrop,
  attribution_requirement: candidate.attributionRequirement,
  review_status: candidate.reviewStatus,
  is_active: true,
  notes: candidate.note,
  last_seen_at: new Date().toISOString(),
}));

await must(db.from("source_image_candidates").insert(imageCandidates), "Insert fixture Image Candidates");

await must(db.from("venue_coordinate_candidates").insert([
  {
    id: "32500000-0000-4325-8325-000000000201",
    venue_id: VENUE_ID,
    source: "wikidata",
    candidate_key: "fixture-wikidata-a",
    latitude: 35.681236,
    longitude: 139.767125,
    confidence: 0.93,
    reason: "Synthetic high-confidence Wikidata candidate A",
    precision: "exact",
    review_status: "candidate",
  },
  {
    id: "32500000-0000-4325-8325-000000000202",
    venue_id: VENUE_ID,
    source: "wikidata",
    candidate_key: "fixture-wikidata-b",
    latitude: 35.6841,
    longitude: 139.7608,
    confidence: 0.76,
    reason: "Synthetic alternative Wikidata candidate B",
    precision: "exact",
    review_status: "candidate",
  },
  {
    id: "32500000-0000-4325-8325-000000000203",
    venue_id: VENUE_ID,
    source: "geolonia",
    candidate_key: "fixture-geolonia",
    latitude: 35.6763,
    longitude: 139.7712,
    confidence: null,
    reason: "Synthetic Geolonia address candidate",
    precision: "town",
    review_status: "candidate",
  },
]), "Insert fixture Coordinate Candidates");

await must(db.from("venue_field_sources").insert([
  {
    id: "32500000-0000-4325-8325-000000000301",
    venue_id: VENUE_ID,
    field_name: "name",
    source: "manual",
    source_url: null,
    source_record_id: null,
    value_snapshot: VENUE_NAME,
    review_status: "applied",
    is_current: true,
  },
  {
    id: "32500000-0000-4325-8325-000000000302",
    venue_id: VENUE_ID,
    field_name: "name_en",
    source: "wikidata",
    source_url: null,
    source_record_id: null,
    value_snapshot: "LOCAL Multi Candidate Review Venue",
    review_status: "applied",
    is_current: true,
  },
  {
    id: "32500000-0000-4325-8325-000000000303",
    venue_id: VENUE_ID,
    field_name: "address",
    source: "official_website",
    source_url: `http://127.0.0.1:3000${FIXTURE_SOURCE_PATH}`,
    source_record_id: null,
    value_snapshot: "東京都千代田区丸の内1丁目 LOCAL fixture",
    review_status: "applied",
    is_current: true,
  },
]), "Insert fixture Field Provenance");

const [images, coordinates, wikidataCandidates, media] = await Promise.all([
  must(db.from("source_image_candidates").select("id").eq("source_record_id", SOURCE_RECORD_ID).eq("is_active", true), "Count fixture Image Candidates"),
  must(db.from("venue_coordinate_candidates").select("id").eq("venue_id", VENUE_ID), "Count fixture Coordinate Candidates"),
  must(db.from("venue_external_match_candidates").select("id").eq("venue_id", VENUE_ID), "Count fixture Wikidata Candidates"),
  must(db.from("media_assets").select("id,is_primary").eq("venue_id", VENUE_ID), "Count fixture Media Assets"),
]);

console.log(JSON.stringify({
  action: "seed",
  venueId: VENUE_ID,
  venueName: VENUE_NAME,
  openPath: `/admin/venues?selected=${VENUE_ID}`,
  imageCandidateCount: images.length,
  coordinateCandidateCount: coordinates.length,
  wikidataCandidateCount: wikidataCandidates.length,
  registeredMediaCount: media.length,
  primaryCount: media.filter((item) => item.is_primary).length,
  cleanup: "npm run db:cleanup:admin-multi-candidate-local",
}, null, 2));
