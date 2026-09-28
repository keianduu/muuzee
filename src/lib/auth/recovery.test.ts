import { NextResponse } from "next/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  clearPasswordRecoveryMarker,
  createPasswordRecoveryMarker,
  PASSWORD_RECOVERY_COOKIE,
  PASSWORD_RECOVERY_MAX_AGE_SECONDS,
  PasswordRecoveryMarkerConfigurationError,
  readPasswordRecoveryMarker,
  setPasswordRecoveryMarker,
  verifyPasswordRecoveryMarker,
} from "./recovery";

const USER_A = "24400000-0000-4000-8000-000000000001";
const USER_B = "24400000-0000-4000-8000-000000000002";
const SECRET = "order244-recovery-marker-secret-with-at-least-32-bytes";
const ISSUED_AT = new Date("2026-09-28T00:00:00.000Z");
const NONCE = "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA";

function marker() {
  return createPasswordRecoveryMarker(USER_A, {
    secret: SECRET,
    now: ISSUED_AT,
    nonce: NONCE,
  });
}

function tamperedMarker() {
  const segments = marker().split(".");
  const signature = segments.at(-1) ?? "";
  segments[segments.length - 1] = `${signature.startsWith("A") ? "B" : "A"}${signature.slice(1)}`;
  return segments.join(".");
}

describe("password recovery purpose marker", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("accepts a valid signed marker only for the issuing user", () => {
    const value = marker();
    expect(verifyPasswordRecoveryMarker(value, USER_A, {
      secret: SECRET,
      now: new Date("2026-09-28T00:14:59.000Z"),
    })).toBe(true);
    expect(verifyPasswordRecoveryMarker(value, USER_B, {
      secret: SECRET,
      now: new Date("2026-09-28T00:01:00.000Z"),
    })).toBe(false);
  });

  it.each([
    ["the former fixed marker", "1"],
    ["a malformed marker", "not.a.valid.marker"],
    ["a tampered marker", tamperedMarker()],
    ["an unknown version", marker().replace(/^v1\./, "v2.")],
    ["the wrong purpose", marker().replace(".password-recovery.", ".account-delete.")],
  ])("rejects %s", (_label, value) => {
    expect(verifyPasswordRecoveryMarker(value, USER_A, {
      secret: SECRET,
      now: new Date("2026-09-28T00:01:00.000Z"),
    })).toBe(false);
  });

  it("rejects an expired marker using server-side time", () => {
    expect(verifyPasswordRecoveryMarker(marker(), USER_A, {
      secret: SECRET,
      now: new Date("2026-09-28T00:15:00.000Z"),
    })).toBe(false);
  });

  it("fails closed when the dedicated secret is missing or too short", () => {
    vi.stubEnv("PASSWORD_RECOVERY_MARKER_SECRET", "");
    expect(() => createPasswordRecoveryMarker(USER_A, {
      now: ISSUED_AT,
      nonce: NONCE,
    })).toThrow(PasswordRecoveryMarkerConfigurationError);
    expect(verifyPasswordRecoveryMarker(marker(), USER_A, {
      secret: "short",
      now: new Date("2026-09-28T00:01:00.000Z"),
    })).toBe(false);
  });

  it("does not place identity, credentials, tokens, or secrets in the cookie payload", () => {
    const value = marker();
    for (const sensitive of [
      USER_A,
      "person@example.com",
      "password123",
      "access-token",
      "refresh-token",
      SECRET,
    ]) {
      expect(value).not.toContain(sensitive);
    }
  });

  it("uses a 15-minute HttpOnly SameSite marker and clears it on the root path", () => {
    const value = marker();
    const response = setPasswordRecoveryMarker(NextResponse.json({ ok: true }), value);
    const cookie = response.cookies.get(PASSWORD_RECOVERY_COOKIE);

    expect(cookie?.value).toBe(value);
    expect(response.headers.get("set-cookie")).toContain("HttpOnly");
    expect(response.headers.get("set-cookie")).toContain("SameSite=lax");
    expect(response.headers.get("set-cookie")).toContain("Path=/");
    expect(response.headers.get("set-cookie")).toContain(`Max-Age=${PASSWORD_RECOVERY_MAX_AGE_SECONDS}`);
    expect(readPasswordRecoveryMarker(response.cookies)).toBe(value);

    clearPasswordRecoveryMarker(response);
    expect(response.cookies.get(PASSWORD_RECOVERY_COOKIE)?.value).toBe("");
    expect(response.headers.get("set-cookie")).toContain("Max-Age=0");
    expect(response.headers.get("set-cookie")).toContain("Path=/");
  });

  it("marks the cookie Secure in Production", () => {
    vi.stubEnv("NODE_ENV", "production");
    const response = setPasswordRecoveryMarker(NextResponse.json({ ok: true }), marker());
    expect(response.headers.get("set-cookie")).toContain("Secure");
  });
});
