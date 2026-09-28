import { NextRequest } from "next/server";
import { describe, expect, it, vi } from "vitest";
import { UserDataError } from "@/lib/user/errors";
import { createMergeSavedPost } from "./handler";

const REF = { kind: "artist" as const, id: "22222222-2222-4222-8222-222222222222" };

function request(body: unknown, contentType = "application/json") {
  return new NextRequest("http://localhost:3000/api/user/saved/merge", {
    method: "POST",
    headers: { "content-type": contentType },
    body: JSON.stringify(body),
  });
}

describe("POST /api/user/saved/merge", () => {
  it("passes refs to the authenticated service without a userId", async () => {
    const merge = vi.fn().mockResolvedValue({ merged: [REF], failed: [] });
    const response = await createMergeSavedPost(merge)(request({ refs: [REF] }));
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ merged: [REF], failed: [] });
    expect(merge).toHaveBeenCalledWith([REF]);
  });

  it.each([
    { body: { refs: [REF], userId: "11111111-1111-4111-8111-111111111111" }, label: "extra userId" },
    { body: {}, label: "missing refs" },
    { body: { refs: REF }, label: "non-array refs" },
  ])("rejects $label", async ({ body }) => {
    const merge = vi.fn();
    const response = await createMergeSavedPost(merge)(request(body));
    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: { code: "invalid_input", retryable: false } });
    expect(merge).not.toHaveBeenCalled();
  });

  it("rejects non-JSON requests", async () => {
    const response = await createMergeSavedPost(vi.fn())(request({ refs: [REF] }, "text/plain"));
    expect(response.status).toBe(400);
  });

  it("returns a safe 401 without raw session details", async () => {
    const merge = vi.fn().mockRejectedValue(new UserDataError("unauthenticated"));
    const response = await createMergeSavedPost(merge)(request({ refs: [REF] }));
    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ error: { code: "unauthenticated", retryable: false } });
  });

  it("maps unknown failures to a safe retryable response", async () => {
    const merge = vi.fn().mockRejectedValue(new Error("raw provider token"));
    const response = await createMergeSavedPost(merge)(request({ refs: [REF] }));
    expect(response.status).toBe(503);
    expect(JSON.stringify(await response.json())).toBe(JSON.stringify({ error: { code: "temporary", retryable: true } }));
  });
});
