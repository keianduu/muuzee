import { describe, expect, it } from "vitest";
import { crawlOfficialVenue, MAX_PAGES_PER_VENUE, retryOnce, sameOfficialDomain, withinOfficialSection } from "./crawler";

describe("official venue crawler", () => {
  it("normalizes www but blocks another domain", () => {
    expect(sameOfficialDomain(new URL("https://www.museum.example"), new URL("https://museum.example/visit"))).toBe(true);
    expect(sameOfficialDomain(new URL("https://museum.example"), new URL("https://other.example"))).toBe(false);
  });

  it("keeps a deep official section and shared visitor pages but excludes sibling facilities", () => {
    const root = new URL("https://complex.example/museum/");
    expect(withinOfficialSection(root, new URL("https://complex.example/museum/guide/"))).toBe(true);
    expect(withinOfficialSection(root, new URL("https://complex.example/access/"))).toBe(true);
    expect(withinOfficialSection(root, new URL("https://complex.example/cinema/about/"))).toBe(false);
  });

  it("retries one transient failure", async () => {
    let calls = 0;
    const result = await retryOnce(async () => { calls += 1; if (calls === 1) throw new Error("temporary"); return "ok"; }, async () => undefined);
    expect(result).toBe("ok"); expect(calls).toBe(2);
  });

  it("stops when robots blocks the official URL", async () => {
    const result = await crawlOfficialVenue({ id: "v1", name: "Museum", official_url: "https://museum.example/private" }, {
      fetchRobots: async () => "User-agent: *\nDisallow: /private",
      fetchHtml: async () => { throw new Error("must not fetch"); }, wait: async () => undefined,
    });
    expect(result.crawl_status).toBe("robots_blocked");
  });

  it("keeps discovery on the official domain and respects the page limit", async () => {
    const visited: string[] = [];
    const result = await crawlOfficialVenue({ id: "v1", name: "Museum", official_url: "https://museum.example" }, {
      fetchRobots: async () => "",
      wait: async () => undefined,
      fetchHtml: async (url) => {
        visited.push(url.toString());
        return { url, html: `<main><p>住所：東京都千代田区1-1</p>${Array.from({ length: 10 }, (_, index) => `<a href="/visit-${index}">利用案内 ${index}</a>`).join("")}<a href="https://external.example/access">アクセス</a></main>` };
      },
    });
    expect(visited).toHaveLength(MAX_PAGES_PER_VENUE);
    expect(visited.every((url) => new URL(url).hostname === "museum.example")).toBe(true);
    expect(result.address).toBe("東京都千代田区1-1");
  });

  it("reports timeout when both attempts time out", async () => {
    const timeout = Object.assign(new Error("timeout"), { name: "AbortError" });
    const result = await crawlOfficialVenue({ id: "v1", name: "Museum", official_url: "https://museum.example" }, {
      fetchRobots: async () => "", fetchHtml: async () => { throw timeout; }, wait: async () => undefined,
    });
    expect(result.crawl_status).toBe("timeout");
  });

  it("does not repeatedly visit a link that redirects to an already visited canonical URL", async () => {
    const visited: string[] = [];
    const result = await crawlOfficialVenue({ id: "v1", name: "Museum", official_url: "https://museum.example" }, {
      fetchRobots: async () => "",
      wait: async () => undefined,
      fetchHtml: async (url) => {
        visited.push(url.toString());
        return { url: new URL("https://museum.example/about"), html: `<main><p>施設概要</p><a href="/about">About</a></main>` };
      },
    });
    expect(visited).toEqual(["https://museum.example/"]);
    expect(result.discovered_urls).toEqual(["https://museum.example/about"]);
  });
});
