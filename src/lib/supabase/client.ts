"use client";

import { createBrowserClient } from "@supabase/ssr";
import { getSupabasePublicEnvironment } from "./config";

let browserClient: ReturnType<typeof createBrowserClient> | null = null;

export function createSupabaseBrowserClient() {
  if (browserClient) return browserClient;

  const { url, anonKey } = getSupabasePublicEnvironment();
  browserClient = createBrowserClient(url, anonKey);
  return browserClient;
}
