import "server-only";

import {
  PostalAddressNotFoundError,
  PostalProviderUnavailableError,
  type PostalAddress,
  type PostalProvider,
} from "./postal";

type JapanPostEnvironment = {
  JAPAN_POST_POSTAL_API_URL_TEMPLATE?: string;
  JAPAN_POST_POSTAL_API_BEARER_TOKEN?: string;
};

type JapanPostAddressRow = Record<string, unknown>;

function firstText(row: JapanPostAddressRow, keys: string[]) {
  for (const key of keys) {
    const value = row[key];
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return "";
}

export function mapJapanPostAddress(payload: unknown, postalCode: string): PostalAddress {
  const root = payload && typeof payload === "object" ? payload as Record<string, unknown> : {};
  const rows = Array.isArray(payload)
    ? payload
    : Array.isArray(root.addresses) ? root.addresses
      : Array.isArray(root.data) ? root.data
        : root.address && typeof root.address === "object" ? [root.address]
          : [];
  const row = rows.find((candidate): candidate is JapanPostAddressRow => Boolean(candidate && typeof candidate === "object"));
  if (!row) throw new PostalAddressNotFoundError("該当する住所が見つかりませんでした。");
  const prefecture = firstText(row, ["pref_name", "prefecture", "prefecture_name", "pref"]);
  const city = firstText(row, ["city_name", "city", "municipality", "municipality_name"]);
  const town = firstText(row, ["town_name", "town", "town_area", "address1"]);
  if (!prefecture || !city) throw new PostalAddressNotFoundError("該当する住所が見つかりませんでした。");
  return { postalCode, prefecture, city, town, addressPrefix: `${prefecture}${city}${town}` };
}

export function createJapanPostPostalProvider(options: {
  env?: JapanPostEnvironment;
  fetchImpl?: typeof fetch;
} = {}): PostalProvider {
  const env = options.env || process.env;
  const urlTemplate = env.JAPAN_POST_POSTAL_API_URL_TEMPLATE?.trim();
  const bearerToken = env.JAPAN_POST_POSTAL_API_BEARER_TOKEN?.trim();
  if (!urlTemplate || !bearerToken || !urlTemplate.includes("{postalCode}")) {
    throw new PostalProviderUnavailableError("郵便番号検索は現在利用できません。管理者による日本郵便API設定が必要です。");
  }
  const fetchImpl = options.fetchImpl || fetch;
  return {
    async lookup(postalCode) {
      const response = await fetchImpl(urlTemplate.replace("{postalCode}", encodeURIComponent(postalCode)), {
        method: "GET",
        headers: { Accept: "application/json", Authorization: `Bearer ${bearerToken}` },
        cache: "no-store",
        signal: AbortSignal.timeout(8_000),
      });
      if (response.status === 404) throw new PostalAddressNotFoundError("該当する住所が見つかりませんでした。");
      if (!response.ok) throw new Error("日本郵便APIから住所を取得できませんでした。");
      return mapJapanPostAddress(await response.json(), postalCode);
    },
  };
}
