import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { type NextRequest, NextResponse } from "next/server";
import { authorizeAdminClaims, classifyAdminPath } from "@/lib/admin/authorization";
import { getSupabasePublicEnvironment } from "./config";

export async function refreshSupabaseSession(request: NextRequest) {
  type CookieWrite = { name: string; value: string; options: CookieOptions };

  const pendingCookies = new Map<string, CookieWrite>();
  const pendingHeaders = new Headers();
  const applyAuthState = (response: NextResponse) => {
    pendingCookies.forEach(({ name, value, options }) => {
      response.cookies.set(name, value, options);
    });
    pendingHeaders.forEach((value, name) => {
      response.headers.set(name, value);
    });
    return response;
  };

  const { url, anonKey } = getSupabasePublicEnvironment();
  const supabase = createServerClient(url, anonKey, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (cookiesToSet, headersToSet) => {
        cookiesToSet.forEach((cookie) => {
          request.cookies.set(cookie.name, cookie.value);
          pendingCookies.set(cookie.name, cookie);
        });
        Object.entries(headersToSet).forEach(([name, value]) => {
          pendingHeaders.set(name, value);
        });
      },
    },
  });

  let claims: unknown = null;
  try {
    const result = await supabase.auth.getClaims();
    if (!result.error) claims = result.data?.claims;
  } catch {
    claims = null;
  }

  const pathKind = classifyAdminPath(request.nextUrl.pathname);
  if (pathKind === "public") {
    return applyAuthState(NextResponse.next({ request }));
  }

  const access = authorizeAdminClaims(claims);
  if (access.status === "allowed") {
    return applyAuthState(NextResponse.next({ request }));
  }

  console.warn("[admin:auth]", {
    path: request.nextUrl.pathname,
    reason: access.status,
    method: request.method,
  });

  if (pathKind === "api") {
    const response = NextResponse.json(
      access.status === "unauthenticated"
        ? { code: "admin_unauthenticated", error: "Authentication is required." }
        : { code: "admin_forbidden", error: "Admin access is required." },
      { status: access.status === "unauthenticated" ? 401 : 403 },
    );
    response.headers.set("cache-control", "no-store");
    return applyAuthState(response);
  }

  const destination = access.status === "unauthenticated"
    ? "/admin/login"
    : "/admin/access-denied";
  return applyAuthState(NextResponse.redirect(new URL(destination, request.url)));
}
