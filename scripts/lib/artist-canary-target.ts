export const APPROVED_ARTIST_CANARY_STG_REF = "steibqgeoqcsfsafaqcv";

export function validateArtistCanaryTarget(input: {
  stg: boolean;
  projectRef?: string;
  supabaseUrl: string;
  count: number;
  batch: number;
}) {
  const api = new URL(input.supabaseUrl);
  if (input.stg) {
    if (input.projectRef !== APPROVED_ARTIST_CANARY_STG_REF || api.hostname !== `${APPROVED_ARTIST_CANARY_STG_REF}.supabase.co`) {
      throw new Error("Artist canary target is not the approved STG project.");
    }
  } else if (!/^(127\.0\.0\.1|localhost)$/.test(api.hostname)) {
    throw new Error("Artist canary remote execution requires explicit --stg.");
  }
  const count = Math.max(1, Math.min(input.stg ? 150 : 1000, Math.floor(input.count)));
  const batch = Math.max(1, Math.min(50, Math.floor(input.batch)));
  return { count, batch };
}
