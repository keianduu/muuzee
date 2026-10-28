import { EventEmitter } from "node:events";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { fetchJson } from "./fetch-json";

const httpsGet = vi.hoisted(() => vi.fn());

vi.mock("node:https", () => ({ get: httpsGet }));

describe("fetchJson native fallback boundary", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    httpsGet.mockReset();
  });

  it("does not start native HTTPS fallback when disabled", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("undici unavailable")));

    await expect(fetchJson("https://example.test/data", {
      timeoutMs: 10,
      retries: 0,
      nativeFallback: false,
    })).rejects.toThrow("undici unavailable");
    expect(httpsGet).not.toHaveBeenCalled();
  });

  it("preserves native HTTPS fallback by default for LOCAL callers", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("undici unavailable")));
    httpsGet.mockImplementation((_input, _options, callback) => {
      const response = new EventEmitter() as EventEmitter & { statusCode: number };
      response.statusCode = 200;
      const request = new EventEmitter() as EventEmitter & { destroy: (error: Error) => void };
      request.destroy = (error) => request.emit("error", error);
      queueMicrotask(() => {
        callback(response);
        response.emit("data", Buffer.from('{"ok":true}'));
        response.emit("end");
      });
      return request;
    });

    await expect(fetchJson<{ ok: boolean }>("https://example.test/data", { retries: 0 })).resolves.toEqual({ ok: true });
    expect(httpsGet).toHaveBeenCalledOnce();
  });
});
