import { describe, expect, it } from "vitest";
import { extractOfficialPage, resolveCandidates } from "./extractor";

describe("official page extraction", () => {
  it("prefers structured data and extracts operating fields conservatively", () => {
    const html = `<html><head><meta name="description" content="公式の施設紹介です。"><script type="application/ld+json">{"@type":"Museum","address":{"postalCode":"100-0001","addressRegion":"東京都","addressLocality":"千代田区","streetAddress":"千代田1-1"},"openingHours":["Mo-Fr 10:00-18:00"]}</script></head><body><main><p>休館日：毎週月曜日</p><p>アクセス：東京駅から徒歩10分</p><a href="/visit">利用案内</a></main></body></html>`;
    const extracted = extractOfficialPage(html, "https://museum.example/about");
    const resolved = resolveCandidates(extracted.candidates);
    expect(resolved.values).toMatchObject({ postal_code: "100-0001", opening_hours_text: "Mo-Fr 10:00-18:00", closed_days_text: "毎週月曜日", access_text: "東京駅から徒歩10分" });
    expect(extracted.descriptionSourceText).toBe("公式の施設紹介です。");
    expect(extracted.links[0].url).toBe("https://museum.example/visit");
  });

  it("leaves equally reliable conflicting values for human resolution", () => {
    const result = resolveCandidates({ closed_days_text: [
      { value: "月曜日", sourceUrl: "https://museum.example/a", confidence: 60 },
      { value: "火曜日", sourceUrl: "https://museum.example/b", confidence: 60 },
    ] });
    expect(result.values.closed_days_text).toBeUndefined();
    expect(result.ambiguous.closed_days_text).toEqual(["月曜日", "火曜日"]);
  });

  it("rejects labels and unrelated prose as canonical address or access", () => {
    const html = `<main><p>ADDRESS</p><p>住所：を有する中学生以下の方、1歳未満は無料。</p><p>アクセス：access</p></main>`;
    const resolved = resolveCandidates(extractOfficialPage(html, "https://museum.example/access").candidates);
    expect(resolved.values.address).toBeUndefined();
    expect(resolved.values.access_text).toBeUndefined();
  });
});
