import type { WikidataVenueCandidate } from "./types";
import type { WikidataVenue } from "./venue-import-types";
import { mapWikidataVenueType } from "./venue-type-mapper";

type Claim = { mainsnak?: { datavalue?: { value?: unknown } } };
type RawEntity = { claims?: Record<string, Claim[]> };

function claimValues(raw: unknown, property: string) {
  return (((raw as RawEntity | null)?.claims?.[property] || []).map((claim) => claim.mainsnak?.datavalue?.value).filter((value) => value != null));
}
function firstString(raw: unknown, property: string) {
  const value = claimValues(raw, property)[0]; return typeof value === "string" ? value : null;
}
function entityIds(raw: unknown, property: string) {
  return claimValues(raw, property).flatMap((value) => value && typeof value === "object" && "id" in value ? [String((value as { id: unknown }).id)] : []);
}
function monolingualText(raw: unknown, property: string) {
  const value = claimValues(raw, property)[0];
  return value && typeof value === "object" && "text" in value ? String((value as { text: unknown }).text) : null;
}
function yearFromTime(raw: unknown, property: string) {
  const value = claimValues(raw, property)[0];
  if (!value || typeof value !== "object" || !("time" in value)) return null;
  const match = String((value as { time: unknown }).time).match(/^([+-]\d{4,})-/);
  return match ? Number(match[1]) : null;
}

export function mapWikidataVenue(
  candidate: WikidataVenueCandidate,
  discoveryRootIds: string[],
  labelsByQid: Map<string, string> = new Map(),
): WikidataVenue | null {
  const name = candidate.labelJa || candidate.labelEn;
  if (!name || candidate.countryId !== "Q17") return null;
  const instanceOfIds = entityIds(candidate.raw, "P31");
  const administrativeAreaId = entityIds(candidate.raw, "P131")[0] || null;
  const address = monolingualText(candidate.raw, "P6375");
  return {
    qid: candidate.id,
    name,
    nameEn: candidate.labelEn,
    aliases: [...new Set(candidate.aliases)].filter((alias) => alias !== name && alias !== candidate.labelEn),
    venueType: mapWikidataVenueType({ instanceOfIds, discoveryRootIds }),
    rawTypeIds: instanceOfIds,
    discoveryRootIds,
    countryCode: "JP",
    administrativeAreaId,
    region: administrativeAreaId ? labelsByQid.get(administrativeAreaId) || null : null,
    city: null,
    address,
    postalCode: firstString(candidate.raw, "P281"),
    latitude: candidate.latitude,
    longitude: candidate.longitude,
    officialUrl: candidate.officialUrl,
    imageFileTitle: candidate.imageFileTitle,
    commonsCategory: firstString(candidate.raw, "P373"),
    inceptionYear: yearFromTime(candidate.raw, "P1619") ?? yearFromTime(candidate.raw, "P571"),
    openingHours: firstString(candidate.raw, "P3025"),
    description: candidate.description,
    raw: candidate.raw,
  };
}
