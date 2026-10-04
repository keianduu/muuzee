import { describe, expect, it, vi } from "vitest";
import { createJapanPostPostalProvider, mapJapanPostAddress } from "./japan-post";
import { PostalProviderUnavailableError, PostalValidationError, lookupPostalAddress, normalizeJapanPostalCode } from "./postal";

describe("JP postal lookup", () => {
  it.each([["1234567", "1234567"], ["123-4567", "1234567"], ["１２３－４５６７", "1234567"]])("normalizes %s", (input, expected) => {
    expect(normalizeJapanPostalCode(input)).toBe(expected);
  });

  it("rejects an invalid postal code", () => {
    expect(() => normalizeJapanPostalCode("123-456")).toThrow(PostalValidationError);
  });

  it("maps the Japan Post address response into the Admin contract", () => {
    expect(mapJapanPostAddress({ addresses: [{ pref_name: "東京都", city_name: "千代田区", town_name: "大手町" }] }, "1000004"))
      .toEqual({ postalCode: "1000004", prefecture: "東京都", city: "千代田区", town: "大手町", addressPrefix: "東京都千代田区大手町" });
  });

  it("supports a mocked provider without live network access", async () => {
    const provider = { lookup: vi.fn().mockResolvedValue({ postalCode: "1000004", prefecture: "東京都", city: "千代田区", town: "大手町", addressPrefix: "東京都千代田区大手町" }) };
    await expect(lookupPostalAddress("100-0004", provider)).resolves.toMatchObject({ city: "千代田区", town: "大手町" });
    expect(provider.lookup).toHaveBeenCalledWith("1000004");
  });

  it("fails closed when provider credentials are unavailable", () => {
    expect(() => createJapanPostPostalProvider({ env: {} })).toThrow(PostalProviderUnavailableError);
  });

  it("uses only the configured server endpoint and bearer token", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(new Response(JSON.stringify({ addresses: [{ pref_name: "東京都", city_name: "千代田区", town_name: "大手町" }] }), { status: 200 }));
    const provider = createJapanPostPostalProvider({ env: { JAPAN_POST_POSTAL_API_URL_TEMPLATE: "https://postal.example.test/search/{postalCode}", JAPAN_POST_POSTAL_API_BEARER_TOKEN: "test-token" }, fetchImpl });
    await expect(provider.lookup("1000004")).resolves.toMatchObject({ addressPrefix: "東京都千代田区大手町" });
    expect(fetchImpl).toHaveBeenCalledWith("https://postal.example.test/search/1000004", expect.objectContaining({ headers: expect.objectContaining({ Authorization: "Bearer test-token" }) }));
  });
});
