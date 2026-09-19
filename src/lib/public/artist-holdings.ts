import { cache } from "react";
import { createSupabaseAdminClient, hasSupabaseAdminEnvironment } from "@/lib/supabase/admin";

type RawHolding = {
  id: string;
  work_id: string;
  visibility_status: string;
  venues?: { id: string; slug: string; name: string; publication_status: string; is_active: boolean } | Array<{ id: string; slug: string; name: string; publication_status: string; is_active: boolean }> | null;
};

export type RawArtistWorkRelation = {
  work_id: string;
  visibility_status: string;
  works?: { id: string; collection_holdings?: RawHolding[] | null } | Array<{ id: string; collection_holdings?: RawHolding[] | null }> | null;
};

export type PublicArtistHoldingDTO = {
  venueId: string;
  venueSlug: string;
  venueName: string;
  workCount: number;
};

function first<T>(value: T | T[] | null | undefined): T | null {
  return Array.isArray(value) ? value[0] ?? null : value ?? null;
}

export function composePublicArtistHoldings(relations: RawArtistWorkRelation[]): PublicArtistHoldingDTO[] {
  const venues = new Map<string, PublicArtistHoldingDTO & { workIds: Set<string> }>();
  for (const relation of relations) {
    if (relation.visibility_status !== "public") continue;
    const work = first(relation.works);
    if (!work) continue;
    for (const holding of work.collection_holdings || []) {
      if (holding.visibility_status !== "public") continue;
      const venue = first(holding.venues);
      if (!venue || venue.publication_status !== "published" || !venue.is_active) continue;
      const current = venues.get(venue.id) || { venueId: venue.id, venueSlug: venue.slug, venueName: venue.name, workCount: 0, workIds: new Set<string>() };
      current.workIds.add(work.id);
      current.workCount = current.workIds.size;
      venues.set(venue.id, current);
    }
  }
  return [...venues.values()].map((row) => ({
    venueId: row.venueId,
    venueSlug: row.venueSlug,
    venueName: row.venueName,
    workCount: row.workCount,
  })).sort((a, b) => a.venueName.localeCompare(b.venueName, "ja"));
}

export const getPublicArtistHoldings = cache(async (artistId: string): Promise<PublicArtistHoldingDTO[]> => {
  if (!hasSupabaseAdminEnvironment()) return [];
  const { data, error } = await createSupabaseAdminClient()
    .from("work_artists")
    .select("work_id,visibility_status,works!inner(id,collection_holdings!inner(id,work_id,visibility_status,venues!inner(id,slug,name,publication_status,is_active)))")
    .eq("artist_id", artistId)
    .eq("visibility_status", "public")
    .eq("works.collection_holdings.visibility_status", "public")
    .eq("works.collection_holdings.venues.publication_status", "published")
    .eq("works.collection_holdings.venues.is_active", true);
  if (error) throw error;
  return composePublicArtistHoldings((data || []) as unknown as RawArtistWorkRelation[]);
});
