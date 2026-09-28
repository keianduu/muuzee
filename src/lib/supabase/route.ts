import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { type NextRequest, type NextResponse } from "next/server";
import { getSupabasePublicEnvironment } from "./config";

type RequestCookieStore = Pick<NextRequest["cookies"], "getAll" | "set">;

type CookieWrite = {
  name: string;
  value: string;
  options: CookieOptions;
};

export function createSupabaseRouteResponseAdapter(cookieStore: RequestCookieStore) {
  const pendingCookies: CookieWrite[] = [];
  const pendingHeaders = new Headers();

  return {
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll: (cookiesToSet: CookieWrite[], headersToSet: Record<string, string>) => {
        cookiesToSet.forEach(({ name, value, options }) => {
          cookieStore.set(name, value);
          pendingCookies.push({ name, value, options });
        });
        Object.entries(headersToSet).forEach(([name, value]) => {
          pendingHeaders.set(name, value);
        });
      },
    },
    applyTo(response: NextResponse) {
      pendingCookies.forEach(({ name, value, options }) => {
        response.cookies.set(name, value, options);
      });
      pendingHeaders.forEach((value, name) => {
        response.headers.set(name, value);
      });
      return response;
    },
  };
}

export function createSupabaseRouteClient(request: NextRequest) {
  const { url, anonKey } = getSupabasePublicEnvironment();
  const responseAdapter = createSupabaseRouteResponseAdapter(request.cookies);
  const supabase = createServerClient(url, anonKey, {
    cookies: responseAdapter.cookies,
  });

  return {
    supabase,
    applyAuthState: responseAdapter.applyTo,
  };
}
