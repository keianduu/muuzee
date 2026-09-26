import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { getSupabasePublicEnvironment } from "./config";

export async function createSupabaseServerClient() {
  const cookieStore = await cookies();
  const { url, anonKey } = getSupabasePublicEnvironment();

  return createServerClient(url, anonKey, {
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll: (cookiesToSet) => {
        try {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, options);
          });
        } catch {
          // Server Components cannot write cookies. middleware.ts refreshes them.
          // This helper is for server render/User Data DAL operations. Future Auth
          // mutation Route Handlers must use a response-aware adapter that applies
          // both cookies and the response/cache headers supplied by SSR setAll.
        }
      },
    },
  });
}
