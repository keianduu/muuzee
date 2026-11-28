import { createHash } from "node:crypto";

export const ARTIST_SEED_SCOPE = "mvp-museum-exhibition-artists";
export const ARTIST_SEED_VERSION = "2026-11-28.1";
export const ARTIST_SEED_MAX = 1_000;

const EUROPEAN_NATIONALITIES = new Set([
  "Albanian", "Austrian", "Belgian", "British", "Bulgarian", "Croatian", "Czech",
  "Danish", "Dutch", "English", "Estonian", "Finnish", "French", "German", "Greek",
  "Hungarian", "Icelandic", "Irish", "Italian", "Latvian", "Lithuanian", "Luxembourgish",
  "Macedonian", "Moldovan", "Norwegian", "Polish", "Portuguese", "Romanian", "Russian",
  "Scottish", "Serbian", "Slovak", "Slovenian", "Spanish", "Swedish", "Swiss", "Ukrainian",
  "Welsh", "Yugoslav",
]);
const NORTH_AMERICAN_NATIONALITIES = new Set(["American", "Canadian", "Mexican"]);

export function parseCsv(text) {
  const rows = [];
  let row = [];
  let value = "";
  let quoted = false;
  for (let index = 0; index < text.length; index += 1) {
    const character = text[index];
    if (quoted) {
      if (character === '"' && text[index + 1] === '"') {
        value += '"';
        index += 1;
      } else if (character === '"') {
        quoted = false;
      } else {
        value += character;
      }
    } else if (character === '"') {
      quoted = true;
    } else if (character === ",") {
      row.push(value);
      value = "";
    } else if (character === "\n") {
      row.push(value.replace(/\r$/, ""));
      rows.push(row);
      row = [];
      value = "";
    } else {
      value += character;
    }
  }
  if (value || row.length) {
    row.push(value.replace(/\r$/, ""));
    rows.push(row);
  }
  const [headers, ...records] = rows;
  if (!headers?.length) return [];
  return records
    .filter((record) => record.some(Boolean))
    .map((record) => Object.fromEntries(headers.map((header, index) => [header, record[index] ?? ""])));
}

function normalized(value) {
  return String(value || "").normalize("NFKC").toLowerCase().replace(/[\s・._'’"“”\-–—:：()（）\[\]]+/g, "");
}

function yearFromRow(row) {
  return String(row.ExhibitionBeginDate || row.ExhibitionCitationDate || "").match(/\d{4}/)?.[0] || null;
}

function nationalityRegion(nationality) {
  if (nationality === "Japanese") return "japan";
  if (EUROPEAN_NATIONALITIES.has(nationality)) return "europe";
  if (NORTH_AMERICAN_NATIONALITIES.has(nationality)) return "north_america";
  return "global_other";
}

function evidenceKey(evidence) {
  const tourIdentity = evidence.tourRootId || evidence.sourceExhibitionId;
  return `${evidence.source}:${tourIdentity || normalized(evidence.title)}:${evidence.year || "unknown"}`;
}

export function buildMomaArtistCandidates(rows) {
  const artistCountByExhibition = new Map();
  for (const row of rows) {
    if (String(row.ExhibitionRole || "").trim() !== "Artist") continue;
    const qid = String(row.WikidataID || "").trim();
    if (!/^Q\d+$/.test(qid)) continue;
    const set = artistCountByExhibition.get(row.ExhibitionID) || new Set();
    set.add(qid);
    artistCountByExhibition.set(row.ExhibitionID, set);
  }

  const artists = new Map();
  for (const row of rows) {
    if (String(row.ExhibitionRole || "").trim() !== "Artist") continue;
    const qid = String(row.WikidataID || "").trim();
    if (!/^Q\d+$/.test(qid)) continue;
    const artist = artists.get(qid) || {
      qid,
      name: String(row.DisplayName || "").trim(),
      nameEn: String(row.DisplayName || "").trim(),
      nationality: String(row.Nationality || "").trim() || null,
      viafId: String(row.VIAFID || "").trim() || null,
      ulanId: String(row.ULANID || "").trim() || null,
      evidence: new Map(),
    };
    const evidence = {
      source: "moma-exhibition-history",
      sourceExhibitionId: String(row.ExhibitionID || "").trim(),
      tourRootId: null,
      title: String(row.ExhibitionTitle || "").trim(),
      year: yearFromRow(row),
      museum: "The Museum of Modern Art",
      region: "north_america",
      role: "Artist",
      url: String(row.ExhibitionURL || "").trim() || null,
      solo: (artistCountByExhibition.get(row.ExhibitionID)?.size || 0) === 1,
    };
    artist.evidence.set(evidenceKey(evidence), evidence);
    artists.set(qid, artist);
  }
  return [...artists.values()].filter((artist) => artist.evidence.size >= 2);
}

export function mergeApjEvidence(candidates, augmentations) {
  const byQid = new Map(candidates.map((candidate) => [candidate.qid, candidate]));
  for (const augmentation of augmentations || []) {
    const artist = byQid.get(augmentation.qid);
    if (!artist || augmentation.identityStatus !== "qid_confirmed") continue;
    for (const row of augmentation.exhibitions || []) {
      const evidence = {
        source: "art-platform-japan",
        sourceExhibitionId: row.id,
        tourRootId: row.tourStartExhibitionID || row.id,
        title: row.titleJa || row.titleEn,
        year: row.year || null,
        museum: row.venueJa || row.venueEn,
        region: row.region || "japan",
        role: "Artist",
        url: `https://artplatform.go.jp/ja/exhibitions/${row.id}`,
        solo: Boolean(row.solo),
      };
      artist.evidence.set(evidenceKey(evidence), evidence);
    }
    artist.apjArtistId = augmentation.apjArtistId;
  }
  return candidates;
}

function candidateScore(candidate) {
  const evidence = [...candidate.evidence.values()];
  const exhibitionCount = evidence.length;
  const soloCount = evidence.filter((item) => item.solo).length;
  const museums = new Set(evidence.map((item) => item.museum).filter(Boolean));
  const sources = new Set(evidence.map((item) => item.source));
  const regions = new Set(evidence.map((item) => item.region));
  const region = nationalityRegion(candidate.nationality);
  return Math.min(exhibitionCount, 100) * 10
    + Math.min(soloCount, 10) * 25
    + Math.min(museums.size, 10) * 8
    + (sources.size > 1 ? 120 : 0)
    + (regions.has("japan") ? 120 : 0)
    + (region === "japan" ? 80 : region === "europe" ? 40 : region === "north_america" ? 20 : 0);
}

function sorted(candidates) {
  return [...candidates].sort((left, right) =>
    candidateScore(right) - candidateScore(left)
      || right.evidence.size - left.evidence.size
      || left.qid.localeCompare(right.qid, "en", { numeric: true }),
  );
}

export function selectArtistSeedCandidates(candidates, maxArtists = ARTIST_SEED_MAX) {
  const target = Math.max(1, Math.min(ARTIST_SEED_MAX, Math.floor(maxArtists)));
  const selected = new Map();
  const take = (pool, count) => {
    for (const candidate of sorted(pool)) {
      if (selected.size >= target || count <= 0) break;
      if (selected.has(candidate.qid)) continue;
      selected.set(candidate.qid, candidate);
      count -= 1;
    }
  };
  take(candidates.filter((candidate) => nationalityRegion(candidate.nationality) === "japan"), Math.min(100, target));
  take(candidates.filter((candidate) => nationalityRegion(candidate.nationality) === "europe"), Math.min(300, Math.max(0, target - selected.size)));
  take(candidates.filter((candidate) => nationalityRegion(candidate.nationality) === "north_america"), Math.min(450, Math.max(0, target - selected.size)));
  take(candidates, target - selected.size);
  return sorted([...selected.values()]).slice(0, target);
}

function manifestArtist(candidate, rank, wikidata = {}) {
  const evidence = [...candidate.evidence.values()].sort((left, right) =>
    String(left.year || "").localeCompare(String(right.year || ""))
      || left.title.localeCompare(right.title),
  );
  const regions = [...new Set(evidence.map((item) => item.region).filter(Boolean))];
  const nationalityRegionValue = nationalityRegion(candidate.nationality);
  const genres = [...new Set([...(wikidata.fieldOfWork || []), ...(wikidata.occupations || [])].filter(Boolean))].slice(0, 12);
  const museums = [...new Set(evidence.map((item) => item.museum).filter(Boolean))].sort();
  const sources = [...new Set(evidence.map((item) => item.source))].sort();
  const selectionReasons = [
    `${evidence.length} distinct documented museum exhibitions`,
    evidence.some((item) => item.solo) ? "documented solo exhibition evidence" : null,
    sources.length > 1 ? "independently documented by multiple approved sources" : null,
    regions.includes("japan") ? "documented Japan exhibition connection" : null,
    nationalityRegionValue === "japan" ? "Japan-priority cohort" : `${nationalityRegionValue} coverage cohort`,
  ].filter(Boolean);
  return {
    rank,
    priorityScore: candidateScore(candidate),
    qid: candidate.qid,
    identityStatus: "qid_confirmed",
    name: wikidata.nameJa || candidate.name,
    nameEn: wikidata.nameEn || candidate.nameEn,
    nationality: candidate.nationality,
    activityRegions: [...new Set([nationalityRegionValue, ...regions])],
    exhibitionRegions: regions,
    genres: genres.length ? genres : ["visual art (museum exhibition evidence)"],
    verifiedExhibitionCount: evidence.length,
    soloOrRetrospective: evidence.some((item) => item.solo),
    museums,
    exhibitions: evidence.map(({ source, sourceExhibitionId, title, year, museum, region, url, solo }) => ({
      source, sourceExhibitionId, title, year, museum, region, url, solo,
    })),
    evidenceUrls: [...new Set(evidence.map((item) => item.url).filter(Boolean))],
    selectionReasons,
    identifiers: { viaf: candidate.viafId, ulan: candidate.ulanId, apj: candidate.apjArtistId || null },
  };
}

export function buildArtistSeedManifest(input) {
  const selected = selectArtistSeedCandidates(
    mergeApjEvidence(buildMomaArtistCandidates(input.momaRows), input.apjAugmentations || []),
    input.maxArtists,
  );
  const artists = selected.map((candidate, index) => manifestArtist(
    candidate,
    index + 1,
    input.wikidataMetadata?.[candidate.qid] || {},
  ));
  const sourcePayload = {
    schemaVersion: 1,
    scope: ARTIST_SEED_SCOPE,
    version: input.version || ARTIST_SEED_VERSION,
    criteria: {
      minimumDistinctMuseumExhibitions: 2,
      requiredRole: "Artist",
      maxArtists: Math.min(input.maxArtists || ARTIST_SEED_MAX, ARTIST_SEED_MAX),
      qidRequiredForInventory: true,
      touringExhibitionDeduplication: "source tour root; otherwise source exhibition ID",
    },
    ranking: {
      deterministic: true,
      factors: ["distinct exhibitions", "solo evidence", "distinct museums", "independent sources", "Japan exhibition connection"],
      cohortMinimums: { japan: 100, europe: 300, northAmerica: 450 },
      note: "Minimums apply only while eligible candidates exist; remaining positions use global score order.",
    },
    sources: input.sources,
    counts: {
      selected: artists.length,
      identityConfirmed: artists.filter((artist) => artist.identityStatus === "qid_confirmed").length,
      identityReview: artists.filter((artist) => artist.identityStatus !== "qid_confirmed").length,
      japanExhibitionConnection: artists.filter((artist) => artist.exhibitionRegions.includes("japan")).length,
      europeCoverageCohort: artists.filter((artist) => artist.activityRegions.includes("europe")).length,
      northAmericaExhibitionConnection: artists.filter((artist) => artist.exhibitionRegions.includes("north_america")).length,
    },
    artists,
  };
  const checksum = createHash("sha256").update(JSON.stringify(sourcePayload)).digest("hex");
  return { ...sourcePayload, checksum };
}
