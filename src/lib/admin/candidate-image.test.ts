import { describe, expect, it } from "vitest";
import { assertCandidateImageResponse, assertCandidateImageSize, assertCandidateImageUrl, candidateImageExtension, isPrivateNetworkAddress } from "./candidate-image";

describe("candidate image validation", () => {
  it("maps supported image content types to safe extensions", () => {
    expect(candidateImageExtension("image/jpeg")).toBe("jpg");
    expect(candidateImageExtension("image/png")).toBe("png");
    expect(candidateImageExtension("text/html")).toBeNull();
  });

  it("rejects unsupported and oversized responses", () => {
    expect(() => assertCandidateImageResponse("text/html", null)).toThrow("JPEG / PNG / WebP / GIF");
    expect(() => assertCandidateImageResponse("image/jpeg", String(21 * 1024 * 1024))).toThrow("20MB");
    expect(() => assertCandidateImageSize(21 * 1024 * 1024)).toThrow("20MB");
  });

  it("allows only the expected HTTPS host for Wikimedia candidates", () => {
    expect(assertCandidateImageUrl("https://upload.wikimedia.org/example.jpg", "wikimedia_commons").hostname).toBe("upload.wikimedia.org");
    expect(assertCandidateImageUrl("https://thumb.wikimedia.org/example.jpg", "wikimedia_commons").hostname).toBe("thumb.wikimedia.org");
    expect(() => assertCandidateImageUrl("http://upload.wikimedia.org/example.jpg", "wikimedia_commons")).toThrow("HTTPS");
    expect(() => assertCandidateImageUrl("https://example.com/example.jpg", "wikimedia_commons")).toThrow("不正");
  });

  it("rejects private, loopback, link-local, and local image targets", () => {
    for (const address of ["localhost", "127.0.0.1", "10.0.0.1", "172.16.0.1", "192.168.1.1", "169.254.1.1", "::1", "fc00::1", "fe80::1", "::ffff:7f00:1", "::ffff:a00:1"]) {
      expect(isPrivateNetworkAddress(address)).toBe(true);
    }
    expect(isPrivateNetworkAddress("8.8.8.8")).toBe(false);
    expect(() => assertCandidateImageUrl("https://127.0.0.1/image.jpg", null)).toThrow("private/local");
    expect(() => assertCandidateImageUrl("https://localhost/image.jpg", null)).toThrow("private/local");
  });
});
