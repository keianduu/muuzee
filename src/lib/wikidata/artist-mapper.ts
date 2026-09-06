import { claimValue, claimValues, getWikidataRawEntities, wikidataEntityId, type WikidataRawEntity } from "./client";
import type { DiscoveredWikidataArtist, WikidataArtist } from "./artist-types";

type LookupEntity = WikidataRawEntity;

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

export async function fetchNormalizedArtists(discovered: DiscoveredWikidataArtist[]) {
  const entities: Record<string, WikidataRawEntity> = {};
  for (let start = 0; start < discovered.length; start += 50) Object.assign(entities, await getWikidataRawEntities(discovered.slice(start, start + 50).map((item) => item.qid)));
  const referenced = new Set<string>();
  for (const entity of Object.values(entities)) for (const property of ["P27", "P19", "P106", "P101", "P135"]) ids(entity, property).forEach((id) => referenced.add(id));
  const lookup: Record<string, WikidataRawEntity> = {};
  const refs = [...referenced];
  for (let start = 0; start < refs.length; start += 50) Object.assign(lookup, await getWikidataRawEntities(refs.slice(start, start + 50)));
  const birthCountries = new Set<string>();
  for (const qid of refs) ids(lookup[qid] || {}, "P17").forEach((id) => birthCountries.add(id));
  const missingCountries = [...birthCountries].filter((id) => !lookup[id]);
  for (let start = 0; start < missingCountries.length; start += 50) Object.assign(lookup, await getWikidataRawEntities(missingCountries.slice(start, start + 50)));
  const artists: WikidataArtist[] = []; const errors: Array<{ qid: string; message: string }> = [];
  for (const item of discovered) { const artist = entities[item.qid] && normalizeArtistEntity(item.qid, entities[item.qid], lookup); if (artist) artists.push(artist); else errors.push({ qid: item.qid, message: "Artist has no usable label" }); }
  return { artists, errors };
}
