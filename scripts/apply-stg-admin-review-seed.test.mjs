import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";
import {
  APPROVED_STG_PROJECT_REF,
  applyFixtureSafely,
  classifyFixtureState,
  createSyntheticPng,
  FIXTURE_COUNTS,
  FIXTURE_DB_COUNTS,
  FIXTURE_STATE,
  FIXTURE_UUID_PREFIX,
  fixtureMediaObjects,
  fixtureUuid,
  parseFixtureArguments,
  validateLocalConfiguration,
  validateStgConfiguration,
} from "./apply-stg-admin-review-seed.mjs";

const seed = readFileSync(new URL("../supabase/seeds/stg_admin_review.sql", import.meta.url), "utf8");
const cleanup = readFileSync(new URL("../supabase/seeds/stg_admin_review_cleanup.sql", import.meta.url), "utf8");
const stateQuery = readFileSync(new URL("../supabase/seeds/stg_admin_review_state.sql", import.meta.url), "utf8");

function fixtureState(classification, overrides = {}) {
  return {
    classification,
    dbCounts: Object.fromEntries(Object.keys(FIXTURE_DB_COUNTS).map((key) => [key, classification === FIXTURE_STATE.COMPLETE ? FIXTURE_DB_COUNTS[key] : 0])),
    storagePaths: classification === FIXTURE_STATE.COMPLETE ? fixtureMediaObjects().map((object) => object.storagePath) : [],
    ...overrides,
  };
}

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

  it("accepts only exact CLEAN or COMPLETE fixture states", () => {
    const completeCounts = fixtureState(FIXTURE_STATE.COMPLETE).dbCounts;
    const expectedPaths = fixtureMediaObjects().map((object) => object.storagePath);
    expect(classifyFixtureState({ dbCounts: fixtureState(FIXTURE_STATE.CLEAN).dbCounts, storagePaths: [] })).toBe(FIXTURE_STATE.CLEAN);
    expect(classifyFixtureState({ dbCounts: completeCounts, storagePaths: expectedPaths })).toBe(FIXTURE_STATE.COMPLETE);
    expect(classifyFixtureState({ dbCounts: { ...completeCounts, venues: 55 }, storagePaths: expectedPaths })).toBe(FIXTURE_STATE.PARTIAL);
    expect(classifyFixtureState({ dbCounts: completeCounts, storagePaths: expectedPaths.slice(1) })).toBe(FIXTURE_STATE.PARTIAL);
    expect(classifyFixtureState({ dbCounts: completeCounts, storagePaths: [...expectedPaths, "stg-admin-review/unexpected.png"] })).toBe(FIXTURE_STATE.PARTIAL);
  });

  it("compensates Storage after a failed CLEAN apply and verifies CLEAN state", async () => {
    const calls = [];
    await expect(applyFixtureSafely({
      initialState: fixtureState(FIXTURE_STATE.CLEAN),
      upload: async () => calls.push("upload"),
      seed: async () => {
        calls.push("seed");
        throw new Error("forced SQL failure");
      },
      remove: async () => calls.push("remove"),
      inspect: async () => {
        calls.push("inspect");
        return fixtureState(FIXTURE_STATE.CLEAN);
      },
    })).rejects.toThrow("forced SQL failure");
    expect(calls).toEqual(["upload", "seed", "remove", "inspect"]);
  });

  it("compensates deterministic paths after a partial CLEAN upload failure", async () => {
    const calls = [];
    const seed = vi.fn();
    await expect(applyFixtureSafely({
      initialState: fixtureState(FIXTURE_STATE.CLEAN),
      upload: async () => {
        calls.push("upload");
        throw new Error("forced upload failure");
      },
      seed,
      remove: async () => calls.push("remove"),
      inspect: async () => {
        calls.push("inspect");
        return fixtureState(FIXTURE_STATE.CLEAN);
      },
    })).rejects.toThrow("forced upload failure");
    expect(seed).not.toHaveBeenCalled();
    expect(calls).toEqual(["upload", "remove", "inspect"]);
  });

  it("does not remove a pre-existing COMPLETE fixture after a failed reapply", async () => {
    const calls = [];
    await expect(applyFixtureSafely({
      initialState: fixtureState(FIXTURE_STATE.COMPLETE),
      upload: async () => calls.push("upload"),
      seed: async () => {
        calls.push("seed");
        throw new Error("forced reapply failure");
      },
      remove: async () => calls.push("remove"),
      inspect: async () => {
        calls.push("inspect");
        return fixtureState(FIXTURE_STATE.COMPLETE);
      },
    })).rejects.toThrow("forced reapply failure");
    expect(calls).toEqual(["upload", "seed", "inspect"]);
  });

  it("rejects PARTIAL apply before upload", async () => {
    const upload = vi.fn();
    await expect(applyFixtureSafely({
      initialState: fixtureState(FIXTURE_STATE.PARTIAL),
      upload,
      seed: vi.fn(),
      remove: vi.fn(),
      inspect: vi.fn(),
    })).rejects.toThrow("explicit cleanup is required");
    expect(upload).not.toHaveBeenCalled();
  });

  it("generates valid deterministic PNG fixture bytes without an external image dependency", () => {
    const first = createSyntheticPng(0);
    expect(first.subarray(0, 8)).toEqual(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
    expect(createSyntheticPng(0)).toEqual(first);
    expect(createSyntheticPng(1)).not.toEqual(first);
  });

  it("uses a public HTTPS raster for every actionable image Candidate", () => {
    expect(seed).toContain("https://raw.githubusercontent.com/keianduu/muuzee/main/prototype/assets/images/exhibitions/exhibition-");
    expect(seed).toContain("candidate_image_url");
    const candidateSection = seed.slice(seed.indexOf("with candidate_matrix"), seed.indexOf("with media_matrix"));
    expect(candidateSection).not.toContain("/fixtures/order3259-review-");
    expect(candidateSection).not.toContain(".svg");
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
    expect(seed).toContain("Order 325.9 approved Media count mismatch");
    expect(seed).toContain("Order 325.9 Candidate Rights matrix mismatch");
    expect(stateQuery).toContain("approvedMediaAssets");
    expect(stateQuery).toContain("candidateRightsStates");
    expect(cleanup).toContain("32590000-0000-4325-8325-");
    for (const table of [
      "data_sources",
      "venues",
      "artists",
      "works",
      "exhibitions",
      "source_records",
      "source_image_candidates",
      "media_assets",
      "exhibition_occurrences",
      "exhibition_artists",
      "exhibition_venue_mentions",
      "exhibition_artist_mentions",
      "work_artists",
      "collection_holdings",
      "work_presentations",
    ]) {
      expect(cleanup).toContain(`public.${table}`);
      expect(stateQuery).toContain(`public.${table}`);
    }
    expect(cleanup).not.toMatch(/truncate/i);
    expect(cleanup).not.toMatch(/where\s+(name|title)\s+like/i);
  });
});
