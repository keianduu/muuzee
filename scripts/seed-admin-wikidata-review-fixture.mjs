import { createClient } from "@supabase/supabase-js";

const VENUE_ID = "32500000-0000-4325-8325-000000000002";
const VENUE_SLUG = "order325-local-wikidata-review-venue";

function fail(message) { console.error(message); process.exit(1); }
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!supabaseUrl || !serviceRoleKey) fail("LOCAL Supabase environment is required.");
let parsedUrl;
try { parsedUrl = new URL(supabaseUrl); } catch { fail("NEXT_PUBLIC_SUPABASE_URL must be a valid LOCAL URL."); }
if (process.env.VERCEL || process.env.NODE_ENV === "production" || !["127.0.0.1", "localhost"].includes(parsedUrl.hostname)) fail("Refusing to modify a non-LOCAL Supabase project.");
const db = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false, autoRefreshToken: false } });
async function must(result, label) { const resolved = await result; if (resolved.error) fail(`${label}: ${resolved.error.message}`); return resolved.data; }

if (process.argv.includes("--cleanup")) {
  await must(db.from("venues").delete().eq("id", VENUE_ID), "Delete fixture Venue");
  console.log(JSON.stringify({ action: "cleanup", venueId: VENUE_ID }, null, 2));
  process.exit(0);
}

await must(db.from("venues").delete().eq("id", VENUE_ID), "Reset fixture Venue");
await must(db.from("venues").upsert({
  id: VENUE_ID, slug: VENUE_SLUG, name: "国立新美術館", name_en: "LOCAL Wikidata Review Venue",
  venue_type: "museum", country_code: "JP", postal_code: null, prefecture: "東京都", city: "港区",
  address: "東京都港区六本木7丁目22-2", normalized_name: "国立新美術館", normalized_address: "東京都港区六本木7丁目22-2",
  description: "Order 325のLOCAL Wikidata取得・照合QA専用fixtureです。Productionデータではありません。",
  publication_status: "draft", is_active: true, wikidata_match_status: "unmatched",
}, { onConflict: "id" }), "Upsert fixture Venue");

console.log(JSON.stringify({
  action: "seed", venueId: VENUE_ID, venueName: "LOCAL Wikidata Review Venue（国立新美術館）",
  expectedQid: "Q1362638", openPath: `/admin/venues?selected=${VENUE_ID}&venueEdit=data`,
  cleanup: "npm run db:cleanup:admin-wikidata-review-local",
}, null, 2));
