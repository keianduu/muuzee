import { beforeEach, describe, expect, it, vi } from "vitest";
import { revalidatePath } from "next/cache";
import { runVenuePeriodicRefresh } from "@/lib/wikidata/venue-periodic-refresh";
import { POST } from "./route";

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/wikidata/venue-periodic-refresh", () => ({ runVenuePeriodicRefresh: vi.fn() }));

const request = (body: Record<string, unknown>) => new Request("http://localhost/api/admin/imports/master-refresh/venue", {
  method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body),
});

describe("POST /api/admin/imports/master-refresh/venue", () => {
  beforeEach(() => vi.clearAllMocks());

  it("keeps preview read-only and does not revalidate", async () => {
    vi.mocked(runVenuePeriodicRefresh).mockResolvedValue({ dryRun: true, runId: null } as never);
    const response = await POST(request({ dryRun: true, limit: 20 }));
    expect(response.status).toBe(200);
    expect(runVenuePeriodicRefresh).toHaveBeenCalledWith({ dryRun: true, limit: 20 });
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it("defaults to dry run when the caller omits the flag", async () => {
    vi.mocked(runVenuePeriodicRefresh).mockResolvedValue({ dryRun: true, runId: null } as never);
    const response = await POST(request({}));
    expect(response.status).toBe(200);
    expect(runVenuePeriodicRefresh).toHaveBeenCalledWith({ dryRun: true, limit: Number.NaN });
  });

  it("revalidates current Admin surfaces after Apply", async () => {
    vi.mocked(runVenuePeriodicRefresh).mockResolvedValue({ dryRun: false, runId: "run-1" } as never);
    const response = await POST(request({ dryRun: false, limit: 20 }));
    expect(response.status).toBe(200);
    expect(revalidatePath).toHaveBeenCalledWith("/admin/venues");
  });
});
