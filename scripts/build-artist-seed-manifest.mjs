#!/usr/bin/env node
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import {
  ARTIST_SEED_MAX,
  ARTIST_SEED_VERSION,
  buildArtistSeedManifest,
  buildMomaArtistCandidates,
  parseCsv,
} from "./lib/artist-seed-manifest.mjs";

const MOMA_URL = "https://raw.githubusercontent.com/MuseumofModernArt/exhibitions/5e1ce97416613068832255bdc4ddccc0fec7c508/MoMAExhibitions1929to1989.csv";
const APJ_GRAPHQL_URL = "https://api.artplatform.go.jp/graphql";
const APJ_LAST_UPDATED = "2026-07-14";
const OUTPUT = resolve("data/artist-acquisition/mvp-artist-seed-manifest.v1.json");
const APJ_SNAPSHOT = resolve("data/artist-acquisition/apj-japanese-exhibition-evidence.v1.json");

function flag(name) { return process.argv.includes(name); }
function option(name, fallback) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : fallback;
}
function sha256(value) { return createHash("sha256").update(value).digest("hex"); }
function sleep(ms) { return new Promise((resolvePromise) => setTimeout(resolvePromise, ms)); }

async function fetchText(url) {
  const response = await fetch(url, { headers: { "user-agent": "MuuzeeArtistSeedManifest/1.0 (+https://github.com/keianduu/muuzee)" } });
  if (!response.ok) throw new Error(`Source request failed (${response.status}) for ${url}`);
  return Buffer.from(await response.arrayBuffer());
}

async function graphql(query, variables) {
  const response = await fetch(APJ_GRAPHQL_URL, {
    method: "POST",
    headers: { "content-type": "application/json", "user-agent": "MuuzeeArtistSeedManifest/1.0 (+https://github.com/keianduu/muuzee)" },
    body: JSON.stringify({ query, variables }),
  });
  if (!response.ok) throw new Error(`APJ GraphQL request failed (${response.status})`);
  const body = await response.json();
  if (body.errors?.length) throw new Error(`APJ GraphQL response failed: ${body.errors[0]?.message || "unknown error"}`);
  return body.data;
}

const SEARCH_ARTISTS = `query SearchArtists($keyword:String,$limit:Int){searchArtists(keyword:$keyword,limit:$limit){items{id name{ja en} birthDate deathDate} total}}`;
const GET_ARTIST = `query GetArtist($id:ID!){getArtist(id:$id){id name{ja en} authority{wikiID}}}`;
const SEARCH_EXHIBITIONS = `query SearchExhibitionsDownloadData($filter:ExhibitionFilter,$limit:Int,$from:Int){searchExhibitions(filter:$filter,limit:$limit,from:$from){items{id venue{ja en} venueLocale{ja en} title{ja en} tourStartExhibitionID tourIndex artistClassification{artists{artistID label{ja en}}} period{ja en}} total}}`;

function year(value) { return String(value || "").match(/\d{4}/)?.[0] || null; }
function apjRegion(locale) {
  const value = `${locale?.ja || ""} ${locale?.en || ""}`;
  if (/日本|都|道|府|県|Japan/i.test(value)) return "japan";
  if (/Europe|Belg|France|Germany|Italy|Spain|Swiss|Austria|Netherlands|United Kingdom|England|欧州|ベルギ|フランス|ドイツ|イタリア|スペイン|スイス|オーストリア|オランダ|イギリス/i.test(value)) return "europe";
  if (/United States|Canada|Mexico|アメリカ|カナダ|メキシコ/i.test(value)) return "north_america";
  return "global_other";
}

async function fetchApjAugmentations(japaneseCandidates) {
  const rows = [];
  for (const candidate of japaneseCandidates) {
    const search = await graphql(SEARCH_ARTISTS, { keyword: candidate.name, limit: 10 });
    let matched = null;
    for (const item of search.searchArtists?.items || []) {
      const detail = await graphql(GET_ARTIST, { id: item.id });
      if (detail.getArtist?.authority?.wikiID === candidate.qid) {
        matched = detail.getArtist;
        break;
      }
      await sleep(80);
    }
    if (!matched) {
      rows.push({ qid: candidate.qid, identityStatus: "not_found", apjArtistId: null, exhibitions: [] });
      continue;
    }
    const result = await graphql(SEARCH_EXHIBITIONS, { filter: { artistID: matched.id }, limit: 500, from: 0 });
    const exhibitions = (result.searchExhibitions?.items || []).map((item) => {
      const artistCount = new Set((item.artistClassification || []).flatMap((group) => group.artists || []).map((artist) => artist.artistID || `${artist.label?.ja}:${artist.label?.en}`)).size;
      return {
        id: item.id,
        tourStartExhibitionID: item.tourStartExhibitionID || item.id,
        titleJa: item.title?.ja || null,
        titleEn: item.title?.en || null,
        year: year(item.period?.ja || item.period?.en),
        venueJa: item.venue?.ja || null,
        venueEn: item.venue?.en || null,
        region: apjRegion(item.venueLocale),
        solo: artistCount === 1,
      };
    });
    rows.push({ qid: candidate.qid, identityStatus: "qid_confirmed", apjArtistId: matched.id, exhibitions });
    await sleep(120);
  }
  return rows;
}

async function fetchWikidataEntities(qids) {
  const entities = {};
  for (let start = 0; start < qids.length; start += 50) {
    const ids = qids.slice(start, start + 50);
    const url = new URL("https://www.wikidata.org/w/api.php");
    for (const [key, value] of Object.entries({ action: "wbgetentities", ids: ids.join("|"), props: "labels|claims", languages: "ja|en", languagefallback: "1", format: "json", origin: "*" })) url.searchParams.set(key, value);
    const response = await fetch(url, { headers: { "user-agent": "MuuzeeArtistSeedManifest/1.0 (+https://github.com/keianduu/muuzee)" } });
    if (!response.ok) throw new Error(`Wikidata entity request failed (${response.status})`);
    const body = await response.json();
    if (!body.entities || typeof body.entities !== "object") throw new Error("Wikidata entity response schema is invalid");
    Object.assign(entities, body.entities);
    await sleep(100);
  }
  return entities;
}

function entityIds(entity, property) {
  return (entity?.claims?.[property] || []).map((claim) => claim?.mainsnak?.datavalue?.value?.id).filter((value) => /^Q\d+$/.test(value));
}

async function wikidataMetadata(qids) {
  const artists = await fetchWikidataEntities(qids);
  const referenceIds = [...new Set(Object.values(artists).flatMap((entity) => [...entityIds(entity, "P106"), ...entityIds(entity, "P101")]))];
  const references = await fetchWikidataEntities(referenceIds);
  return Object.fromEntries(qids.map((qid) => {
    const entity = artists[qid];
    const labels = (property) => entityIds(entity, property).map((id) => references[id]?.labels?.ja?.value || references[id]?.labels?.en?.value).filter(Boolean);
    return [qid, {
      nameJa: entity?.labels?.ja?.value || null,
      nameEn: entity?.labels?.en?.value || null,
      occupations: labels("P106"),
      fieldOfWork: labels("P101"),
    }];
  }));
}

async function readJson(path, fallback) {
  try { return JSON.parse(await readFile(path, "utf8")); } catch (error) {
    if (error?.code === "ENOENT") return fallback;
    throw error;
  }
}

async function main() {
  const maximum = Math.max(1, Math.min(ARTIST_SEED_MAX, Number(option("--max", ARTIST_SEED_MAX))));
  const momaPath = option("--moma-csv", null);
  const momaBuffer = momaPath ? await readFile(resolve(momaPath)) : await fetchText(MOMA_URL);
  const momaText = new TextDecoder("windows-1252").decode(momaBuffer);
  const momaRows = parseCsv(momaText);
  if (momaRows.length < 30_000) throw new Error("MoMA source row count is unexpectedly small");

  let apjAugmentations = (await readJson(APJ_SNAPSHOT, { artists: [] })).artists;
  if (flag("--refresh-apj")) {
    const japanese = buildMomaArtistCandidates(momaRows).filter((candidate) => candidate.nationality === "Japanese" && candidate.evidence.size >= 2);
    apjAugmentations = await fetchApjAugmentations(japanese);
    const snapshot = {
      schemaVersion: 1,
      source: "Art Platform Japan exhibitions and artist authority",
      sourceUrl: "https://artplatform.go.jp/ja/exhibitions",
      sourceLastUpdated: APJ_LAST_UPDATED,
      queryBoundary: "MoMA-eligible Japanese artists with confirmed Wikidata QID; exact APJ authority QID required",
      artists: apjAugmentations,
    };
    await mkdir(dirname(APJ_SNAPSHOT), { recursive: true });
    await writeFile(APJ_SNAPSHOT, `${JSON.stringify(snapshot, null, 2)}\n`);
  }

  const preliminary = buildArtistSeedManifest({
    momaRows,
    apjAugmentations,
    wikidataMetadata: {},
    maxArtists: maximum,
    version: ARTIST_SEED_VERSION,
    sources: [],
  });
  const metadata = await wikidataMetadata(preliminary.artists.map((artist) => artist.qid));
  const apjSnapshotText = await readFile(APJ_SNAPSHOT, "utf8").catch(() => "");
  const manifest = buildArtistSeedManifest({
    momaRows,
    apjAugmentations,
    wikidataMetadata: metadata,
    maxArtists: maximum,
    version: ARTIST_SEED_VERSION,
    sources: [
      {
        key: "moma-exhibition-history",
        url: "https://github.com/MuseumofModernArt/exhibitions",
        datasetUrl: MOMA_URL,
        version: "git:5e1ce97416613068832255bdc4ddccc0fec7c508",
        checksumSha256: sha256(momaBuffer),
        license: "CC0-1.0",
        coverage: "MoMA exhibitions 1929–1989; Artist role only",
      },
      {
        key: "art-platform-japan",
        url: "https://artplatform.go.jp/ja/exhibitions",
        version: `last-updated:${APJ_LAST_UPDATED}`,
        checksumSha256: sha256(apjSnapshotText),
        license: "APJ terms of use; derived bounded evidence with attribution",
        coverage: "QID-confirmed Japanese cohort only; no full-database reproduction",
      },
      {
        key: "wikidata-identity-metadata",
        url: "https://www.wikidata.org/w/api.php",
        version: "live entity labels/claims at manifest generation",
        license: "CC0-1.0",
        coverage: "Identity labels and genre descriptors after exhibition-led selection",
      },
    ],
  });
  await mkdir(dirname(OUTPUT), { recursive: true });
  await writeFile(OUTPUT, `${JSON.stringify(manifest, null, 2)}\n`);
  console.log(JSON.stringify({ path: OUTPUT, selected: manifest.counts.selected, checksum: manifest.checksum, counts: manifest.counts }));
}

await main();
