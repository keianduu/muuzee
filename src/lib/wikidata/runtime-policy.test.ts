import { describe, expect, it } from "vitest";
import {
  createVenueImportRuntimeBudget,
  hostedRequestTimeoutMs,
  HOSTED_VENUE_IMPORT_BUDGET_MS,
  shouldDeferVenueImageDiscovery,
  venueImportShouldFinalize,
  wikidataRuntime,
} from "./runtime-policy";

describe("Wikidata hosted runtime policy", () => {
  it("uses a bounded hosted budget with finalization margin", () => {
    const budget = createVenueImportRuntimeBudget("hosted", 1_000);
    expect(budget.deadlineAt).toBe(1_000 + HOSTED_VENUE_IMPORT_BUDGET_MS);
    expect(hostedRequestTimeoutMs(budget, 1_000)).toBe(22_000);
    expect(venueImportShouldFinalize(budget, 1_000 + 194_999)).toBe(false);
    expect(venueImportShouldFinalize(budget, 1_000 + 195_000)).toBe(true);
  });

  it("leaves LOCAL execution without a hosted deadline", () => {
    const budget = createVenueImportRuntimeBudget("local", 1_000);
    expect(budget.deadlineAt).toBeNull();
    expect(hostedRequestTimeoutMs(budget, 999_999)).toBeUndefined();
    expect(venueImportShouldFinalize(budget, 999_999)).toBe(false);
  });

  it("defers optional images only for hosted count imports", () => {
    expect(shouldDeferVenueImageDiscovery("hosted", "count")).toBe(true);
    expect(shouldDeferVenueImageDiscovery("local", "count")).toBe(false);
    expect(shouldDeferVenueImageDiscovery("local", "full")).toBe(false);
  });

  it("derives runtime explicitly from Vercel execution", () => {
    expect(wikidataRuntime("1")).toBe("hosted");
    expect(wikidataRuntime("")).toBe("local");
  });
});
