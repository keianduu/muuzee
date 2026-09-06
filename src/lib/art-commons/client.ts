import type {
  ArtCommonsItem,
  ArtCommonsScrollResponse,
  ArtCommonsSearchResponse,
  SearchArtCommonsParams,
} from "./types";

const DEFAULT_BASE_URL = "https://jpsearch.go.jp";
const DEFAULT_DATABASE_ID = "exhib";
const DEFAULT_DELAY_MS = 750;
const DEFAULT_TIMEOUT_MS = 15_000;
const DEFAULT_RETRY_COUNT = 3;

export class JapanSearchError extends Error {
  constructor(message: string, readonly status?: number) {
    super(message);
    this.name = "JapanSearchError";
  }
}

function config() {
  return {
    baseUrl: (process.env.JPSEARCH_BASE_URL || DEFAULT_BASE_URL).replace(/\/$/, ""),
    databaseId: process.env.JPSEARCH_DATABASE_ID || DEFAULT_DATABASE_ID,
    delayMs: Number(process.env.JPSEARCH_REQUEST_DELAY_MS || DEFAULT_DELAY_MS),
  };
}

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export function isRetryableJapanSearchError(error: unknown) {
  return error instanceof JapanSearchError && (error.status == null || error.status === 429 || error.status >= 500);
}

async function fetchJsonOnce<T>(url: URL): Promise<T> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_MS);
  try {
    const response = await fetch(url, {
      headers: { Accept: "application/json", "User-Agent": "MuuzeeAdmin/0.1" },
      signal: controller.signal,
      cache: "no-store",
    });
    if (!response.ok) {
      throw new JapanSearchError(`Japan Search returned HTTP ${response.status}`, response.status);
    }
    try {
      return (await response.json()) as T;
    } catch {
      throw new JapanSearchError("Japan Search returned invalid JSON", response.status);
    }
  } catch (error) {
    if (error instanceof JapanSearchError) throw error;
    if (error instanceof Error && error.name === "AbortError") {
      throw new JapanSearchError("Japan Search request timed out");
    }
    throw new JapanSearchError(error instanceof Error ? error.message : "Japan Search request failed");
  } finally {
    clearTimeout(timeout);
  }
}

async function fetchJson<T>(url: URL): Promise<T> {
  let lastError: unknown;
  for (let attempt = 0; attempt < DEFAULT_RETRY_COUNT; attempt += 1) {
    try { return await fetchJsonOnce<T>(url); }
    catch (error) {
      lastError = error;
      if (!isRetryableJapanSearchError(error) || attempt === DEFAULT_RETRY_COUNT - 1) throw error;
      await wait(250 * 2 ** attempt);
    }
  }
  throw lastError;
}

export function getJapanSearchRequestDelayMs() {
  const delay = config().delayMs;
  return Number.isFinite(delay) && delay >= 0 ? delay : DEFAULT_DELAY_MS;
}

export async function searchArtCommons(
  params: SearchArtCommonsParams = {},
): Promise<ArtCommonsSearchResponse> {
  const { baseUrl, databaseId } = config();
  const size = Math.min(100, Math.max(1, Math.trunc(params.size ?? 20)));
  const from = Math.max(0, Math.trunc(params.from ?? 0));
  const hasYearRange = Number.isInteger(params.yearFrom) && Number.isInteger(params.yearTo);
  // r-tempo is ignored by the Art Commons theme endpoint. The cross-search
  // endpoint supports it, so combine it with f-db to retain the DB boundary.
  const url = new URL(hasYearRange ? "/api/item/search/jps-cross" : `/api/item/search/${databaseId}-default`, baseUrl);
  if (params.keyword?.trim()) url.searchParams.set("keyword", params.keyword.trim());
  if (hasYearRange) {
    url.searchParams.set("f-db", databaseId);
    url.searchParams.set("r-tempo", `${params.yearFrom},${params.yearTo}`);
  }
  url.searchParams.set("size", String(size));
  url.searchParams.set("from", String(from));
  const payload = await fetchJson<ArtCommonsSearchResponse>(url);
  if (!Array.isArray(payload.list) || typeof payload.hit !== "number") {
    throw new JapanSearchError("Japan Search response shape was not recognized");
  }
  return payload;
}

function addArtCommonsFilters(url: URL, params: SearchArtCommonsParams, databaseId: string) {
  if (params.keyword?.trim()) url.searchParams.set("keyword", params.keyword.trim());
  url.searchParams.set("f-db", databaseId);
  if (Number.isInteger(params.yearFrom) && Number.isInteger(params.yearTo)) {
    url.searchParams.set("r-tempo", `${params.yearFrom},${params.yearTo}`);
  }
}

export async function* scrollArtCommons(
  params: Pick<SearchArtCommonsParams, "keyword" | "yearFrom" | "yearTo"> = {},
): AsyncGenerator<ArtCommonsScrollResponse> {
  const { baseUrl, databaseId } = config();
  let scrollId: string | undefined;
  do {
    const url = new URL("/api/item/scroll/jps-cross", baseUrl);
    if (scrollId) url.searchParams.set("scrollId", scrollId);
    else addArtCommonsFilters(url, params, databaseId);
    const payload = await fetchJson<ArtCommonsScrollResponse>(url);
    if (!Array.isArray(payload.list) || typeof payload.hit !== "number") {
      throw new JapanSearchError("Japan Search scroll response shape was not recognized");
    }
    yield payload;
    scrollId = typeof payload.scrollId === "string" && payload.scrollId ? payload.scrollId : undefined;
  } while (scrollId);
}

export async function getArtCommonsItem(itemId: string): Promise<ArtCommonsItem> {
  if (!/^exhib-[A-Za-z0-9_-]+$/.test(itemId)) {
    throw new JapanSearchError("Invalid Art Commons item ID");
  }
  const { baseUrl } = config();
  const payload = await fetchJson<ArtCommonsItem>(new URL(`/api/item/${itemId}`, baseUrl));
  if (!payload.id) throw new JapanSearchError("Japan Search detail response has no item ID");
  return payload;
}
