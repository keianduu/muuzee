import { get as httpsGet } from "node:https";

const MAX_IMAGE_BYTES = 20 * 1024 * 1024;
const USER_AGENT = "MuuzeeAdmin/0.1 (https://github.com/keianduu/muuzee)";

const EXTENSIONS: Record<string, string> = {
  "image/gif": "gif",
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

export function assertCandidateImageUrl(value: string, provider: string | null) {
  const url = new URL(value);
  if (url.protocol !== "https:" || url.username || url.password) throw new Error("候補画像URLが安全なHTTPS URLではありません。");
  if (provider === "wikimedia_commons" && !["upload.wikimedia.org", "thumb.wikimedia.org"].includes(url.hostname)) throw new Error("Wikimedia Commonsの候補画像URLが不正です。");
  return url;
}

export function candidateImageExtension(contentType: string) {
  return EXTENSIONS[contentType.toLowerCase()] || null;
}

export function assertCandidateImageResponse(contentType: string, contentLength: string | null) {
  const extension = candidateImageExtension(contentType);
  if (!extension) throw new Error("候補画像はJPEG / PNG / WebP / GIFのみ設定できます。");
  const declaredBytes = contentLength ? Number(contentLength) : 0;
  if (Number.isFinite(declaredBytes) && declaredBytes > MAX_IMAGE_BYTES) throw new Error("候補画像は20MB以下のみ設定できます。");
  return extension;
}

export function assertCandidateImageSize(byteLength: number) {
  if (byteLength > MAX_IMAGE_BYTES) throw new Error("候補画像は20MB以下のみ設定できます。");
}

export type CandidateImageDownload = { bytes: Buffer; contentType: string; extension: string };

function nativeHttpsImage(url: URL, timeoutMs: number): Promise<CandidateImageDownload> {
  return new Promise((resolve, reject) => {
    const request = httpsGet(url, {
      family: 4,
      headers: { "User-Agent": USER_AGENT, Accept: "image/jpeg,image/png,image/webp,image/gif" },
      timeout: timeoutMs,
    }, (response) => {
      const status = response.statusCode || 0;
      if (status < 200 || status >= 300) {
        response.resume();
        reject(new Error(`候補画像を取得できませんでした（HTTP ${status || "unknown"}）。`));
        return;
      }

      const contentType = String(response.headers["content-type"] || "").split(";")[0].trim().toLowerCase();
      let extension: string;
      try {
        extension = assertCandidateImageResponse(contentType, String(response.headers["content-length"] || "") || null);
      } catch (error) {
        response.resume();
        reject(error);
        return;
      }

      const chunks: Buffer[] = [];
      let byteLength = 0;
      response.on("data", (chunk) => {
        const bytes = Buffer.from(chunk);
        byteLength += bytes.byteLength;
        if (byteLength > MAX_IMAGE_BYTES) {
          response.destroy(new Error("候補画像は20MB以下のみ設定できます。"));
          return;
        }
        chunks.push(bytes);
      });
      response.on("end", () => resolve({ bytes: Buffer.concat(chunks), contentType, extension }));
      response.on("error", reject);
    });
    request.on("timeout", () => request.destroy(new Error("候補画像の取得がタイムアウトしました。")));
    request.on("error", reject);
  });
}

export async function downloadCandidateImage(url: URL, timeoutMs = 30_000): Promise<CandidateImageDownload> {
  try {
    const response = await fetch(url, {
      headers: { "User-Agent": USER_AGENT, Accept: "image/jpeg,image/png,image/webp,image/gif" },
      signal: AbortSignal.timeout(timeoutMs),
    });
    if (!response.ok) throw new Error(`候補画像を取得できませんでした（HTTP ${response.status}）。`);
    const contentType = (response.headers.get("content-type") || "").split(";")[0].trim().toLowerCase();
    const extension = assertCandidateImageResponse(contentType, response.headers.get("content-length"));
    const bytes = Buffer.from(await response.arrayBuffer());
    assertCandidateImageSize(bytes.byteLength);
    return { bytes, contentType, extension };
  } catch {
    // Node fetch and native HTTPS can take different outbound routes locally.
    // Match the external-data clients by falling back to IPv4 native HTTPS.
    return nativeHttpsImage(url, Math.max(timeoutMs, 60_000));
  }
}
