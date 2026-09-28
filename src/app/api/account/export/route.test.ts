import { NextRequest, type NextResponse } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { exportAccountData } from "@/lib/account-lifecycle/service";
import { createSupabaseRouteClient } from "@/lib/supabase/route";
import { GET } from "./route";

vi.mock("@/lib/account-lifecycle/service", () => ({ exportAccountData: vi.fn() }));
vi.mock("@/lib/supabase/route", () => ({ createSupabaseRouteClient: vi.fn() }));

describe("GET /api/account/export", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(createSupabaseRouteClient).mockReturnValue({
      supabase: {},
      applyAuthState: (response: NextResponse) => response,
    } as never);
  });

  it("returns a private JSON attachment", async () => {
    vi.mocked(exportAccountData).mockResolvedValue({
      ok: true,
      data: {
        exportedAt: "2026-09-28T00:00:00.000Z",
        account: {
          id: "25100000-0000-4000-8000-000000000001",
          email: "person@example.com",
          createdAt: "2025-09-01T00:00:00.000Z",
          emailConfirmedAt: "2025-09-01T00:05:00.000Z",
        },
        profile: null,
        avatarAsset: { status: "not_present" },
        preferences: null,
        saved: [],
        seen: [],
        favorite: [],
        artWall: { settings: null, items: [] },
        legalConsents: [],
      },
    });

    const response = await GET(new NextRequest("http://localhost:3000/api/account/export"));
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("application/json; charset=utf-8");
    expect(response.headers.get("content-disposition")).toBe('attachment; filename="muuzee-account-data.json"');
    expect(response.headers.get("cache-control")).toBe("private, no-store");
  });

  it("returns the safe unauthenticated error without attachment headers", async () => {
    vi.mocked(exportAccountData).mockResolvedValue({
      ok: false,
      error: { code: "unauthenticated", retryable: false },
    });
    const response = await GET(new NextRequest("http://localhost:3000/api/account/export"));
    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({
      ok: false,
      error: { code: "unauthenticated", retryable: false },
    });
    expect(response.headers.get("content-disposition")).toBeNull();
  });
});
