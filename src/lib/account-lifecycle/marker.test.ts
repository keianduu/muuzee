import { NextResponse } from "next/server";
import { describe, expect, it } from "vitest";
import {
  ACCOUNT_LIFECYCLE_COOKIE,
  ACCOUNT_LIFECYCLE_MAX_AGE_SECONDS,
  AccountLifecycleMarkerConfigurationError,
  clearAccountLifecycleMarker,
  createAccountLifecycleMarker,
  readAccountLifecycleMarker,
  setAccountLifecycleMarker,
  verifyAccountLifecycleMarker,
} from "./marker";

const USER_A = "25100000-0000-4000-8000-000000000001";
const USER_B = "25100000-0000-4000-8000-000000000002";
const SECRET = "order251-review-fixture-secret-with-at-least-32-bytes";
const ISSUED_AT = new Date("2026-09-28T00:00:00.000Z");
const NONCE = "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA";

function marker() {
  return createAccountLifecycleMarker(USER_A, {
    secret: SECRET,
    now: ISSUED_AT,
    nonce: NONCE,
  });
}

describe("Account lifecycle reauthentication marker", () => {
  it("signs an opaque 15-minute marker that is valid only for the issuing user", () => {
    const value = marker();
    expect(value).not.toContain(USER_A);
    expect(verifyAccountLifecycleMarker(value, USER_A, {
      secret: SECRET,
      now: new Date("2026-09-28T00:14:59.000Z"),
    })).toBe(true);
    expect(verifyAccountLifecycleMarker(value, USER_B, {
      secret: SECRET,
      now: new Date("2026-09-28T00:01:00.000Z"),
    })).toBe(false);
  });

  it.each([
    ["the former fixed marker", "1"],
    ["a malformed marker", "not.a.valid.marker"],
    ["an unknown version", marker().replace(/^v1\./, "v2.")],
    ["a tampered marker", marker().replace(NONCE, `B${NONCE.slice(1)}`)],
  ])("rejects %s", (_label, value) => {
    expect(verifyAccountLifecycleMarker(value, USER_A, {
      secret: SECRET,
      now: new Date("2026-09-28T00:01:00.000Z"),
    })).toBe(false);
  });

  it("rejects an expired marker using server-side time", () => {
    expect(verifyAccountLifecycleMarker(marker(), USER_A, {
      secret: SECRET,
      now: new Date("2026-09-28T00:15:00.000Z"),
    })).toBe(false);
  });

  it("fails closed when the dedicated signing secret is absent or too short", () => {
    expect(() => createAccountLifecycleMarker(USER_A, {
      secret: "",
      now: ISSUED_AT,
      nonce: NONCE,
    })).toThrow(AccountLifecycleMarkerConfigurationError);
    expect(verifyAccountLifecycleMarker(marker(), USER_A, {
      secret: "short",
      now: new Date("2026-09-28T00:01:00.000Z"),
    })).toBe(false);
  });

  it("writes and clears an HttpOnly cookie without changing its server expiry contract", () => {
    const value = marker();
    const response = setAccountLifecycleMarker(NextResponse.json({ ok: true }), value);
    const cookie = response.cookies.get(ACCOUNT_LIFECYCLE_COOKIE);
    expect(cookie?.value).toBe(value);
    expect(cookie?.httpOnly).toBe(true);
    expect(cookie?.sameSite).toBe("lax");
    expect(cookie?.path).toBe("/");
    expect(cookie?.maxAge).toBe(ACCOUNT_LIFECYCLE_MAX_AGE_SECONDS);
    expect(readAccountLifecycleMarker(response.cookies)).toBe(value);

    clearAccountLifecycleMarker(response);
    expect(response.cookies.get(ACCOUNT_LIFECYCLE_COOKIE)?.value).toBe("");
  });
});
