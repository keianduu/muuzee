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

function fluent(result: Record<string, unknown>) {
  const query: Record<string, unknown> = {};
  for (const method of ["eq", "insert", "update"]) query[method] = vi.fn(() => query);
  query.then = (resolve: (value: unknown) => unknown) => Promise.resolve(result).then(resolve);
  return query;
}

function mockDb() {
  const mediaQuery = fluent({ error: null });
  const upload = vi.fn(async () => ({ error: null }));
  const remove = vi.fn(async () => ({ error: null }));
  const db = {
    from: vi.fn(() => mediaQuery),
    storage: { from: vi.fn(() => ({ upload, remove })) },
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
    expect(mediaQuery.insert).toHaveBeenCalledWith(expect.objectContaining({ original_filename: "venue.png", source_url: null }));
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
