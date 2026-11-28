import { describe, expect, it } from "vitest";
import { parseVercelEnvListJson, sanitizeVercelEnvMetadata } from "./lib/vercel-env-metadata.mjs";

describe("safe Vercel environment metadata projection", () => {
  it("emits only allowlisted metadata and drops every value-shaped field", () => {
    const secret = "synthetic-plaintext-secret";
    const encrypted = "synthetic-encrypted-payload";
    const token = "synthetic-access-token";
    const cookie = "synthetic-cookie";
    const output = sanitizeVercelEnvMetadata({
      envs: [{
        id: "env_123",
        key: "SUPABASE_SERVICE_ROLE_KEY",
        type: "encrypted",
        target: ["production"],
        gitBranch: null,
        value: secret,
        encryptedValue: encrypted,
        token,
        cookie,
        nested: { secret },
      }],
    });
    const printed = JSON.stringify(output);

    expect(output).toEqual([{
      id: "env_123",
      key: "SUPABASE_SERVICE_ROLE_KEY",
      type: "encrypted",
      target: ["production"],
      gitBranch: null,
      configured: true,
    }]);
    expect(printed).not.toContain(secret);
    expect(printed).not.toContain(encrypted);
    expect(printed).not.toContain(token);
    expect(printed).not.toContain(cookie);
  });

  it("does not include raw output in parse errors", () => {
    const secret = "synthetic-secret-that-must-not-escape";
    expect(() => parseVercelEnvListJson(`not-json ${secret}`)).toThrow("Vercel CLI returned invalid JSON metadata.");
    try {
      parseVercelEnvListJson(`not-json ${secret}`);
    } catch (error) {
      expect(String(error)).not.toContain(secret);
    }
  });
});
