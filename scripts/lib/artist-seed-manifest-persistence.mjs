import { createHash } from "node:crypto";

export const APPROVED_ARTIST_STG_PROJECT_REF = "steibqgeoqcsfsafaqcv";
export const ARTIST_MANIFEST_OPERATION = "artist_seed_manifest_generation";

export function manifestChecksum(manifest) {
  const payload = { ...manifest };
  delete payload.checksum;
  return createHash("sha256").update(JSON.stringify(payload)).digest("hex");
}

export function validateArtistManifest(manifest) {
  if (!manifest || !Array.isArray(manifest.artists) || manifest.artists.length < 1 || manifest.artists.length > 1000) {
    throw new Error("Artist manifest must contain 1 to 1000 artists.");
  }
  if (manifestChecksum(manifest) !== manifest.checksum) throw new Error("Artist manifest checksum mismatch.");
  const qids = manifest.artists.map((artist) => artist.qid).filter(Boolean);
  if (new Set(qids).size !== qids.length) throw new Error("Artist manifest contains duplicate QIDs.");
  if (manifest.artists.some((artist, index) => artist.rank !== index + 1 || artist.verifiedExhibitionCount < 2)) {
    throw new Error("Artist manifest rank or exhibition eligibility is invalid.");
  }
  return manifest;
}

export function validateArtistManifestTarget(input) {
  const api = new URL(input.supabaseUrl);
  if (input.stg) {
    if (input.projectRef !== APPROVED_ARTIST_STG_PROJECT_REF) throw new Error("STG project ref is not the approved Artist canary target.");
    if (api.protocol !== "https:" || api.hostname !== `${APPROVED_ARTIST_STG_PROJECT_REF}.supabase.co`) {
      throw new Error("Supabase URL does not identify the approved Artist STG target.");
    }
  } else if (!/^(127\.0\.0\.1|localhost)$/.test(api.hostname)) {
    throw new Error("Remote Artist manifest persistence requires the explicit --stg target.");
  }
  return api;
}

export async function persistArtistManifest(db, manifest) {
  const { data: source, error: sourceError } = await db.from("data_sources").select("id").eq("key", "wikidata").single();
  if (sourceError || !source) throw sourceError || new Error("Wikidata data source is missing.");
  const { data: run, error: runError } = await db.from("import_runs").insert({
    data_source_id: source.id,
    operation_type: ARTIST_MANIFEST_OPERATION,
    status: "running",
    requested_count: manifest.artists.length,
    metrics: { scope: manifest.scope, version: manifest.version, checksum: manifest.checksum },
  }).select("id").single();
  if (runError || !run) throw runError || new Error("Artist manifest generation run creation failed.");
  const { data, error } = await db.rpc("record_artist_seed_manifest", {
    p_data_source_id: source.id,
    p_generation_id: run.id,
    p_scope: manifest.scope,
    p_version: manifest.version,
    p_checksum: manifest.checksum,
    p_items: manifest.artists,
    p_metadata: { criteria: manifest.criteria, ranking: manifest.ranking, sources: manifest.sources, counts: manifest.counts },
  });
  if (error) {
    await db.from("import_runs").update({ status: "failed", error_count: 1, finished_at: new Date().toISOString() }).eq("id", run.id);
    throw error;
  }
  return { runId: run.id, ...data };
}
