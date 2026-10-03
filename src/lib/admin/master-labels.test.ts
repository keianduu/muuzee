import { describe, expect, it } from "vitest";
import { displayApiMatchStatus, displayCrawlStatus, displayStatus } from "./master-labels";

describe("admin status labels", () => {
  it("treats legacy ready as a non-public state", () => {
    expect(displayStatus("ready")).toBe("非公開");
  });

  it("uses the approved human labels for API matching", () => {
    expect(["matched", "candidate", "unmatched"].map(displayApiMatchStatus)).toEqual(["照合済み", "候補あり", "候補なし"]);
  });

  it("uses the approved human labels for official-site crawl outcomes", () => {
    expect(["success", "partial", "no_official_url", "robots_blocked", "fetch_failed", "parse_failed", "no_relevant_page", "timeout", null].map(displayCrawlStatus)).toEqual([
      "取得成功", "一部取得", "公式URLなし", "取得不可", "取得失敗", "解析失敗", "対象ページなし", "タイムアウト", "未取得",
    ]);
  });
});
