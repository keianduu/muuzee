import { describe, expect, it } from "vitest";
import { isExhibitionPublicationAction } from "@/lib/admin/exhibition-publication-action";
import { POST } from "./route";

describe("exhibition publication actions", () => {
  it("accepts only publish and unpublish", () => {
    expect(isExhibitionPublicationAction("publish")).toBe(true);
    expect(isExhibitionPublicationAction("unpublish")).toBe(true);
    expect(isExhibitionPublicationAction("ready")).toBe(false);
  });

  it("rejects the legacy ready action at the API boundary", async () => {
    const response = await POST(new Request("http://localhost/api/admin/exhibitions/11111111-1111-4111-8111-111111111111/publication", {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "ready" }),
    }), { params: Promise.resolve({ id: "11111111-1111-4111-8111-111111111111" }) });
    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({ error: "Invalid publication action" });
  });
});
