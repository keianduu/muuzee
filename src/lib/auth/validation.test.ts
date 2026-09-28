import { describe, expect, it } from "vitest";
import {
  buildAuthCallbackUrl,
  buildFinalAuthRedirect,
  DEFAULT_AUTH_RETURN_TO,
  resolveSafeReturnTo,
} from "./validation";

describe("safe auth returnTo", () => {
  it.each([
    ["/", "/"],
    ["/profile", "/profile"],
    ["/saved?tab=exhibitions", "/saved?tab=exhibitions"],
  ])("accepts an application-relative path: %s", (input, expected) => {
    expect(resolveSafeReturnTo(input)).toBe(expected);
  });

  it.each([
    "https://evil.example/account",
    "http://evil.example/account",
    "javascript:alert(1)",
  ])("rejects an external or non-HTTP destination: %s", (input) => {
    expect(resolveSafeReturnTo(input)).toBe(DEFAULT_AUTH_RETURN_TO);
  });

  it.each(["//evil.example", "//evil.example/path", "/%2f%2fevil.example"]) (
    "rejects a network-path destination: %s",
    (input) => expect(resolveSafeReturnTo(input)).toBe(DEFAULT_AUTH_RETURN_TO),
  );

  it.each(["\\evil.example", "/safe\\evil", "/safe\u0000path", "/safe%5cevil"]) (
    "rejects backslashes and control characters: %s",
    (input) => expect(resolveSafeReturnTo(input)).toBe(DEFAULT_AUTH_RETURN_TO),
  );

  it("rejects callback loops", () => {
    expect(resolveSafeReturnTo("/auth/callback?code=secret")).toBe(DEFAULT_AUTH_RETURN_TO);
  });

  it("uses the neutral Auth completion page as the default destination", () => {
    expect(resolveSafeReturnTo(null)).toBe("/auth/complete");
  });

  it("builds a clean final redirect without callback credentials", () => {
    const redirect = buildFinalAuthRedirect("http://localhost:3000", "/saved?tab=art");
    expect(redirect.toString()).toBe("http://localhost:3000/saved?tab=art");
    expect(redirect.searchParams.has("code")).toBe(false);
    expect(redirect.searchParams.has("token_hash")).toBe(false);
  });

  it("carries signed Recovery callback state only on Recovery callback URLs", () => {
    const recovery = new URL(buildAuthCallbackUrl(
      "http://localhost:3000",
      "recovery",
      null,
      { recoveryState: "signed-state" },
    ));
    const confirmation = new URL(buildAuthCallbackUrl(
      "http://localhost:3000",
      "confirmation",
      null,
      { recoveryState: "signed-state" },
    ));

    expect(recovery.searchParams.get("recovery_state")).toBe("signed-state");
    expect(confirmation.searchParams.has("recovery_state")).toBe(false);
  });
});
