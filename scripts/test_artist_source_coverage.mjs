import { createClient } from "@supabase/supabase-js";
import * as cheerio from "cheerio";

const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const { data: artists, error } = await db.from("artists").select("id,name,name_en,aliases,nationality_country_code,birth_year,death_year,birth_place,effective_priority_tier").in("effective_priority_tier", ["A", "B"]).order("effective_priority_tier").order("name");
if (error) throw error;

const fetchText = async (url) => { const response = await fetch(url, { headers: { "User-Agent": "MuuzeeLocalArtistCoverage/0.1 (research; https://github.com/keianduu/muuzee)" } }); if (!response.ok) throw new Error(`${response.status} ${url}`); return response.text(); };
async function apjMatch(artist) {
  const search = new URL("https://artplatform.go.jp/ja/artists");
  search.searchParams.set("name", artist.name);
  const html = await fetchText(search);
  const $ = cheerio.load(html);
  const results = $(".search-columns-list .item").map((_, element) => {
    const node = $(element);
    const href = node.find('a[href*="/artists/A"]').attr("href") || "";
    return {
      id: href.match(/\/artists\/(A\d+)/)?.[1] || null,
      nameJa: node.find(".name-ja").text().trim(),
      nameEn: node.find(".name-en").text().trim(),
      years: node.find(".years").text().trim(),
    };
  }).get().filter((row) => row.id);
  const exact = results.filter((row) => row.nameJa === artist.name);
  if (exact.length !== 1) return { matched: false, ambiguous: exact.length > 1, id: null, fields: {} };

  const row = exact[0];
  const detailHtml = await fetchText(`https://artplatform.go.jp/ja/artists/${row.id}`);
  const detail = cheerio.load(detailHtml);
  const pairs = new Map();
  detail("dl").first().find("dt").each((_, element) => {
    const label = detail(element).text().replace(/\s+/g, " ").trim();
    const value = detail(element).next("dd").text().replace(/\s+/g, " ").trim();
    pairs.set(label, value);
  });
  const names = pairs.get("作家名") || "";
  return { matched: true, ambiguous: false, id: row.id, fields: {
    japaneseName: Boolean(row.nameJa),
    englishName: Boolean(row.nameEn),
    reading: /transliterated hiragana/i.test(names),
    birth: Boolean(pairs.get("生年月日/結成年月日")),
    death: Boolean(pairs.get("没年月日/解散年月日")),
    birthPlace: Boolean(pairs.get("生地/結成地")),
    field: Boolean(pairs.get("活動領域")),
    biographySource: detail("cite").length > 0,
    artistId: true,
  } };
}

async function gettyMatch(artist) {
  const queryName = artist.name_en || artist.name;
  const search = new URL("https://www.getty.edu/vow/ULANServlet");
  Object.entries({ english: "Y", find: `"${queryName}"`, role: "", nation: "", page: "1" }).forEach(([key, value]) => search.searchParams.set(key, value));
  const searchHtml = await fetchText(search);
  const ids = [...new Set([...searchHtml.matchAll(/ULANFullDisplay\?[^"']*subjectid=(\d+)/g)].map((match) => match[1]))];
  if (ids.length !== 1) return { matched: false, ambiguous: ids.length > 1, id: null, fields: {} };
  const full = new URL("https://www.getty.edu/vow/ULANFullDisplay");
  Object.entries({ find: queryName, role: "", nation: "", page: "1", subjectid: ids[0] }).forEach(([key, value]) => full.searchParams.set(key, value));
  const html = await fetchText(full); const $ = cheerio.load(html); const text = $.text().replace(/\s+/g, " ");
  const namesBlock = text.match(/Names:(.*?)Nationalities:/)?.[1] || "";
  const headline = text.match(/Full Record Display\s+([^\n]+?)\s+Note:/)?.[1] || text;
  return { matched: true, ambiguous: false, id: ids[0], fields: {
    preferredName: /preferred/i.test(namesBlock), aliases: (namesBlock.match(/\bdisplay\b/gi) || []).length > 1 || /Additional Names:/i.test(text), nationality: /Nationalities:/i.test(text), role: /Roles:/i.test(text), birth: /\b(?:born|birth)\b/i.test(headline + text), death: /\b(?:died|death)\b/i.test(headline + text), birthPlace: /Born:\s*\S/i.test(text), deathPlace: /Died:\s*\S/i.test(text), authorityId: true,
  } };
}

const getty = [];
for (let index = 0; index < artists.length; index += 4) {
  const batch = artists.slice(index, index + 4);
  getty.push(...await Promise.all(batch.map(async (artist) => { try { return { artist, ...(await gettyMatch(artist)) }; } catch (cause) { return { artist, matched: false, ambiguous: false, id: null, fields: {}, error: cause instanceof Error ? cause.message : "failed" }; } })));
}
// A conservative Japanese-artist denominator: only explicit JP nationality.
// Missing nationality is not guessed from name or birthplace.
const japaneseArtists = artists.filter((artist) => artist.nationality_country_code === "JP");
const apj = [];
for (let index = 0; index < japaneseArtists.length; index += 3) {
  const batch = japaneseArtists.slice(index, index + 3);
  apj.push(...await Promise.all(batch.map(async (artist) => { try { return { artist, ...(await apjMatch(artist)) }; } catch (cause) { return { artist, matched: false, ambiguous: false, id: null, fields: {}, error: cause instanceof Error ? cause.message : "failed" }; } })));
}
const fieldCounts = Object.fromEntries(["preferredName", "aliases", "nationality", "role", "birth", "death", "birthPlace", "deathPlace", "authorityId"].map((field) => [field, getty.filter((row) => row.matched && row.fields[field]).length]));
const apjFieldCounts = Object.fromEntries(["japaneseName", "englishName", "reading", "birth", "death", "birthPlace", "field", "biographySource", "artistId"].map((field) => [field, apj.filter((row) => row.matched && row.fields[field]).length]));
const result = {
  testedAt: new Date().toISOString(), sample: "LOCAL Artist Tier A+B", sampleSize: artists.length,
  getty: { matched: getty.filter((row) => row.matched).length, ambiguous: getty.filter((row) => row.ambiguous).length, errors: getty.filter((row) => row.error).length, fieldCounts, rows: getty.map((row) => ({ name: row.artist.name, nameEn: row.artist.name_en, ulanId: row.id, matched: row.matched, ambiguous: row.ambiguous, fields: row.fields, error: row.error || null })) },
  apj: { sample: "LOCAL Artist Tier A+B with explicit JP nationality", sampleSize: japaneseArtists.length, matched: apj.filter((row) => row.matched).length, ambiguous: apj.filter((row) => row.ambiguous).length, errors: apj.filter((row) => row.error).length, fieldCounts: apjFieldCounts, rows: apj.map((row) => ({ name: row.artist.name, nameEn: row.artist.name_en, apjId: row.id, matched: row.matched, ambiguous: row.ambiguous, fields: row.fields, error: row.error || null })) },
};
console.log(JSON.stringify(result, null, 2));
