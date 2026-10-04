import { beforeEach, describe, expect, it, vi } from "vitest";
import { assertCandidateImageUrl, downloadCandidateImage } from "@/lib/admin/candidate-image";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { POST } from "./route";

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/admin/candidate-image", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/admin/candidate-image")>();
  return { ...actual, assertCandidateImageUrl: vi.fn(actual.assertCandidateImageUrl), downloadCandidateImage: vi.fn() };
});
vi.mock("@/lib/supabase/admin", () => ({ createSupabaseAdminClient: vi.fn() }));

const venueId = "11111111-1111-4111-8111-111111111111";

function fluent(result: Record<string, unknown>, singleData: Record<string, unknown>) {
  const query: Record<string, unknown> = {};
  for (const method of ["eq", "insert", "update", "select"]) query[method] = vi.fn(() => query);
  query.single = vi.fn(async () => ({ data: singleData, error: null }));
  query.then = (resolve: (value: unknown) => unknown) => Promise.resolve(result).then(resolve);
  return query;
}

function mockDb(registeredCount = 0) {
  const asset = { id: "22222222-2222-4222-8222-222222222222", venue_id: venueId, exhibition_id: null, artist_id: null, work_id: null, kind: "image", storage_path: "venues/test.png", original_filename: "venue.png", source_type: "other", source_url: null, credit: null, usage_note: null, reported_license: null, reported_license_url: null, reported_author: null, reported_usage_terms: null, rights_status: "needs_review", rights_checked_at: null, valid_until: null, is_primary: registeredCount === 0, created_at: "2026-10-04T00:00:00Z" };
  const mediaQuery = fluent({ count: registeredCount, error: null }, asset);
  const upload = vi.fn(async () => ({ error: null }));
  const remove = vi.fn(async () => ({ error: null }));
  const createSignedUrl = vi.fn(async () => ({ data: { signedUrl: "https://signed.example/venue.png" }, error: null }));
  const db = {
    from: vi.fn(() => mediaQuery),
    storage: { from: vi.fn(() => ({ upload, remove, createSignedUrl })) },
  };
  vi.mocked(createSupabaseAdminClient).mockReturnValue(db as never);
  return { db, mediaQuery, upload, remove };
}

function request(form: FormData) {
  return new Request(`http://localhost/api/admin/venues/${venueId}/media`, { method: "POST", body: form });
}

const context = { params: Promise.resolve({ id: venueId }) };

describe("Venue media registration route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(assertCandidateImageUrl).mockImplementation((value) => new URL(value));
  });

  it("preserves the existing local file upload path and does not download the URL", async () => {
    const { mediaQuery, upload } = mockDb();
    const form = new FormData();
    form.set("file", new File([new Uint8Array([1, 2, 3])], "venue.png", { type: "image/png" }));
    form.set("image_url", "https://example.com/ignored.jpg");
    form.set("source_type", "other");
    form.set("rights_status", "needs_review");

    const response = await POST(request(form), context);
    expect(response.status).toBe(200);
    expect(downloadCandidateImage).not.toHaveBeenCalled();
    expect(upload).toHaveBeenCalledWith(expect.stringMatching(/\.png$/), expect.any(File), expect.objectContaining({ contentType: "image/png" }));
    expect(mediaQuery.insert).toHaveBeenCalledWith(expect.objectContaining({ original_filename: "venue.png", source_url: null, is_primary: true }));
    await expect(response.json()).resolves.toMatchObject({ asset: { is_primary: true, signedUrl: "https://signed.example/venue.png" } });
  });

  it("downloads an HTTPS image, stores bytes privately, and records the entered URL", async () => {
    const { mediaQuery, upload } = mockDb();
    vi.mocked(downloadCandidateImage).mockResolvedValue({ bytes: Buffer.from([1, 2, 3]), contentType: "image/png", extension: "png" });
    const form = new FormData();
    form.set("image_url", "https://images.example.com/venue.png");
    form.set("source_type", "other");
    form.set("rights_status", "needs_review");

    const response = await POST(request(form), context);
    expect(response.status).toBe(200);
    expect(downloadCandidateImage).toHaveBeenCalledWith(new URL("https://images.example.com/venue.png"), 30_000);
    expect(upload).toHaveBeenCalledWith(expect.stringMatching(/\.png$/), expect.any(Buffer), expect.objectContaining({ contentType: "image/png" }));
    expect(mediaQuery.insert).toHaveBeenCalledWith(expect.objectContaining({ original_filename: "venue.png", source_url: "https://images.example.com/venue.png" }));
  });

  it("does not trust the client primary field when a registered asset already exists", async () => {
    const { mediaQuery } = mockDb(1);
    const form = new FormData();
    form.set("file", new File([new Uint8Array([1])], "venue.png", { type: "image/png" }));
    form.set("source_type", "other");
    form.set("rights_status", "needs_review");
    form.set("is_primary", "true");

    const response = await POST(request(form), context);
    expect(response.status).toBe(200);
    expect(mediaQuery.insert).toHaveBeenCalledWith(expect.objectContaining({ is_primary: false }));
  });

  it("fails before Storage upload when URL validation rejects a private target", async () => {
    const { upload } = mockDb();
    vi.mocked(assertCandidateImageUrl).mockImplementation(() => { throw new Error("候補画像URLにprivate/local networkは指定できません。"); });
    const form = new FormData();
    form.set("image_url", "https://127.0.0.1/private.png");
    form.set("source_type", "other");
    form.set("rights_status", "needs_review");

    const response = await POST(request(form), context);
    expect(response.status).toBe(400);
    expect(upload).not.toHaveBeenCalled();
  });
});
