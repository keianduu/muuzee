import { claimValue, claimValues, getWikidataRawEntities, wikidataEntityId, type WikidataRawEntity } from "./client";
import type { DiscoveredWikidataArtist, WikidataArtist } from "./artist-types";

type LookupEntity = WikidataRawEntity;
export type ArtistReferenceEntityCache = Map<string, WikidataRawEntity>;
export type ArtistProviderRecordError = {
  qid: string;
  message: string;
  terminal: true;
};

export const ARTIST_REFERENCE_CACHE_MAX_ENTRIES = 500;

function ids(entity: WikidataRawEntity, property: string) {
  return claimValues(entity, property).map(wikidataEntityId).filter((value): value is string => Boolean(value));
}

function time(entity: WikidataRawEntity, property: string) {
  const value = claimValue(entity, property) as { time?: string; precision?: number } | undefined;
  if (!value?.time) return { date: null, year: null };
  const match = value.time.match(/^([+-])(\d+)-(\d{2})-(\d{2})T/);
  if (!match) return { date: null, year: null };
  const year = Number(match[2]) * (match[1] === "-" ? -1 : 1);
  const date = value.precision && value.precision >= 11 && year >= 1 && year <= 9999 ? `${String(year).padStart(4, "0")}-${match[3]}-${match[4]}` : null;
  return { date, year };
}

function label(entity: LookupEntity | undefined) { return entity?.labels?.ja?.value || entity?.labels?.en?.value || null; }
function iso(entity: LookupEntity | undefined) {
  const value = claimValue(entity || {}, "P297");
  return typeof value === "string" && /^[A-Z]{2}$/.test(value) ? value : null;
}

export function normalizeArtistEntity(qid: string, entity: WikidataRawEntity, lookup: Record<string, LookupEntity>): WikidataArtist | null {
  const nameEn = entity.labels?.en?.value || null;
  const name = entity.labels?.ja?.value || nameEn;
  if (!name) return null;
  const citizenship = ids(entity, "P27");
  const birthPlaceQid = ids(entity, "P19")[0] || null;
  const birthPlaceEntity = birthPlaceQid ? lookup[birthPlaceQid] : undefined;
  const birthCountryQid = birthPlaceEntity ? ids(birthPlaceEntity, "P17")[0] : null;
  const birth = time(entity, "P569"); const death = time(entity, "P570");
  const classifications = (property: string) => ids(entity, property).map((id) => ({ qid: id, label: label(lookup[id]) }));
  const website = claimValue(entity, "P856"); const image = claimValue(entity, "P18"); const category = claimValue(entity, "P373");
  return {
    qid, name, nameEn, nameNative: null,
    aliases: [...new Set([...(entity.aliases?.ja || []), ...(entity.aliases?.en || [])].map((item) => item.value).filter((value) => value !== name && value !== nameEn))],
    birthDate: birth.date, birthYear: birth.year, deathDate: death.date, deathYear: death.year,
    nationalityCountryCode: citizenship.length === 1 ? iso(lookup[citizenship[0]]) : null,
    nationalityQids: citizenship,
    birthCountryCode: birthCountryQid ? iso(lookup[birthCountryQid]) : null,
    birthPlace: label(birthPlaceEntity),
    occupation: classifications("P106"), fieldOfWork: classifications("P101"), movement: classifications("P135"),
    imageFileTitle: typeof image === "string" ? image : null,
    commonsCategory: typeof category === "string" ? category : null,
    wikipediaArticleTitle: entity.sitelinks?.jawiki?.title || entity.sitelinks?.enwiki?.title || null,
    wikipediaLanguage: entity.sitelinks?.jawiki?.title ? "ja" : entity.sitelinks?.enwiki?.title ? "en" : null,
    officialUrl: typeof website === "string" ? website : null,
    raw: entity,
  };
}

async function fetchIntoCache(
  idsToLoad: string[],
  cache: ArtistReferenceEntityCache,
  fetchEntities: typeof getWikidataRawEntities,
) {
  const missing = [...new Set(idsToLoad)].filter((qid) => !cache.has(qid));
  for (let start = 0; start < missing.length; start += 50) {
    const entities = await fetchEntities(missing.slice(start, start + 50));
    for (const [qid, entity] of Object.entries(entities)) cache.set(qid, entity);
  }
}

function trimReferenceCache(
  cache: ArtistReferenceEntityCache,
  requestedArtistQids: Set<string>,
) {
  for (const qid of requestedArtistQids) cache.delete(qid);
  while (cache.size > ARTIST_REFERENCE_CACHE_MAX_ENTRIES) {
    const oldest = cache.keys().next().value as string | undefined;
    if (!oldest) break;
    cache.delete(oldest);
  }
}

export async function fetchNormalizedArtists(
  discovered: DiscoveredWikidataArtist[],
  options: {
    cache?: ArtistReferenceEntityCache;
    fetchEntities?: typeof getWikidataRawEntities;
  } = {},
) {
  const cache = options.cache ?? new Map<string, WikidataRawEntity>();
  const fetchEntities = options.fetchEntities ?? getWikidataRawEntities;
  await fetchIntoCache(discovered.map((item) => item.qid), cache, fetchEntities);
  const missingRequested = discovered
    .map((item) => item.qid)
    .filter((qid) => !cache.has(qid));
  if (missingRequested.length) {
    throw new Error(`Wikidata entity response omitted requested Artist IDs: ${missingRequested.join(", ")}`);
  }
  const entities: Record<string, WikidataRawEntity> = {};
  for (const item of discovered) {
    const entity = cache.get(item.qid);
    if (entity) entities[item.qid] = entity;
  }
  const referenced = new Set<string>();
  for (const entity of Object.values(entities)) for (const property of ["P27", "P19", "P106", "P101", "P135"]) ids(entity, property).forEach((id) => referenced.add(id));
  await fetchIntoCache([...referenced], cache, fetchEntities);
  const lookup: Record<string, WikidataRawEntity> = {};
  const refs = [...referenced];
  for (const qid of refs) {
    const entity = cache.get(qid);
    if (entity) lookup[qid] = entity;
  }
  const birthCountries = new Set<string>();
  for (const qid of refs) ids(lookup[qid] || {}, "P17").forEach((id) => birthCountries.add(id));
  await fetchIntoCache([...birthCountries], cache, fetchEntities);
  for (const qid of birthCountries) {
    const entity = cache.get(qid);
    if (entity) lookup[qid] = entity;
  }
  const artists: WikidataArtist[] = []; const errors: ArtistProviderRecordError[] = [];
  for (const item of discovered) { const artist = entities[item.qid] && normalizeArtistEntity(item.qid, entities[item.qid], lookup); if (artist) artists.push(artist); else errors.push({ qid: item.qid, message: "Artist has no usable label", terminal: true }); }
  trimReferenceCache(cache, new Set(discovered.map((item) => item.qid)));
  return { artists, errors, cache };
}
