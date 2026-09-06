import { afterEach, describe, expect, it, vi } from "vitest";
import { getArtCommonsItem, scrollArtCommons, searchArtCommons } from "./client";

afterEach(() => vi.unstubAllGlobals());
describe("Japan Search client", () => {
  it("requests the Art Commons search theme", async () => { const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ hit: 1, from: 0, list: [{ id: "exhib-1" }] }), { status: 200 })); vi.stubGlobal("fetch", fetchMock); await searchArtCommons({ keyword: "東京", size: 5 }); expect(String(fetchMock.mock.calls[0][0])).toContain("/api/item/search/exhib-default"); expect(String(fetchMock.mock.calls[0][0])).toContain("keyword=%E6%9D%B1%E4%BA%AC"); });
  it("uses cross-search with an Art Commons DB and year boundary", async () => { const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ hit: 1, from: 0, list: [{ id: "exhib-1" }] }), { status: 200 })); vi.stubGlobal("fetch", fetchMock); await searchArtCommons({ keyword: "東京", size: 5, yearFrom: 2026, yearTo: 2027 }); const url = String(fetchMock.mock.calls[0][0]); expect(url).toContain("/api/item/search/jps-cross"); expect(url).toContain("f-db=exhib"); expect(url).toContain("r-tempo=2026%2C2027"); });
  it("continues the scroll snapshot until the API removes scrollId", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ hit: 2, list: [{ id: "exhib-1" }], scrollId: "next-page" }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ hit: 2, list: [{ id: "exhib-2" }] }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    const pages = [];
    for await (const page of scrollArtCommons({ keyword: "東京", yearFrom: 2026, yearTo: 2027 })) pages.push(page);
    expect(pages.flatMap((page) => page.list.map((item) => item.id))).toEqual(["exhib-1", "exhib-2"]);
    const firstUrl = String(fetchMock.mock.calls[0][0]);
    const secondUrl = String(fetchMock.mock.calls[1][0]);
    expect(firstUrl).toContain("/api/item/scroll/jps-cross");
    expect(firstUrl).toContain("f-db=exhib");
    expect(firstUrl).toContain("r-tempo=2026%2C2027");
    expect(secondUrl).toContain("scrollId=next-page");
    expect(secondUrl).not.toContain("f-db=exhib");
  });
  it("rejects unsafe item identifiers before making a request", async () => { await expect(getArtCommonsItem("../../secret")).rejects.toThrow("Invalid Art Commons item ID"); });
  it("retries a transient source failure", async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(new Response("busy", { status: 503 })).mockResolvedValueOnce(new Response(JSON.stringify({ id: "exhib-1", common: {} }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    await expect(getArtCommonsItem("exhib-1")).resolves.toMatchObject({ id: "exhib-1" });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
