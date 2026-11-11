import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import { submitAdminLogin } from "./login";

describe("Admin login client", () => {
  it("posts credentials to the existing Auth API and returns the Admin destination", async () => {
    const request = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      ok: true,
      status: "authenticated",
    }), { status: 200 }));

    await expect(submitAdminLogin({
      email: "operator@example.com",
      password: "not-logged-password",
    }, request)).resolves.toEqual({ ok: true, redirectTo: "/admin" });

    const [url, init] = request.mock.calls[0];
    expect(url).toBe("/api/auth/login");
    expect(url).not.toContain("operator@example.com");
    expect(url).not.toContain("not-logged-password");
    expect(init).toMatchObject({ method: "POST" });
    expect(JSON.parse(String(init.body))).toEqual({
      email: "operator@example.com",
      password: "not-logged-password",
    });
  });

  it("shows safe credential and temporary errors without provider detail", async () => {
    const rejected = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      ok: false,
      error: { code: "invalid_credentials", provider_message: "raw secret detail" },
    }), { status: 401 }));
    const unavailable = vi.fn().mockRejectedValue(new Error("network provider detail"));

    const invalid = await submitAdminLogin({ email: "x@example.com", password: "bad" }, rejected);
    const temporary = await submitAdminLogin({ email: "x@example.com", password: "bad" }, unavailable);
    expect(invalid).toEqual({ ok: false, message: "メールアドレスまたはパスワードが正しくありません。" });
    expect(temporary).toEqual({ ok: false, message: "ログインできませんでした。時間をおいて再度お試しください。" });
    expect(JSON.stringify([invalid, temporary])).not.toContain("provider detail");
  });

  it("keeps credentials out of query strings and browser logging", () => {
    const source = readFileSync(join(
      process.cwd(),
      "src/app/(admin-public)/admin/login/admin-login-form.tsx",
    ), "utf8");
    expect(source).toContain("submitAdminLogin");
    expect(source).toContain("router.replace(result.redirectTo)");
    expect(source).not.toContain("console.");
    expect(source).not.toContain("URLSearchParams");
  });
});
