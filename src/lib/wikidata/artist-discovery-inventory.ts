import { createHash } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { WikidataArtist } from "./artist-types";
import {
  fetchNormalizedArtists,
  type ArtistReferenceEntityCache,
} from "./artist-mapper";

export const ARTIST_INVENTORY_BATCH_SIZES = [5, 20, 50, 100] as const;
export const RECOMMENDED_ARTIST_INVENTORY_BATCH_SIZE = 50;
export const ARTIST_INVENTORY_SETTLEMENT_CHUNK_SIZE = 5;

export type ArtistDiscoveryInventoryCandidate = {
  id: string;
  external_id: string;
  attempt_count: number;
};

export type ArtistInventorySettlement = {
  inventoryId: string;
  externalId: string;
  payload: ReturnType<typeof artistSourceEnvelope>;
  checksum: string;
};

export type ArtistInventoryInvalidSettlement = {
  inventoryId: string;
  externalId: string;
  reason: string;
};

function sanitizedError(error: unknown, fallback: string) {
  const message = error instanceof Error
    ? error.message
    : typeof error === "string"
      ? error
      : error && typeof error === "object" && "message" in error && typeof error.message === "string"
        ? error.message
      : fallback;
  return message.replace(/[\r\n\t]+/g, " ").slice(0, 500);
}

function rpcError(error: unknown, fallback: string) {
  if (error) throw new Error(sanitizedError(error, fallback));
}

export function artistSourceEnvelope(artist: WikidataArtist) {
  return {
    qid: artist.qid,
    normalized: artist,
    classification: {
      occupation: artist.occupation,
      field_of_work: artist.fieldOfWork,
      movement: artist.movement,
      nationality_qids: artist.nationalityQids,
    },
    imageDiscoveryHints: {
      p18: artist.imageFileTitle,
      commonsCategory: artist.commonsCategory,
      wikipediaArticleTitle: artist.wikipediaArticleTitle,
      wikipediaLanguage: artist.wikipediaLanguage,
    },
    raw: artist.raw,
  };
}

export function buildArtistInventorySettlement(
  candidate: ArtistDiscoveryInventoryCandidate,
  artist: WikidataArtist,
): ArtistInventorySettlement {
  if (candidate.external_id !== artist.qid) {
    throw new Error("Artist Inventory candidate and provider QID do not match");
  }
  const payload = artistSourceEnvelope(artist);
  return {
    inventoryId: candidate.id,
    externalId: artist.qid,
    payload,
    checksum: createHash("sha256").update(JSON.stringify(payload)).digest("hex"),
  };
}

export async function claimArtistDiscoveryInventory(
  db: SupabaseClient,
  input: { dataSourceId: string; runId: string; limit: number },
) {
  const limit = Math.max(1, Math.min(100, Math.floor(input.limit)));
  const { data, error } = await db.rpc("claim_artist_discovery_inventory", {
    p_data_source_id: input.dataSourceId,
    p_run_id: input.runId,
    p_limit: limit,
    p_lease_seconds: 300,
  });
  rpcError(error, "Artist Discovery Inventory claim failed");
  return (data || []) as ArtistDiscoveryInventoryCandidate[];
}

export async function applyArtistDiscoveryInventoryBatch(
  db: SupabaseClient,
  input: {
    runId: string;
    items: ArtistInventorySettlement[];
    invalid?: ArtistInventoryInvalidSettlement[];
  },
) {
  const invalid = input.invalid ?? [];
  if (input.items.length + invalid.length < 1 || input.items.length + invalid.length > 100) {
    throw new Error("Artist mixed settlement batch must contain 1 to 100 items");
  }
  const { data, error } = await db.rpc("settle_wikidata_artist_inventory_batch", {
    p_run_id: input.runId,
    p_items: input.items,
    p_invalid: invalid,
  });
  rpcError(error, "Artist Discovery Inventory batch settlement failed");
  return data as {
    created: number;
    exactSource: number;
    review: number;
    invalid: number;
    processed: number;
    imageDiscoveryExecuted: false;
  };
}

export async function retryArtistDiscoveryInventoryCandidate(
  db: SupabaseClient,
  input: { inventoryId: string; runId: string; error: unknown },
) {
  const { error } = await db.rpc("retry_artist_discovery_inventory_candidate", {
    p_inventory_id: input.inventoryId,
    p_run_id: input.runId,
    p_error: sanitizedError(input.error, "Transient Artist inventory failure"),
  });
  rpcError(error, "Artist Discovery Inventory retry settlement failed");
}

export async function releaseArtistDiscoveryInventoryClaims(
  db: SupabaseClient,
  input: { runId: string; error: unknown },
) {
  const { data, error } = await db.rpc("release_artist_discovery_inventory_claims", {
    p_run_id: input.runId,
    p_error: sanitizedError(input.error, "Controlled Artist importer interruption"),
  });
  rpcError(error, "Artist Discovery Inventory release failed");
  return Number(data || 0);
}

export async function consumeArtistDiscoveryInventoryBatch(
  db: SupabaseClient,
  input: {
    dataSourceId: string;
    runId: string;
    limit?: number;
    cache?: ArtistReferenceEntityCache;
    fetchArtists?: typeof fetchNormalizedArtists;
  },
) {
  const candidates = await claimArtistDiscoveryInventory(db, {
    dataSourceId: input.dataSourceId,
    runId: input.runId,
    limit: input.limit ?? RECOMMENDED_ARTIST_INVENTORY_BATCH_SIZE,
  });
  if (!candidates.length) return { claimed: 0, settled: null, cache: input.cache ?? new Map() };

  const fetchArtists = input.fetchArtists ?? fetchNormalizedArtists;
  try {
    const fetched = await fetchArtists(
      candidates.map((candidate) => ({ qid: candidate.external_id })),
      { cache: input.cache },
    );
    const byQid = new Map(fetched.artists.map((artist) => [artist.qid, artist]));
    const terminalByQid = new Map(
      fetched.errors
        .filter((error) => error.terminal === true)
        .map((error) => [error.qid, error.message]),
    );
    if (fetched.errors.some((error) => error.terminal !== true)) {
      throw new Error("Artist provider batch was incomplete; no settlement was applied");
    }
    const unresolved = candidates.filter(
      (candidate) => !byQid.has(candidate.external_id) && !terminalByQid.has(candidate.external_id),
    );
    if (unresolved.length) {
      throw new Error("Artist provider batch was incomplete; no settlement was applied");
    }
    const prepared = candidates.map((candidate) => {
      const artist = byQid.get(candidate.external_id);
      const reason = terminalByQid.get(candidate.external_id);
      return {
        item: artist ? buildArtistInventorySettlement(candidate, artist) : null,
        invalid: reason ? { inventoryId: candidate.id, externalId: candidate.external_id, reason } : null,
      };
    });
    const settled = { created: 0, exactSource: 0, review: 0, invalid: 0, processed: 0, imageDiscoveryExecuted: false as const };
    for (let offset = 0; offset < prepared.length; offset += ARTIST_INVENTORY_SETTLEMENT_CHUNK_SIZE) {
      const chunk = prepared.slice(offset, offset + ARTIST_INVENTORY_SETTLEMENT_CHUNK_SIZE);
      const chunkResult = await applyArtistDiscoveryInventoryBatch(db, {
        runId: input.runId,
        items: chunk.flatMap((entry) => entry.item ? [entry.item] : []),
        invalid: chunk.flatMap((entry) => entry.invalid ? [entry.invalid] : []),
      });
      settled.created += chunkResult.created ?? 0;
      settled.exactSource += chunkResult.exactSource ?? 0;
      settled.review += chunkResult.review ?? 0;
      settled.invalid += chunkResult.invalid ?? 0;
      settled.processed += chunkResult.processed ?? 0;
    }
    return { claimed: candidates.length, settled, cache: fetched.cache };
  } catch (error) {
    try {
      await releaseArtistDiscoveryInventoryClaims(db, { runId: input.runId, error });
    } catch (releaseError) {
      throw new Error(
        `${sanitizedError(error, "Artist provider batch failed")}; claim release failed: ${sanitizedError(releaseError, "unknown release error")}`,
      );
    }
    throw error;
  }
}
