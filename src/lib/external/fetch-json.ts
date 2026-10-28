import { get as httpsGet } from "node:https";

const USER_AGENT = "MuuzeeLocalVenueEnrichment/0.1 (development; https://github.com/keianduu/muuzee)";

function nativeHttpsJson<T>(input: URL | string, timeoutMs: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const request = httpsGet(input, {
      family: 4,
      headers: { "User-Agent": USER_AGENT, Accept: "application/json" },
      timeout: timeoutMs,
    }, (response) => {
      const chunks: Buffer[] = [];
      response.on("data", (chunk) => chunks.push(Buffer.from(chunk)));
      response.on("end", () => {
        const body = Buffer.concat(chunks).toString("utf8");
        if (!response.statusCode || response.statusCode < 200 || response.statusCode >= 300) {
          reject(new Error(`HTTP ${response.statusCode || "unknown"}`));
          return;
        }
        try { resolve(JSON.parse(body) as T); } catch (error) { reject(error); }
      });
    });
    request.on("timeout", () => request.destroy(new Error("External request timed out")));
    request.on("error", reject);
  });
}

export async function fetchJson<T>(
  url: URL | string,
  options: { timeoutMs?: number; retries?: number; nativeFallback?: boolean } = {},
): Promise<T> {
  const timeoutMs = options.timeoutMs ?? 12_000;
  const retries = options.retries ?? 2;
  const nativeFallback = options.nativeFallback ?? true;
  let lastError: unknown;
  for (let attempt = 0; attempt <= retries; attempt += 1) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetch(url, { headers: { "User-Agent": USER_AGENT, Accept: "application/json" }, signal: controller.signal });
      if (!response.ok) throw new Error(`HTTP ${response.status} ${response.statusText}`);
      return await response.json() as T;
    } catch (error) {
      lastError = error;
      if (nativeFallback) {
        try {
          // Native HTTPS is a fallback for local networks where undici cannot
          // establish the same outbound route. Normal fetch remains primary.
          return await nativeHttpsJson<T>(url, Math.max(timeoutMs, 60_000));
        } catch (nativeError) {
          lastError = nativeError instanceof Error ? nativeError : error;
        }
      }
      if (attempt < retries) await new Promise((resolve) => setTimeout(resolve, 350 * (attempt + 1)));
    } finally {
      clearTimeout(timer);
    }
  }
  throw lastError instanceof Error ? lastError : new Error("External request failed");
}
