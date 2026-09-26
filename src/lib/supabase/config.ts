const CONFIGURATION_ERROR = "Supabase public environment is not configured. See .env.example.";

export function getSupabasePublicEnvironment() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    throw new Error(CONFIGURATION_ERROR);
  }

  return { url, anonKey };
}
