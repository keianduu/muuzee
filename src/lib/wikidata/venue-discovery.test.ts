import { beforeEach, describe, expect, it, vi } from "vitest";
import { fetchJson } from "@/lib/external/fetch-json";
import { buildWikidataVenueDiscoveryQuery, discoverWikidataVenuePage, normalizeDiscoveryResponse } from "./venue-discovery";

vi.mock("@/lib/external/fetch-json", () => ({ fetchJson: vi.fn() }));

beforeEach(() => {
  vi.clearAllMocks();
  vi.useRealTimers();
});

describe("Wikidata Venue discovery", () => {
  it("limits discovery to Japan and safe museum/gallery roots", () => {
    const query = buildWikidataVenueDiscoveryQuery({ limit: 20, offset: 40 });
    expect(query).toContain("wd:Q17");
    expect(query).toContain("wd:Q33506");
    expect(query).toContain("wd:Q1007870");
    expect(query).toContain("LIMIT 20");
    expect(query).toContain("OFFSET 40");
    expect(query).not.toContain("cultural center");
  });

  it("deduplicates QIDs and keeps their discovery roots", () => {
    const result = normalizeDiscoveryResponse({ results: { bindings: [{
      item: { value: "http://www.wikidata.org/entity/Q1" },
      roots: { value: "http://www.wikidata.org/entity/Q33506|http://www.wikidata.org/entity/Q1007870" },
    }] } }, 20);
    expect(result).toEqual([{ qid: "Q1", rootIds: ["Q33506", "Q1007870"] }]);
  });

  it("keeps deterministic ordered offset pagination without a COUNT query", () => {
    const query = buildWikidataVenueDiscoveryQuery({ limit: 50, offset: 100 });
    expect(query).toContain("ORDER BY STR(?item)");
    expect(query).toContain("LIMIT 50");
    expect(query).toContain("OFFSET 100");
    expect(query.toUpperCase()).not.toContain("COUNT(");
  });

  it("supports QID cursor pagination without OFFSET", () => {
    const query = buildWikidataVenueDiscoveryQuery({ limit: 20, afterQid: "Q101086086" });
    expect(query).toContain('FILTER(STR(?item) > "http://www.wikidata.org/entity/Q101086086")');
    expect(query).not.toContain("OFFSET");
  });

  it("can split full discovery by root without GROUP_CONCAT", () => {
    const query = buildWikidataVenueDiscoveryQuery({ rootQid: "Q33506", limit: 100, afterQid: "Q1041232" });
    expect(query).toContain("BIND(wd:Q33506 AS ?root)");
    expect(query).toContain("SELECT DISTINCT ?item ?root");
    expect(query).not.toContain("GROUP_CONCAT");
  });

  it("retries a transient discovery failure with backoff", async () => {
    vi.useFakeTimers();
    vi.mocked(fetchJson)
      .mockRejectedValueOnce(new Error("HTTP 502"))
      .mockResolvedValueOnce({ results: { bindings: [{
        item: { value: "http://www.wikidata.org/entity/Q1" },
        root: { value: "http://www.wikidata.org/entity/Q33506" },
      }] } });
    const onRetry = vi.fn();
    const pending = discoverWikidataVenuePage({ rootQid: "Q33506", limit: 20, onRetry });
    await vi.advanceTimersByTimeAsync(1_500);
    await expect(pending).resolves.toEqual([{ qid: "Q1", rootIds: ["Q33506"] }]);
    expect(onRetry).toHaveBeenCalledWith(expect.objectContaining({ attempt: 1, delayMs: 1_500, message: "HTTP 502" }));
    expect(fetchJson).toHaveBeenCalledTimes(2);
  });
});
