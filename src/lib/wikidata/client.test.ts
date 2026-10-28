import { beforeEach, describe, expect, it, vi } from "vitest";
import { fetchJson } from "@/lib/external/fetch-json";
import { createVenueImportRuntimeBudget } from "./runtime-policy";
import { getWikidataRawEntities } from "./client";

vi.mock("@/lib/external/fetch-json", () => ({ fetchJson: vi.fn() }));

describe("Wikidata entity request policy", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(fetchJson).mockResolvedValue({ entities: {} });
  });

  it("bounds hosted Core entity requests without native fallback", async () => {
    const budget = createVenueImportRuntimeBudget("hosted", Date.now());
    await getWikidataRawEntities(["Q1"], { runtimeBudget: budget });
    expect(fetchJson).toHaveBeenCalledWith(expect.any(URL), {
      timeoutMs: 22_000,
      retries: 0,
      nativeFallback: false,
    });
  });

  it("makes hosted administrative label requests shorter and optional", async () => {
    const budget = createVenueImportRuntimeBudget("hosted", Date.now());
    await getWikidataRawEntities(["Q1"], { runtimeBudget: budget, optional: true });
    expect(fetchJson).toHaveBeenCalledWith(expect.any(URL), {
      timeoutMs: 10_000,
      retries: 0,
      nativeFallback: false,
    });
  });

  it("keeps the existing LOCAL fetch policy", async () => {
    const budget = createVenueImportRuntimeBudget("local", Date.now());
    await getWikidataRawEntities(["Q1"], { runtimeBudget: budget });
    expect(fetchJson).toHaveBeenCalledWith(expect.any(URL), {});
  });
});
