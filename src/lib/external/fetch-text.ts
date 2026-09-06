import { get as httpsGet } from "node:https";

const USER_AGENT = "MuuzeeTargetedArtistEnrichment/1.0 (https://github.com/keianduu/muuzee)";

function nativeHttpsText(input: URL | string, timeoutMs: number): Promise<string> {
  return new Promise((resolve, reject) => {
    const request = httpsGet(input, { family: 4, headers: { "User-Agent": USER_AGENT, Accept: "text/html" }, timeout: timeoutMs }, (response) => {
      const chunks: Buffer[] = [];
      response.on("data", (chunk) => chunks.push(Buffer.from(chunk)));
      response.on("end", () => {
        if (!response.statusCode || response.statusCode < 200 || response.statusCode >= 300) {
          reject(new Error(`HTTP ${response.statusCode || "unknown"}`));
          return;
        }
        resolve(Buffer.concat(chunks).toString("utf8"));
      });
    });
    request.on("timeout", () => request.destroy(new Error("External request timed out")));
    request.on("error", reject);
  });
}

export async function fetchText(url: URL | string, timeoutMs = 20_000) {
  try {
    const response = await fetch(url, { headers: { "User-Agent": USER_AGENT, Accept: "text/html" }, signal: AbortSignal.timeout(timeoutMs) });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return await response.text();
  } catch {
    return nativeHttpsText(url, Math.max(timeoutMs, 60_000));
  }
}
