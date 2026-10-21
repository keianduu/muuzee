import { describe, expect, it } from "vitest";
import {
  commitExhibitionPublicationState,
  exhibitionClientListQuery,
  exhibitionFirstPageCacheKey,
  exhibitionFirstPageRequestQuery,
  exhibitionListPath,
  failExhibitionPublicationState,
  isCurrentExhibitionListRequest,
  isLatestExhibitionListRequest,
  requestExhibitionPublicationState,
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

  it("keeps the last valid committed list while an uncached target is pending", () => {
    const current = {
      requestedQuery: "status=unpublished",
      committed: { query: "status=unpublished", result: { rows: ["A"] } },
    };
    const pending = requestExhibitionPublicationState(current, "status=published");

    expect(pending.requestedQuery).toBe("status=published");
    expect(pending.committed).toEqual(current.committed);
    expect(commitExhibitionPublicationState(pending, "status=published", { rows: ["B"] })).toEqual({
      requestedQuery: "status=published",
      committed: { query: "status=published", result: { rows: ["B"] } },
    });
  });

  it("commits cached targets immediately and retains them when revalidation fails", () => {
    const current = {
      requestedQuery: "status=unpublished",
      committed: { query: "status=unpublished", result: { rows: ["A"] } },
    };
    const cached = requestExhibitionPublicationState(current, "status=published", { rows: ["B cached"] });

    expect(cached.committed).toEqual({ query: "status=published", result: { rows: ["B cached"] } });
    expect(failExhibitionPublicationState(cached, true)).toEqual(cached);
  });

  it("rolls rapid uncached switches back to the last valid committed state", () => {
    const current = {
      requestedQuery: "status=unpublished",
      committed: { query: "status=unpublished", result: { rows: ["A"] } },
    };
    const pendingB = requestExhibitionPublicationState(current, "status=published");
    const pendingC = requestExhibitionPublicationState(pendingB, "status=archived");
    const failedC = failExhibitionPublicationState(pendingC, false);

    expect(pendingB.committed.query).toBe("status=unpublished");
    expect(pendingC.committed.query).toBe("status=unpublished");
    expect(failedC).toEqual(current);
  });

  it("keeps mutation membership on the committed status while another status is pending", () => {
    const pending = requestExhibitionPublicationState({
      requestedQuery: "status=unpublished",
      committed: { query: "status=unpublished", result: { rows: ["A"] } },
    }, "status=published");

    expect(new URLSearchParams(pending.requestedQuery).get("status")).toBe("published");
    expect(new URLSearchParams(pending.committed.query).get("status")).toBe("unpublished");
  });

  it("uses the same committed-state contract for uncached and cached history targets", () => {
    const current = {
      requestedQuery: "status=unpublished",
      committed: { query: "status=unpublished", result: { rows: ["A"] } },
    };
    const uncachedBack = requestExhibitionPublicationState(current, "status=published");
    const cachedForward = requestExhibitionPublicationState(current, "status=archived", { rows: ["C cached"] });

    expect(uncachedBack.committed).toEqual(current.committed);
    expect(cachedForward.committed).toEqual({ query: "status=archived", result: { rows: ["C cached"] } });
  });

  it("rejects an old 50-row page response after the committed query or request generation changes", () => {
    const oldPageTwo = [{ id: "A-51" }, { id: "A-52" }];
    const committedRows = [{ id: "B-1" }];
    const acceptsOldPage = isCurrentExhibitionListRequest("status=unpublished", "status=published", 4, 5);
    const rowsAfterOldResponse = acceptsOldPage ? [...committedRows, ...oldPageTwo] : committedRows;

    expect(isCurrentExhibitionListRequest("status=unpublished", "status=unpublished", 4, 4)).toBe(true);
    expect(isCurrentExhibitionListRequest("status=unpublished", "status=published", 4, 4)).toBe(false);
    expect(isCurrentExhibitionListRequest("status=published", "status=published", 3, 4)).toBe(false);
    expect(rowsAfterOldResponse).toEqual(committedRows);
  });
});
