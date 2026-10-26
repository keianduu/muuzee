import { describe, expect, it } from "vitest";
import { resolveVenueInitialAcquisitionState } from "./venue-initial-acquisition-state";

describe("Venue initial acquisition state", () => {
  it("is not started without a linked Venue or successful import evidence", () => {
    expect(resolveVenueInitialAcquisitionState(0, null)).toEqual({
      status: "not_started",
      linkedVenueCount: 0,
      latestRunStatus: null,
    });
    expect(resolveVenueInitialAcquisitionState(0, "failed").status).toBe("not_started");
  });

  it("is started when a linked Venue exists independently of the Master total", () => {
    expect(resolveVenueInitialAcquisitionState(1, null).status).toBe("started");
  });

  it.each(["completed", "partial"])("is started after a %s bounded initial import", (runStatus) => {
    expect(resolveVenueInitialAcquisitionState(0, runStatus).status).toBe("started");
  });
});
