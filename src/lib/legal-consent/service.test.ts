import { describe, expect, it, vi } from "vitest";
import { listLegalConsents, recordLegalConsent } from "./service";

const viewer = {
  id: "25100000-0000-4000-8000-000000000001",
};

describe("Legal Consent service", () => {
  it("derives user and timestamp server-side and treats an exact duplicate as a no-op", async () => {
    const insert = vi.fn().mockResolvedValue({
      error: {
        code: "23505",
        message: "duplicate key violates user_legal_consents_user_id_consent_type_document_version_key",
      },
    });
    const dependencies = {
      viewerClient: {
        auth: { getUser: vi.fn().mockResolvedValue({ data: { user: viewer }, error: null }) },
      },
      writerClient: { from: vi.fn(() => ({ insert })) },
    } as never;

    await expect(recordLegalConsent({
      consentType: "privacy",
      documentVersion: "privacy-2026-09",
    }, dependencies)).resolves.toBeUndefined();

    expect(insert).toHaveBeenCalledWith(expect.objectContaining({
      user_id: viewer.id,
      consent_type: "privacy",
      document_version: "privacy-2026-09",
      consented_at: expect.any(String),
    }));
  });

  it("rejects caller-controlled or invalid consent fields", async () => {
    await expect(recordLegalConsent({
      consentType: "marketing",
      documentVersion: "v1",
    } as never, {} as never)).rejects.toThrow("invalid_input");
    await expect(recordLegalConsent({
      consentType: "terms",
      documentVersion: "v1",
      userId: viewer.id,
    } as never, {} as never)).rejects.toThrow("invalid_input");
  });

  it("does not swallow an unrelated unique violation", async () => {
    const dependencies = {
      viewerClient: {
        auth: { getUser: vi.fn().mockResolvedValue({ data: { user: viewer }, error: null }) },
      },
      writerClient: {
        from: vi.fn(() => ({
          insert: vi.fn().mockResolvedValue({ error: { code: "23505", message: "another constraint" } }),
        })),
      },
    } as never;
    await expect(recordLegalConsent({
      consentType: "terms",
      documentVersion: "v1",
    }, dependencies)).rejects.toThrow("temporary");
  });

  it("reads only the fresh viewer's RLS-scoped history", async () => {
    const order = vi.fn().mockResolvedValue({
      data: [{
        id: "25110000-0000-4000-8000-000000000001",
        consent_type: "terms",
        document_version: "terms-2026-09",
        consented_at: "2026-09-28T00:00:00.000Z",
      }],
      error: null,
    });
    const eq = vi.fn(() => ({ order }));
    const select = vi.fn(() => ({ eq }));
    const client = {
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: viewer }, error: null }) },
      from: vi.fn(() => ({ select })),
    } as never;

    await expect(listLegalConsents(client)).resolves.toEqual([{
      id: "25110000-0000-4000-8000-000000000001",
      consentType: "terms",
      documentVersion: "terms-2026-09",
      consentedAt: "2026-09-28T00:00:00.000Z",
    }]);
    expect(eq).toHaveBeenCalledWith("user_id", viewer.id);
  });
});
