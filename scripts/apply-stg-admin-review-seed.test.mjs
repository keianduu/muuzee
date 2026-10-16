import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  APPROVED_STG_PROJECT_REF,
  createSyntheticPng,
  FIXTURE_COUNTS,
  FIXTURE_UUID_PREFIX,
  fixtureMediaObjects,
  fixtureUuid,
  parseFixtureArguments,
  validateLocalConfiguration,
  validateStgConfiguration,
} from "./apply-stg-admin-review-seed.mjs";

const seed = readFileSync(new URL("../supabase/seeds/stg_admin_review.sql", import.meta.url), "utf8");
const cleanup = readFileSync(new URL("../supabase/seeds/stg_admin_review_cleanup.sql", import.meta.url), "utf8");

describe("STG Admin Review Fixture safety", () => {
  it("requires an explicit single target", () => {
    expect(() => parseFixtureArguments([])).toThrow("Exactly one explicit target");
    expect(() => parseFixtureArguments(["--local", "--stg"])).toThrow("Exactly one explicit target");
    expect(() => parseFixtureArguments(["--stg", "--force"])).toThrow("Unexpected argument");
    expect(parseFixtureArguments(["--local", "--cleanup"])).toEqual({ target: "local", cleanup: true });
  });

  it("accepts only the approved STG project identity", () => {
    expect(validateStgConfiguration({
      projectRef: APPROVED_STG_PROJECT_REF,
      databaseUrl: `postgresql://postgres.${APPROVED_STG_PROJECT_REF}:secret@aws-0-ap-northeast-1.pooler.supabase.com:5432/postgres`,
      supabaseUrl: `https://${APPROVED_STG_PROJECT_REF}.supabase.co`,
    }).api.hostname).toBe(`${APPROVED_STG_PROJECT_REF}.supabase.co`);
    expect(() => validateStgConfiguration({
      projectRef: "unexpected-project",
      databaseUrl: "postgresql://postgres.unexpected:secret@db.example.com/postgres",
      supabaseUrl: "https://unexpected-project.supabase.co",
    })).toThrow("MUUZEE_STG_PROJECT_REF");
  });

  it("rejects non-local LOCAL targets", () => {
    expect(() => validateLocalConfiguration({ supabaseUrl: "https://example.supabase.co", vercel: null, nodeEnv: "development" })).toThrow("LOCAL fixture target");
    expect(() => validateLocalConfiguration({ supabaseUrl: "http://127.0.0.1:54321", vercel: "1", nodeEnv: "development" })).toThrow("Production/Vercel");
  });

  it("keeps stable unique IDs and exact fixture media ownership", () => {
    const allMasterIds = ["venue", "artist", "work", "exhibition"].flatMap((entity) =>
      Array.from({ length: 56 }, (_, index) => fixtureUuid(entity, index + 1)),
    );
    expect(allMasterIds).toHaveLength(224);
    expect(new Set(allMasterIds).size).toBe(224);
    expect(allMasterIds.every((id) => id.startsWith(FIXTURE_UUID_PREFIX))).toBe(true);

    const media = fixtureMediaObjects();
    expect(media).toHaveLength(FIXTURE_COUNTS.mediaAssets);
    expect(new Set(media.map((object) => object.storagePath)).size).toBe(media.length);
    expect(media.every((object) => object.ownerId.startsWith(FIXTURE_UUID_PREFIX) && object.storagePath.startsWith("stg-admin-review/"))).toBe(true);
  });

  it("generates valid deterministic PNG fixture bytes without an external image dependency", () => {
    const first = createSyntheticPng(0);
    expect(first.subarray(0, 8)).toEqual(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
    expect(createSyntheticPng(0)).toEqual(first);
    expect(createSyntheticPng(1)).not.toEqual(first);
  });

  it("defines the required volumes and uses exact-owner cleanup without destructive shortcuts", () => {
    expect(FIXTURE_COUNTS).toMatchObject({
      exhibitions: 56,
      venues: 56,
      artists: 56,
      works: 56,
      venueMentions: 2,
      artistMentions: 2,
    });
    expect(seed).toContain("generate_series(1, 56)");
    expect(seed.match(/publication_status in \('draft', 'ready'\)/g)).toHaveLength(4);
    expect(seed.match(/unpublished count mismatch/g)).toHaveLength(4);
    expect(seed).toContain("Order 325.9 Cluster A missing");
    expect(seed).toContain("Order 325.9 Cluster D missing");
    expect(cleanup).toContain("32590000-0000-4325-8325-");
    expect(cleanup).not.toMatch(/truncate/i);
    expect(cleanup).not.toMatch(/where\s+(name|title)\s+like/i);
  });
});
