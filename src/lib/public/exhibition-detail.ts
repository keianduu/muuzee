import { cache } from "react";
import { createSupabaseAdminClient, hasSupabaseAdminEnvironment } from "@/lib/supabase/admin";

const MEDIA_BUCKET = "exhibition-images";
const SIGNED_URL_TTL_SECONDS = 60 * 60;

export type PublicMediaDTO = {
  url: string;
  credit: string | null;
};

export type PublicVenueSummaryDTO = {
  id: string;
  slug: string;
  name: string;
  nameEn: string | null;
  venueType: string;
  address: string | null;
  prefecture: string | null;
  city: string | null;
  countryCode: string | null;
  latitude: number | null;
  longitude: number | null;
};

export type PublicExhibitionOccurrenceDTO = {
  id: string;
  startDate: string | null;
  endDate: string | null;
  openingHours: string | null;
  closedDays: string | null;
  ticketUrl: string | null;
  venue: PublicVenueSummaryDTO;
};

export type PublicArtistSummaryDTO = {
  id: string;
  slug: string;
  name: string;
  nameEn: string | null;
  nationalityCountryCode: string | null;
  role: string | null;
  image: PublicMediaDTO | null;
};

export type PublicTagDTO = {
  id: string;
  type: string;
  name: string;
  slug: string;
};

export type ExhibitionDetailDTO = {
  id: string;
  slug: string;
  title: string;
  titleEn: string | null;
  description: string | null;
  exhibitionType: string | null;
  officialUrl: string | null;
  hero: PublicMediaDTO | null;
  occurrences: PublicExhibitionOccurrenceDTO[];
  artists: PublicArtistSummaryDTO[];
  tags: PublicTagDTO[];
};

type RawMedia = {
  id: string;
  storage_path: string;
  credit: string | null;
  rights_status: string;
  valid_until: string | null;
  is_primary: boolean;
};

type RawVenue = {
  id: string;
  slug: string;
  name: string;
  name_en: string | null;
  venue_type: string;
  address: string | null;
  prefecture: string | null;
  city: string | null;
  country_code: string | null;
  latitude: number | null;
  longitude: number | null;
  publication_status: string;
  is_active: boolean;
};

type RawOccurrence = {
  id: string;
  start_date: string | null;
  end_date: string | null;
  opening_hours_text: string | null;
  closed_days_text: string | null;
  ticket_url: string | null;
  relation_status: string | null;
  venues?: RawVenue | RawVenue[] | null;
};

type RawArtist = {
  id: string;
  slug: string;
  name: string;
  name_en: string | null;
  nationality_country_code: string | null;
  publication_status: string;
  media_assets?: RawMedia[] | null;
};

type RawExhibitionArtist = {
  id: string;
  role: string | null;
  sort_order: number | null;
  relation_status: string | null;
  artists?: RawArtist | RawArtist[] | null;
};

type RawTag = {
  id: string;
  type: string;
  name: string;
  slug: string;
};

type RawExhibitionTag = {
  tags?: RawTag | RawTag[] | null;
};

export type RawPublicExhibition = {
  id: string;
  slug: string;
  title: string;
  title_en: string | null;
  description: string | null;
  exhibition_type: string | null;
  official_url: string | null;
  publication_status: string;
  exhibition_occurrences?: RawOccurrence[] | null;
  exhibition_artists?: RawExhibitionArtist[] | null;
  media_assets?: RawMedia[] | null;
  exhibition_tags?: RawExhibitionTag[] | null;
};

type MediaUrlResolver = (storagePath: string) => Promise<string | null>;

function first<T>(value: T | T[] | null | undefined): T | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}

function usablePrimaryMedia(media: RawMedia[] | null | undefined, today: string) {
  return (media ?? []).find((item) => {
    if (!item.is_primary || item.rights_status !== "approved") return false;
    return !item.valid_until || item.valid_until >= today;
  }) ?? null;
}

async function mediaDTO(media: RawMedia[] | null | undefined, today: string, resolveUrl: MediaUrlResolver) {
  const selected = usablePrimaryMedia(media, today);
  if (!selected) return null;
  const url = await resolveUrl(selected.storage_path);
  return url ? { url, credit: selected.credit } : null;
}

function compareNullableDates(a: string | null, b: string | null) {
  if (a && b) return a.localeCompare(b);
  if (a) return -1;
  if (b) return 1;
  return 0;
}

export async function composeExhibitionDetail(
  row: RawPublicExhibition,
  resolveUrl: MediaUrlResolver,
  today = new Date().toISOString().slice(0, 10),
): Promise<ExhibitionDetailDTO> {
  const occurrences = (row.exhibition_occurrences ?? [])
    .filter((item) => item.relation_status !== "stale")
    .map((item) => ({ item, venue: first(item.venues) }))
    .filter((entry): entry is { item: RawOccurrence; venue: RawVenue } => Boolean(
      entry.venue && entry.venue.publication_status === "published" && entry.venue.is_active,
    ))
    .sort((a, b) => compareNullableDates(a.item.start_date, b.item.start_date))
    .map(({ item, venue }) => ({
      id: item.id,
      startDate: item.start_date,
      endDate: item.end_date,
      openingHours: item.opening_hours_text,
      closedDays: item.closed_days_text,
      ticketUrl: item.ticket_url,
      venue: {
        id: venue.id,
        slug: venue.slug,
        name: venue.name,
        nameEn: venue.name_en,
        venueType: venue.venue_type,
        address: venue.address,
        prefecture: venue.prefecture,
        city: venue.city,
        countryCode: venue.country_code,
        latitude: venue.latitude,
        longitude: venue.longitude,
      },
    }));

  const artistRows = (row.exhibition_artists ?? [])
    .filter((relation) => relation.relation_status !== "stale")
    .map((relation) => ({ relation, artist: first(relation.artists) }))
    .filter((entry): entry is { relation: RawExhibitionArtist; artist: RawArtist } => Boolean(
      entry.artist && entry.artist.publication_status === "published",
    ))
    .sort((a, b) => (a.relation.sort_order ?? Number.MAX_SAFE_INTEGER) - (b.relation.sort_order ?? Number.MAX_SAFE_INTEGER));

  const artists = await Promise.all(artistRows.map(async ({ relation, artist }) => ({
    id: artist.id,
    slug: artist.slug,
    name: artist.name,
    nameEn: artist.name_en,
    nationalityCountryCode: artist.nationality_country_code,
    role: relation.role,
    image: await mediaDTO(artist.media_assets, today, resolveUrl),
  })));

  const tags = (row.exhibition_tags ?? [])
    .map((relation) => first(relation.tags))
    .filter((tag): tag is RawTag => Boolean(tag))
    .map((tag) => ({ id: tag.id, type: tag.type, name: tag.name, slug: tag.slug }));

  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    titleEn: row.title_en,
    description: row.description,
    exhibitionType: row.exhibition_type,
    officialUrl: row.official_url,
    hero: await mediaDTO(row.media_assets, today, resolveUrl),
    occurrences,
    artists,
    tags,
  };
}

async function readExhibitionDetail(slug: string): Promise<ExhibitionDetailDTO | null> {
  if (!hasSupabaseAdminEnvironment()) {
    throw new Error("Public data source is not configured.");
  }

  const db = createSupabaseAdminClient();
  const { data, error } = await db
    .from("exhibitions")
    .select(`
      id,
      slug,
      title,
      title_en,
      description,
      exhibition_type,
      official_url,
      publication_status,
      exhibition_occurrences(
        id,
        start_date,
        end_date,
        opening_hours_text,
        closed_days_text,
        ticket_url,
        relation_status,
        venues(
          id,
          slug,
          name,
          name_en,
          venue_type,
          address,
          prefecture,
          city,
          country_code,
          latitude,
          longitude,
          publication_status,
          is_active
        )
      ),
      exhibition_artists(
        id,
        role,
        sort_order,
        relation_status,
        artists(
          id,
          slug,
          name,
          name_en,
          nationality_country_code,
          publication_status,
          media_assets(id, storage_path, credit, rights_status, valid_until, is_primary)
        )
      ),
      media_assets(id, storage_path, credit, rights_status, valid_until, is_primary),
      exhibition_tags(tags(id, type, name, slug))
    `)
    .eq("slug", slug)
    .eq("publication_status", "published")
    .maybeSingle();

  if (error) throw new Error(`Failed to load public exhibition: ${error.message}`);
  if (!data) return null;

  const resolveUrl: MediaUrlResolver = async (storagePath) => {
    const { data: signed, error: signedError } = await db.storage
      .from(MEDIA_BUCKET)
      .createSignedUrl(storagePath, SIGNED_URL_TTL_SECONDS);
    return signedError ? null : signed?.signedUrl ?? null;
  };

  return composeExhibitionDetail(data as unknown as RawPublicExhibition, resolveUrl);
}

export const getPublicExhibitionDetail = cache(readExhibitionDetail);
