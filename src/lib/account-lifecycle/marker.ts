import type { NextResponse } from "next/server";

export const ACCOUNT_LIFECYCLE_COOKIE = "muuzee-account-lifecycle-v1";
export const ACCOUNT_LIFECYCLE_MAX_AGE_SECONDS = 15 * 60;

type LifecycleCookieStore = {
  get(name: string): { value: string } | undefined;
};

const MARKER_VALUE = "1";

function lifecycleCookieOptions() {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
  };
}

export function hasAccountLifecycleMarker(cookieStore: LifecycleCookieStore) {
  return cookieStore.get(ACCOUNT_LIFECYCLE_COOKIE)?.value === MARKER_VALUE;
}

export function setAccountLifecycleMarker(response: NextResponse) {
  response.cookies.set(ACCOUNT_LIFECYCLE_COOKIE, MARKER_VALUE, {
    ...lifecycleCookieOptions(),
    maxAge: ACCOUNT_LIFECYCLE_MAX_AGE_SECONDS,
  });
  return response;
}

export function clearAccountLifecycleMarker(response: NextResponse) {
  response.cookies.set(ACCOUNT_LIFECYCLE_COOKIE, "", {
    ...lifecycleCookieOptions(),
    expires: new Date(0),
    maxAge: 0,
  });
  return response;
}
