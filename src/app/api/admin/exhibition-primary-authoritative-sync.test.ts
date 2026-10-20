import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";

const harness = vi.hoisted(() => ({ db: null as SupabaseClient | null }));

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/supabase/admin", () => ({
  createSupabaseAdminClient: () => harness.db,
  hasSupabaseAdminEnvironment: () => true,
}));
vi.mock("@/lib/admin/candidate-image", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/admin/candidate-image")>();
  return {
    ...actual,
    downloadCandidateImage: vi.fn(async () => ({
      bytes: Buffer.from([137, 80, 78, 71]),
      contentType: "image/png",
      extension: "png",
    })),
  };
});

import { POST } from "@/app/api/admin/masters/[entity]/[id]/image-candidates/[candidateId]/set-primary/route";
import { GET } from "@/app/api/admin/exhibitions/[id]/route";

const EXHIBITION_ID = "32590000-0000-4325-8325-400000000007";
const CANDIDATE_ID = "32590000-0000-4325-8325-020000000301";
const SOURCE_ID = "32590000-0000-4325-8325-010000000307";

function authoritativeExhibitionDb() {
  const state = {
    media: [] as Array<Record<string, unknown>>,
    sources: [{ id: SOURCE_ID, exhibition_id: EXHIBITION_ID }] as Array<Record<string, unknown>>,
    candidates: [{
      id: CANDIDATE_ID,
      source_record_id: SOURCE_ID,
      image_url: "https://images.example.test/order3259-candidate.png",
      thumbnail_url: "https://images.example.test/order3259-candidate.png",
      provider: "muuzee_stg_admin_review_fixture",
      stable_identifier: "order3259-exhibition-7-candidate-1",
      source_url: "https://source.example.test/order3259-candidate",
      credit: "Muuzee QA Fixture",
      usage_terms: "Synthetic QA fixture.",
      license_short_name: "CC0 1.0",
      license_url: "https://creativecommons.org/publicdomain/zero/1.0/",
      author: "Muuzee QA Fixture",
      rights_status: "approved",
      review_status: "unreviewed",
      is_active: true,
    }] as Array<Record<string, unknown>>,
  };

  const exhibition = () => ({
    id: EXHIBITION_ID,
    slug: "order3259-stg-qa-exhibition-07",
    title: "[STG QA] Exhibition 07 | 1日開催・画像候補1件",
    title_en: null,
    description: null,
    exhibition_type: null,
    official_url: null,
    publication_status: "draft",
    updated_at: "2026-10-20T00:00:00Z",
    exhibition_occurrences: [{
      id: "32590000-0000-4325-8325-500000000007",
      exhibition_id: EXHIBITION_ID,
      venue_id: "32590000-0000-4325-8325-100000000001",
      start_date: "2036-02-14",
      end_date: "2036-02-14",
      venues: { id: "32590000-0000-4325-8325-100000000001", name: "[STG QA] Venue 01" },
    }],
    exhibition_artists: [],
    exhibition_artist_mentions: [],
    exhibition_venue_mentions: [],
    media_assets: state.media.map((asset) => ({ ...asset })),
    source_records: state.sources.map((source) => ({
      ...source,
      data_sources: { name: "Muuzee STG Admin Review Fixture", key: "muuzee_stg_admin_review_fixture" },
      source_image_candidates: state.candidates.map((candidate) => ({ ...candidate })),
    })),
  });

  const rowsFor = (table: string): Array<Record<string, unknown>> => {
    if (table === "media_assets") return state.media;
    if (table === "source_records") return state.sources;
    if (table === "source_image_candidates") return state.candidates;
    if (table === "exhibitions") return [exhibition()];
    return [];
  };

  const db = {
    from(table: string) {
      let operation: "select" | "update" | "insert" = "select";
      let payload: Record<string, unknown> = {};
      const filters: Array<["eq" | "neq" | "in", string, unknown]> = [];
      const matches = (row: Record<string, unknown>) => filters.every(([kind, key, value]) => {
        if (kind === "eq") return row[key] === value;
        if (kind === "neq") return row[key] !== value;
        return (value as unknown[]).includes(row[key]);
      });
      const execute = () => {
        if (operation === "insert") {
          const row = {
            id: "32590000-0000-4325-8325-030000000999",
            created_at: "2026-10-20T00:00:00Z",
            valid_until: null,
            ...payload,
          };
          rowsFor(table).push(row);
          return [row];
        }
        const matched = rowsFor(table).filter(matches);
        if (operation === "update") matched.forEach((row) => Object.assign(row, payload));
        return matched;
      };
      const query: Record<string, unknown> = {};
      query.select = () => query;
      query.insert = (value: Record<string, unknown>) => { operation = "insert"; payload = value; return query; };
      query.update = (value: Record<string, unknown>) => { operation = "update"; payload = value; return query; };
      query.eq = (key: string, value: unknown) => { filters.push(["eq", key, value]); return query; };
      query.neq = (key: string, value: unknown) => { filters.push(["neq", key, value]); return query; };
      query.in = (key: string, value: unknown[]) => { filters.push(["in", key, value]); return query; };
      query.limit = () => query;
      query.order = () => query;
      query.maybeSingle = async () => ({ data: execute()[0] || null, error: null });
      query.single = async () => ({ data: execute()[0] || null, error: null });
      query.then = (resolve: (value: { data?: unknown; error: null }) => unknown) => Promise.resolve({ data: execute(), error: null }).then(resolve);
      return query;
    },
    storage: {
      from: () => ({
        upload: vi.fn(async () => ({ error: null })),
        remove: vi.fn(async () => ({ error: null })),
        createSignedUrl: vi.fn(async (path: string) => ({ data: { signedUrl: `https://signed.example.test/${path}` }, error: null })),
      }),
    },
  } as unknown as SupabaseClient;

  return { db, state };
}

describe("Exhibition Primary authoritative write/read boundary", () => {
  let state: ReturnType<typeof authoritativeExhibitionDb>["state"];

  beforeEach(() => {
    const harnessState = authoritativeExhibitionDb();
    harness.db = harnessState.db;
    state = harnessState.state;
  });

  it("makes the immediate Detail GET observe the newly approved Primary", async () => {
    const initialResponse = await GET(new Request(`http://localhost/api/admin/exhibitions/${EXHIBITION_ID}`), {
      params: Promise.resolve({ id: EXHIBITION_ID }),
    });
    const initial = await initialResponse.json();

    expect(initial.requirements).toEqual(expect.arrayContaining([
      expect.objectContaining({ key: "primary_image", met: false }),
      expect.objectContaining({ key: "image_rights", met: false }),
    ]));
    expect(initial.canPublish).toBe(false);

    const writeResponse = await POST(
      new Request("http://localhost/api/admin/masters/exhibitions/set-primary", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ approveRights: false }),
      }),
      { params: Promise.resolve({ entity: "exhibitions", id: EXHIBITION_ID, candidateId: CANDIDATE_ID }) },
    );
    const write = await writeResponse.json();

    expect(writeResponse.status).toBe(200);
    expect(write).toMatchObject({
      changed: true,
      reason: "primary_set",
      asset: {
        id: "32590000-0000-4325-8325-030000000999",
        exhibition_id: EXHIBITION_ID,
        is_primary: true,
        rights_status: "approved",
      },
    });
    expect(state.media.filter((asset) => asset.is_primary)).toHaveLength(1);
    expect(state.candidates).toEqual([
      expect.objectContaining({ id: CANDIDATE_ID, review_status: "accepted", rights_status: "approved", is_active: true }),
    ]);

    const detailResponse = await GET(new Request(`http://localhost/api/admin/exhibitions/${EXHIBITION_ID}`), {
      params: Promise.resolve({ id: EXHIBITION_ID }),
    });
    const detail = await detailResponse.json();

    expect(detailResponse.status).toBe(200);
    expect(detail.exhibition.media_assets).toEqual([
      expect.objectContaining({ exhibition_id: EXHIBITION_ID, is_primary: true, rights_status: "approved" }),
    ]);
    expect(detail.requirements).toEqual(expect.arrayContaining([
      expect.objectContaining({ key: "primary_image", met: true }),
      expect.objectContaining({ key: "image_rights", met: true }),
    ]));
    expect(detail.canPublish).toBe(true);
  });
});
