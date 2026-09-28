import "server-only";

import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import type { NextResponse } from "next/server";

export const ACCOUNT_LIFECYCLE_COOKIE = "muuzee-account-lifecycle-v1";
export const ACCOUNT_LIFECYCLE_MAX_AGE_SECONDS = 15 * 60;
export const ACCOUNT_LIFECYCLE_MARKER_SECRET_ENV = "ACCOUNT_LIFECYCLE_MARKER_SECRET";

const MARKER_VERSION = "v1";
const MARKER_PURPOSE = "account-delete";
const MINIMUM_SECRET_BYTES = 32;
const BASE64URL_256_BIT_PATTERN = /^[A-Za-z0-9_-]{43}$/;
const UNIX_SECONDS_PATTERN = /^\d{10,13}$/;

type LifecycleCookieStore = {
  get(name: string): { value: string } | undefined;
};

type MarkerOptions = {
  now?: Date;
  nonce?: string;
  secret?: string;
};

export class AccountLifecycleMarkerConfigurationError extends Error {
  constructor() {
    super("Account lifecycle marker signing is not configured");
    this.name = "AccountLifecycleMarkerConfigurationError";
  }
}

function lifecycleCookieOptions() {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
  };
}

function markerSecret(explicitSecret?: string) {
  const secret = explicitSecret === undefined
    ? process.env[ACCOUNT_LIFECYCLE_MARKER_SECRET_ENV]
    : explicitSecret;
  if (!secret || Buffer.byteLength(secret, "utf8") < MINIMUM_SECRET_BYTES) {
    throw new AccountLifecycleMarkerConfigurationError();
  }
  return secret;
}

function markerMessage(input: {
  version: string;
  purpose: string;
  issuedAt: number;
  expiresAt: number;
  nonce: string;
  userId: string;
}) {
  return [
    input.version,
    input.purpose,
    input.issuedAt,
    input.expiresAt,
    input.nonce,
    input.userId,
  ].join("|");
}

function markerSignature(message: string, secret: string) {
  return createHmac("sha256", secret).update(message).digest("base64url");
}

export function createAccountLifecycleMarker(userId: string, options: MarkerOptions = {}) {
  if (!userId) throw new AccountLifecycleMarkerConfigurationError();
  const secret = markerSecret(options.secret);
  const issuedAt = Math.floor((options.now ?? new Date()).getTime() / 1000);
  const expiresAt = issuedAt + ACCOUNT_LIFECYCLE_MAX_AGE_SECONDS;
  const nonce = options.nonce ?? randomBytes(32).toString("base64url");
  if (!BASE64URL_256_BIT_PATTERN.test(nonce)) {
    throw new AccountLifecycleMarkerConfigurationError();
  }
  const message = markerMessage({
    version: MARKER_VERSION,
    purpose: MARKER_PURPOSE,
    issuedAt,
    expiresAt,
    nonce,
    userId,
  });
  const signature = markerSignature(message, secret);
  return [MARKER_VERSION, MARKER_PURPOSE, issuedAt, expiresAt, nonce, signature].join(".");
}

export function verifyAccountLifecycleMarker(
  marker: string | null,
  userId: string,
  options: MarkerOptions = {},
) {
  if (!marker || !userId) return false;
  try {
    const [version, purpose, issuedAtText, expiresAtText, nonce, signature, ...extra] = marker.split(".");
    if (
      extra.length
      || version !== MARKER_VERSION
      || purpose !== MARKER_PURPOSE
      || !UNIX_SECONDS_PATTERN.test(issuedAtText)
      || !UNIX_SECONDS_PATTERN.test(expiresAtText)
      || !BASE64URL_256_BIT_PATTERN.test(nonce)
      || !BASE64URL_256_BIT_PATTERN.test(signature)
    ) {
      return false;
    }

    const issuedAt = Number(issuedAtText);
    const expiresAt = Number(expiresAtText);
    const now = Math.floor((options.now ?? new Date()).getTime() / 1000);
    if (
      !Number.isSafeInteger(issuedAt)
      || !Number.isSafeInteger(expiresAt)
      || expiresAt - issuedAt !== ACCOUNT_LIFECYCLE_MAX_AGE_SECONDS
      || issuedAt > now
      || expiresAt <= now
    ) {
      return false;
    }

    const message = markerMessage({ version, purpose, issuedAt, expiresAt, nonce, userId });
    const expected = Buffer.from(markerSignature(message, markerSecret(options.secret)), "base64url");
    const actual = Buffer.from(signature, "base64url");
    return expected.length === actual.length && timingSafeEqual(expected, actual);
  } catch {
    return false;
  }
}

export function readAccountLifecycleMarker(cookieStore: LifecycleCookieStore) {
  return cookieStore.get(ACCOUNT_LIFECYCLE_COOKIE)?.value ?? null;
}

export function setAccountLifecycleMarker(response: NextResponse, marker: string) {
  response.cookies.set(ACCOUNT_LIFECYCLE_COOKIE, marker, {
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
