import type { NextResponse } from "next/server";

export const PASSWORD_RECOVERY_COOKIE = "muuzee-password-recovery-v1";
export const PASSWORD_RECOVERY_MAX_AGE_SECONDS = 15 * 60;

type RecoveryCookieStore = {
  get(name: string): { value: string } | undefined;
};

const RECOVERY_MARKER_VALUE = "1";

function recoveryCookieOptions() {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
  };
}

export function hasPasswordRecoveryMarker(cookieStore: RecoveryCookieStore) {
  return cookieStore.get(PASSWORD_RECOVERY_COOKIE)?.value === RECOVERY_MARKER_VALUE;
}

export function setPasswordRecoveryMarker(response: NextResponse) {
  response.cookies.set(PASSWORD_RECOVERY_COOKIE, RECOVERY_MARKER_VALUE, {
    ...recoveryCookieOptions(),
    maxAge: PASSWORD_RECOVERY_MAX_AGE_SECONDS,
  });
  return response;
}

export function clearPasswordRecoveryMarker(response: NextResponse) {
  response.cookies.set(PASSWORD_RECOVERY_COOKIE, "", {
    ...recoveryCookieOptions(),
    expires: new Date(0),
    maxAge: 0,
  });
  return response;
}
