import { describe, expect, it } from "vitest";
import {
  exhibitionClientListQuery,
  exhibitionFirstPageCacheKey,
  exhibitionFirstPageRequestQuery,
  exhibitionListPath,
  isLatestExhibitionListRequest,
} from "./exhibition-publication-client-state";

describe("Exhibition publication client state", () => {
  it("preserves list filters while clearing navigation and pagination state", () => {
    expect(exhibitionClientListQuery(
      "status=unpublished&q=art&image=missing&schedule=past&selected=ex-1&panel=image&candidate=c-1&run=r-1&targetUrl=x&page=3&pageSize=20",
      "published",
    )).toBe("status=published&q=art&image=missing&schedule=past");
  });

  it("canonicalizes the default and legacy schedule without generating a schedule query", () => {
    expect(exhibitionClientListQuery("schedule=current&q=art", "archived")).toBe("q=art&status=archived");
    expect(exhibitionClientListQuery("schedule=upcoming&q=art", "published")).toBe("q=art&status=published");
    expect(exhibitionClientListQuery("schedule=current_upcoming&q=art", "unpublished")).toBe("q=art&status=unpublished");
  });

  it("bounds publication switches to the first 50 rows", () => {
    expect(exhibitionFirstPageRequestQuery("status=published&q=art&page=4&pageSize=10"))
      .toBe("status=published&q=art&page=1&pageSize=50");
  });

  it("keys cache entries only by publication and preserved filters", () => {
    const first = exhibitionFirstPageCacheKey("status=published&q=art&image=present&schedule=past&selected=ex-1&page=3");
    const same = exhibitionFirstPageCacheKey("status=published&q=art&image=present&schedule=past&selected=ex-2&page=9");
    expect(first).toBe(same);
    expect(first).not.toBe(exhibitionFirstPageCacheKey("status=archived&q=art&image=present&schedule=past"));
  });

  it("builds canonical history URLs and ignores stale requests", () => {
    expect(exhibitionListPath("/admin/exhibitions", "status=published&q=art")).toBe("/admin/exhibitions?status=published&q=art");
    expect(exhibitionListPath("/admin/exhibitions", "")).toBe("/admin/exhibitions");
    expect(isLatestExhibitionListRequest(3, 3)).toBe(true);
    expect(isLatestExhibitionListRequest(2, 3)).toBe(false);
  });
});
