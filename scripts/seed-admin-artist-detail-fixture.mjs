import { createClient } from "@supabase/supabase-js";

const ARTIST_ID = "32550000-0000-4325-8325-000000000001";
const DATA_SOURCE_ID = "32550000-0000-4325-8325-000000000010";
const SOURCE_RECORD_ID = "32550000-0000-4325-8325-000000000011";
const EXHIBITION_RELATION_ID = "32550000-0000-4325-8325-000000000020";
const WORK_RELATION_ID = "32550000-0000-4325-8325-000000000021";
const EXHIBITION_ID = "30000000-0000-4000-8000-000000000004";
const WORK_ID = "30000000-0000-4000-8000-000000000003";
const EXTRA_EXHIBITIONS = [
  { id: "32550000-0000-4325-8325-000000000030", slug: "order3255-long-exhibition-a", title: "LOCAL QA — 非常に長い展覧会タイトルがDrawer幅の中で安全に折り返されることを確認するための展覧会 A", publication_status: "published" },
  { id: "32550000-0000-4325-8325-000000000031", slug: "order3255-long-exhibition-b", title: "LOCAL QA — Multiple Artist Relation Review Exhibition B with an intentionally long English title", publication_status: "draft" },
];
const EXTRA_WORKS = [
  { id: "32550000-0000-4325-8325-000000000040", slug: "order3255-long-work-a", title: "LOCAL QA — 長い作品名称と役割ラベルがRelated Worksの行内で自然に折り返されることを確認する作品 A", title_ja: "LOCAL QA — 長い作品名称と役割ラベルがRelated Worksの行内で自然に折り返されることを確認する作品 A", publication_status: "published" },
  { id: "32550000-0000-4325-8325-000000000041", slug: "order3255-long-work-b", title: "LOCAL QA — Relation Containment Work B with an intentionally long multilingual display title", title_en: "LOCAL QA — Relation Containment Work B with an intentionally long multilingual display title", publication_status: "draft" },
];
const TAG_ID = "32550000-0000-4325-8325-000000000050";
const SOURCE_KEY = "muuzee_local_artist_detail_fixture";

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
  const media = await must(db.from("media_assets").select("storage_path").eq("artist_id", ARTIST_ID), "Read fixture Media Assets");
  const storagePaths = (media || []).map((item) => item.storage_path).filter(Boolean);
  if (storagePaths.length) await must(db.storage.from("exhibition-images").remove(storagePaths), "Delete fixture Storage objects");
  await must(db.from("exhibition_artists").delete().eq("artist_id", ARTIST_ID), "Delete fixture Exhibition relations");
  await must(db.from("work_artists").delete().eq("artist_id", ARTIST_ID), "Delete fixture Work relations");
  await must(db.from("artist_external_match_candidates").delete().eq("artist_id", ARTIST_ID), "Delete fixture Artist candidates");
  await must(db.from("artist_field_sources").delete().eq("artist_id", ARTIST_ID), "Delete fixture provenance");
  await must(db.from("artist_tags").delete().eq("artist_id", ARTIST_ID), "Delete fixture Artist tags");
  await must(db.from("source_records").delete().eq("artist_id", ARTIST_ID), "Delete fixture Source Records");
  await must(db.from("artists").delete().eq("id", ARTIST_ID), "Delete fixture Artist");
  await must(db.from("exhibitions").delete().in("id", EXTRA_EXHIBITIONS.map((item) => item.id)), "Delete fixture Exhibitions");
  await must(db.from("works").delete().in("id", EXTRA_WORKS.map((item) => item.id)), "Delete fixture Works");
  await must(db.from("tags").delete().eq("id", TAG_ID), "Delete fixture Tag");
  await must(db.from("data_sources").delete().eq("id", DATA_SOURCE_ID).eq("key", SOURCE_KEY), "Delete fixture Data Source");
}

if (process.argv.includes("--cleanup")) {
  await cleanupFixture();
  console.log(JSON.stringify({ action: "cleanup", artistId: ARTIST_ID }, null, 2));
  process.exit(0);
}

await cleanupFixture();

await must(db.from("artists").insert({
  id: ARTIST_ID,
  slug: "order3255-local-artist-detail",
  name: "LOCAL Artist Detail Review",
  name_en: "LOCAL Artist Detail Review",
  name_native: "LOCAL Artist Detail Review",
  name_kana: "ローカル アーティスト ディテール レビュー",
  birth_year: 1985,
  nationality_country_code: "JP",
  description: "Order 325.5 Artist Detail Human Review専用のLOCAL fixtureです。Productionデータではありません。",
  style_summary: "Synthetic fixture",
  publication_status: "draft",
}), "Insert fixture Artist");

await must(db.from("data_sources").insert({
  id: DATA_SOURCE_ID,
  key: SOURCE_KEY,
  name: "Muuzee LOCAL Artist Detail QA Fixture",
  base_url: "http://127.0.0.1:3000/fixtures",
  metadata_license: "Synthetic fixture; LOCAL QA only",
}), "Insert fixture Data Source");

await must(db.from("source_records").insert({
  id: SOURCE_RECORD_ID,
  data_source_id: DATA_SOURCE_ID,
  external_id: "order3255-local-artist-detail",
  source_url: "https://github.com/keianduu/muuzee",
  artist_id: ARTIST_ID,
  raw_payload: { fixture: true, task: "Order 325.5", environment: "LOCAL" },
  fetched_at: new Date().toISOString(),
}), "Insert fixture Source Record");

await must(db.from("source_image_candidates").insert([
  {
    id: "32550000-0000-4325-8325-000000000101",
    source_record_id: SOURCE_RECORD_ID,
    image_url: "https://raw.githubusercontent.com/keianduu/muuzee/main/prototype/assets/images/exhibitions/exhibition-08.jpg",
    thumbnail_url: "https://raw.githubusercontent.com/keianduu/muuzee/main/prototype/assets/images/exhibitions/exhibition-08.jpg",
    provider: SOURCE_KEY,
    stable_identifier: "order3255-artist-candidate-a",
    source_url: "https://github.com/keianduu/muuzee/blob/main/prototype/assets/images/exhibitions/exhibition-08.jpg",
    author: "Muuzee",
    credit: "Synthetic LOCAL-only QA fixture",
    license_short_name: "CC0 1.0",
    license_url: "https://creativecommons.org/publicdomain/zero/1.0/",
    usage_terms: "Synthetic fixture created for LOCAL Admin QA.",
    rights_status: "needs_review",
    candidate_entity_id: ARTIST_ID,
    candidate_entity_label: "LOCAL Artist Detail Review",
    candidate_match_confidence: 1,
    candidate_match_threshold: 1,
    candidate_kind: "reference",
    discovery_source: "wikidata_p18",
    review_status: "unreviewed",
    is_active: true,
  },
  {
    id: "32550000-0000-4325-8325-000000000102",
    source_record_id: SOURCE_RECORD_ID,
    image_url: "https://raw.githubusercontent.com/keianduu/muuzee/main/prototype/assets/images/exhibitions/exhibition-09.jpg",
    thumbnail_url: "https://raw.githubusercontent.com/keianduu/muuzee/main/prototype/assets/images/exhibitions/exhibition-09.jpg",
    provider: SOURCE_KEY,
    stable_identifier: "order3255-artist-candidate-b",
    source_url: "https://github.com/keianduu/muuzee/blob/main/prototype/assets/images/exhibitions/exhibition-09.jpg",
    author: "Muuzee",
    credit: "Synthetic LOCAL-only QA fixture",
    license_short_name: "CC0 1.0",
    license_url: "https://creativecommons.org/publicdomain/zero/1.0/",
    usage_terms: "Synthetic fixture created for LOCAL Admin QA.",
    rights_status: "approved",
    candidate_entity_id: ARTIST_ID,
    candidate_entity_label: "LOCAL Artist Detail Review",
    candidate_match_confidence: 0.82,
    candidate_match_threshold: 0.7,
    candidate_kind: "reference",
    discovery_source: "commons_category",
    review_status: "unreviewed",
    is_active: true,
  },
]), "Insert fixture Image Candidates");

await must(db.from("artist_external_match_candidates").insert({
  id: "32550000-0000-4325-8325-000000000060",
  artist_id: ARTIST_ID,
  provider: "wikidata",
  external_id: "Q231121",
  label_ja: "草間彌生",
  label_en: "Yayoi Kusama",
  birth_year: 1929,
  confidence: 0.18,
  match_reasons: ["LOCAL fixture for read-only candidate review"],
  status: "candidate",
  raw_payload: { fixture: true, verified_qid: true },
}), "Insert fixture Artist identity candidate");

await must(db.from("artist_field_sources").insert([
  { id: "32550000-0000-4325-8325-000000000070", artist_id: ARTIST_ID, field_name: "name", source: "manual", source_url: null, value_snapshot: "LOCAL Artist Detail Review", review_status: "applied", is_current: true },
  { id: "32550000-0000-4325-8325-000000000071", artist_id: ARTIST_ID, field_name: "name_en", source: "wikidata", source_url: "https://www.wikidata.org/wiki/Q231121", value_snapshot: "LOCAL Artist Detail Review", review_status: "applied", is_current: true },
  { id: "32550000-0000-4325-8325-000000000072", artist_id: ARTIST_ID, field_name: "nationality_country_code", source: "getty_ulan", source_url: "https://www.getty.edu/research/tools/vocabularies/ulan/", value_snapshot: "JP", review_status: "applied", is_current: true },
]), "Insert fixture Artist provenance");

await must(db.from("exhibitions").insert(EXTRA_EXHIBITIONS), "Insert fixture Exhibitions");
await must(db.from("works").insert(EXTRA_WORKS), "Insert fixture Works");
await must(db.from("tags").insert({ id: TAG_ID, type: "other", name: "LOCAL QA — 長いタグ名称がDrawer幅からはみ出さず折り返されることを確認", slug: "order3255-long-artist-tag" }), "Insert fixture Tag");
await must(db.from("artist_tags").insert({ artist_id: ARTIST_ID, tag_id: TAG_ID }), "Insert fixture Artist tag");

await must(db.from("exhibition_artists").insert({
  id: EXHIBITION_RELATION_ID,
  exhibition_id: EXHIBITION_ID,
  artist_id: ARTIST_ID,
  role: "artist",
  source_artist_name: "LOCAL Artist Detail Review",
  match_status: "matched",
  relation_status: "active",
  source_record_id: SOURCE_RECORD_ID,
}), "Insert fixture Exhibition relation");

await must(db.from("work_artists").insert({
  id: WORK_RELATION_ID,
  work_id: WORK_ID,
  artist_id: ARTIST_ID,
  role: "artist",
  source: "manual",
  source_url: "https://github.com/keianduu/muuzee",
  source_record_id: SOURCE_RECORD_ID,
  visibility_status: "public",
  visibility_overridden: true,
}), "Insert fixture Work relation");

await must(db.from("exhibition_artists").insert(EXTRA_EXHIBITIONS.map((exhibition, index) => ({
  id: `32550000-0000-4325-8325-00000000002${index + 2}`,
  exhibition_id: exhibition.id,
  artist_id: ARTIST_ID,
  role: index ? "featured artist" : "artist",
  source_artist_name: "LOCAL Artist Detail Review",
  match_status: "matched",
  relation_status: "active",
  source_record_id: SOURCE_RECORD_ID,
}))), "Insert fixture extra Exhibition relations");

await must(db.from("work_artists").insert(EXTRA_WORKS.map((work, index) => ({
  id: `32550000-0000-4325-8325-00000000002${index + 4}`,
  work_id: work.id,
  artist_id: ARTIST_ID,
  role: index ? "collaborating artist" : "artist",
  source: "manual",
  source_url: "https://github.com/keianduu/muuzee",
  source_record_id: SOURCE_RECORD_ID,
  visibility_status: "public",
  visibility_overridden: true,
}))), "Insert fixture extra Work relations");

console.log(JSON.stringify({
  action: "seed",
  artistId: ARTIST_ID,
  artistName: "LOCAL Artist Detail Review",
  registeredMediaCount: 0,
  usableCandidateCount: 2,
  exhibitionRelationCount: 3,
  workRelationCount: 3,
  openPath: `/admin/artists?selected=${ARTIST_ID}`,
  cleanup: "npm run db:cleanup:admin-artist-detail-local",
}, null, 2));
