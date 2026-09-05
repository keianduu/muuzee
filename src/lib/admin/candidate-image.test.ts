import { describe, expect, it } from "vitest";
import { assertCandidateImageResponse, assertCandidateImageSize, assertCandidateImageUrl, candidateImageExtension } from "./candidate-image";

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
});
