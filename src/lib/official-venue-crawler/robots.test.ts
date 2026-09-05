import { describe, expect, it } from "vitest";
import { robotsDecision } from "./robots";

describe("official crawler robots", () => {
  it("honors the longest matching allow/disallow rule and crawl delay", () => {
    const robots = "User-agent: *\nDisallow: /private\nAllow: /private/visit\nCrawl-delay: 2";
    expect(robotsDecision(robots, new URL("https://museum.example/private"))).toMatchObject({ allowed: false, crawlDelayMs: 2000 });
    expect(robotsDecision(robots, new URL("https://museum.example/private/visit"))).toMatchObject({ allowed: true, crawlDelayMs: 2000 });
  });
});
