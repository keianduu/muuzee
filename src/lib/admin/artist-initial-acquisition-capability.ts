import "server-only";

export const ARTIST_INITIAL_ACQUISITION_DISABLED = {
  code: "artist_initial_acquisition_disabled",
  error: "Artist initial acquisition is not available for this environment target.",
} as const;

export function supabaseProjectRef(urlValue?: string) {
  try {
    const hostname = new URL(urlValue || "").hostname;
    return hostname.endsWith(".supabase.co") ? hostname.slice(0, -".supabase.co".length) : null;
  } catch {
    return null;
  }
}

export function isArtistInitialAcquisitionEnabled(input: {
  hosted?: boolean;
  configuredValue?: string;
  configuredProjectRef?: string;
  supabaseUrl?: string;
} = {}) {
  const hosted = input.hosted ?? process.env.VERCEL === "1";
  const enabled = input.configuredValue ?? process.env.ARTIST_INITIAL_ACQUISITION_ENABLED;
  if (!hosted) return enabled !== "false";
  if (enabled !== "true") return false;
  const configuredRef = input.configuredProjectRef ?? process.env.ARTIST_INITIAL_ACQUISITION_PROJECT_REF;
  const actualRef = supabaseProjectRef(input.supabaseUrl ?? process.env.NEXT_PUBLIC_SUPABASE_URL);
  return Boolean(configuredRef && actualRef && configuredRef === actualRef);
}
