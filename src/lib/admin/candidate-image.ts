import { get as httpsGet } from "node:https";
import { lookup } from "node:dns/promises";
import { isIP } from "node:net";

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
  if (isPrivateNetworkAddress(url.hostname)) throw new Error("候補画像URLにprivate/local networkは指定できません。");
  if (provider === "wikimedia_commons" && !["upload.wikimedia.org", "thumb.wikimedia.org"].includes(url.hostname)) throw new Error("Wikimedia Commonsの候補画像URLが不正です。");
  return url;
}

function ipv4Number(address: string) {
  return address.split(".").reduce((value, octet) => (value << 8) + Number(octet), 0) >>> 0;
}

function inIpv4Range(address: string, base: string, bits: number) {
  const mask = bits === 0 ? 0 : (0xffffffff << (32 - bits)) >>> 0;
  return (ipv4Number(address) & mask) === (ipv4Number(base) & mask);
}

export function isPrivateNetworkAddress(raw: string): boolean {
  const address = raw.toLowerCase().replace(/^\[|\]$/g, "").replace(/\.$/, "");
  if (address === "localhost" || address.endsWith(".localhost")) return true;
  const version = isIP(address);
  if (version === 4) {
    return [
      ["0.0.0.0", 8], ["10.0.0.0", 8], ["127.0.0.0", 8], ["169.254.0.0", 16],
      ["172.16.0.0", 12], ["192.168.0.0", 16], ["224.0.0.0", 4], ["240.0.0.0", 4],
    ].some(([base, bits]) => inIpv4Range(address, String(base), Number(bits)));
  }
  if (version === 6) {
    if (address === "::" || address === "::1") return true;
    if (/^f[cd]/.test(address) || /^fe[89ab]/.test(address)) return true;
    const mapped = address.match(/^::ffff:(.+)$/)?.[1];
    if (mapped?.includes(".")) return isPrivateNetworkAddress(mapped);
    if (mapped) {
      const [high = "0", low = "0"] = mapped.split(":").slice(-2);
      const value = (Number.parseInt(high, 16) * 0x10000) + Number.parseInt(low, 16);
      if (Number.isFinite(value)) return isPrivateNetworkAddress(`${(value >>> 24) & 255}.${(value >>> 16) & 255}.${(value >>> 8) & 255}.${value & 255}`);
    }
    return false;
  }
  return false;
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

async function nativeHttpsImage(url: URL, timeoutMs: number, redirectCount = 0): Promise<CandidateImageDownload> {
  assertCandidateImageUrl(url.href, null);
  if (redirectCount > 5) throw new Error("候補画像URLのredirectが多すぎます。");
  const addresses = await lookup(url.hostname, { all: true, verbatim: true });
  if (!addresses.length || addresses.some((entry) => isPrivateNetworkAddress(entry.address))) throw new Error("候補画像URLがprivate/local networkを参照しています。");
  const selected = addresses.find((entry) => entry.family === 4) || addresses[0];
  return new Promise((resolve, reject) => {
    const request = httpsGet(url, {
      lookup: (_hostname, options, callback) => {
        if (typeof options === "object" && options.all) {
          callback(null, [{ address: selected.address, family: selected.family }]);
          return;
        }
        callback(null, selected.address, selected.family);
      },
      headers: { "User-Agent": USER_AGENT, Accept: "image/jpeg,image/png,image/webp,image/gif" },
      timeout: timeoutMs,
    }, (response) => {
      const status = response.statusCode || 0;
      if ([301, 302, 303, 307, 308].includes(status) && response.headers.location) {
        const nextUrl = new URL(response.headers.location, url);
        response.resume();
        nativeHttpsImage(nextUrl, timeoutMs, redirectCount + 1).then(resolve, reject);
        return;
      }
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
  return nativeHttpsImage(url, timeoutMs);
}
