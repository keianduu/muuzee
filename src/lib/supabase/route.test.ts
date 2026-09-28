import { NextResponse } from "next/server";
import { describe, expect, it, vi } from "vitest";
import { createSupabaseRouteResponseAdapter } from "./route";

describe("response-aware Supabase Route Handler adapter", () => {
  it("writes callback cookies and preserves SSR cache headers on the final response", () => {
    const cookieStore = {
      getAll: vi.fn(() => []),
      set: vi.fn(),
    };
    const adapter = createSupabaseRouteResponseAdapter(cookieStore);
    adapter.cookies.setAll([
      {
        name: "sb-local-auth-token",
        value: "redacted-session-value",
        options: { httpOnly: true, path: "/", sameSite: "lax" },
      },
    ], {
      "Cache-Control": "private, no-cache, no-store, must-revalidate, max-age=0",
      Expires: "0",
      Pragma: "no-cache",
    });

    const response = adapter.applyTo(NextResponse.redirect("http://localhost:3000/saved"));
    expect(cookieStore.set).toHaveBeenCalledWith("sb-local-auth-token", "redacted-session-value");
    expect(response.cookies.get("sb-local-auth-token")?.value).toBe("redacted-session-value");
    expect(response.headers.get("cache-control")).toBe("private, no-cache, no-store, must-revalidate, max-age=0");
    expect(response.headers.get("expires")).toBe("0");
    expect(response.headers.get("pragma")).toBe("no-cache");
  });
});
