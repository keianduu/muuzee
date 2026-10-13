import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const repository = readFileSync(new URL("./master-repository.ts", import.meta.url), "utf8");
const list = repository.slice(repository.indexOf("export const MASTER_LIST_SELECTS"), repository.indexOf("function asRecords"));
const core = repository.slice(repository.indexOf("export const MASTER_DETAIL_CORE_SELECTS"), repository.indexOf("export const MASTER_DETAIL_DATA_SELECTS"));
const data = repository.slice(repository.indexOf("export const MASTER_DETAIL_DATA_SELECTS"), repository.indexOf("export const MASTER_LIST_SELECTS"));

describe("Admin master performance boundaries", () => {
  it("keeps heavy diagnostics out of the initial detail contract", () => {
    expect(core).not.toContain("venue_coordinate_candidates(*)");
    expect(core).not.toContain("venue_external_match_candidates(*)");
    expect(core).not.toContain("artist_external_match_candidates(*)");
    expect(core).not.toContain("source_image_candidates(*)");
    expect(data).toContain("venue_coordinate_candidates(*)");
    expect(data).toContain("source_image_candidates(*)");
  });

  it("keeps raw payloads and full candidate rows out of list contracts", () => {
    expect(list).not.toContain("raw_payload");
    expect(list).not.toContain("source_image_candidates(*)");
    expect(list).not.toContain("media_assets(*)");
  });

  it("uses a dedicated lightweight list-row endpoint after preserved-order mutations", () => {
    const component = readFileSync(new URL("../../components/admin/master-list.tsx", import.meta.url), "utf8");
    expect(component).toContain("/${detail.id}/list-row");
    expect(component).not.toContain("/${detail.id}`, { cache: \"no-store\" }");
  });

  it("keeps immediate media state and skips unrelated Data invalidation", () => {
    for (const file of ["../../components/admin/master-editor.tsx", "../../components/admin/venue-editor.tsx"]) {
      const component = readFileSync(new URL(file, import.meta.url), "utf8");
      expect(component).toContain("dispatchAdminMediaMutation");
      expect(component).toContain("invalidateData: false");
    }
  });
});
