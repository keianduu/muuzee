import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const read = (file: string) => readFileSync(new URL(file, import.meta.url), "utf8");

describe("Data Acquisition unified IA", () => {
  it("renders exactly the two operator-first top-level operations", () => {
    const page = read("../../app/admin/imports/page.tsx");
    const master = read("./master-data-operation-card.tsx");
    const exhibition = read("./exhibition-data-operation-card.tsx");
    const daily = read("./daily-sync-form.tsx");
    const resolution = read("./targeted-resolution-form.tsx");
    const refresh = read("./venue-periodic-refresh-form.tsx");
    const content = [page, master, exhibition, daily, resolution, refresh].join("\n");
    expect(page).toContain("<h1>データ取り込み</h1>");
    expect(master).toContain("Masterデータ");
    expect(exhibition).toContain("展示会データを更新する");
    expect(page.match(/OperationCard/g)).toHaveLength(4);
    for (const label of ["Venue", "Artist", "Works", "Master total", "公開", "非公開"]) expect(master).toContain(label);
    expect(master).toContain("/admin/imports/summary?entity=${overview.entity}");
    for (const entity of ["venues", "artists", "works"]) expect(master).toContain(`${entity}:`);
    expect(exhibition).toContain("?entity=exhibitions");
    for (const removed of ["取り込み状況を確認する", "Venue / Artist情報を確認する", "Venue / Artist / Worksを定期更新する", "データごとの反映ルールを確認する", "過去データを一括取り込みする", "取り込み履歴を確認する"]) expect(content).not.toContain(removed);
  });

  it("preserves the current execution boundaries without exposing Backfill or Source Policy", () => {
    const page = read("../../app/admin/imports/page.tsx");
    const daily = read("./daily-sync-form.tsx");
    const resolution = read("./targeted-resolution-form.tsx");
    const refresh = read("./venue-periodic-refresh-form.tsx");
    const backfill = read("./import-form.tsx");
    expect(daily).toContain('fetch("/api/admin/imports/daily-sync"');
    expect(daily).toContain("変更内容を確認");
    expect(daily).toContain("展示会データを更新する");
    expect(resolution).toContain('fetch("/api/admin/imports/targeted-resolution"');
    expect(resolution).toContain("dryRun, batchSize: 10");
    expect(resolution).toContain("解決内容を確認");
    expect(refresh).toContain('fetch("/api/admin/imports/master-refresh/venue"');
    expect(refresh).toContain("変更内容を確認");
    expect(refresh).toContain("情報を更新する");
    expect(backfill).toContain('fetch("/api/admin/imports"');
    expect(page).not.toContain("ImportForm");
    expect(page).not.toContain("SourcePolicy");
    expect(page).not.toContain("getImportRuns");
  });

  it("keeps the operation stack as the single 32px spacing owner and uses white card surfaces", () => {
    const styles = read("../../app/globals.css");
    const master = read("./master-data-operation-card.tsx");
    expect(styles).toContain(".data-acquisition-operation-stack { display: grid; gap: var(--admin-space-section); }");
    expect(styles).toContain(".data-acquisition-operation-stack > .data-acquisition-operation { background: var(--white); }");
    expect(styles).toContain("--admin-space-section: 32px");
    expect(master.match(/className=\"card /g)).toHaveLength(1);
    expect(master).not.toContain("Order 150");
    expect(master).not.toContain("Order 160");
  });

  it("keeps Presentation and Media policy safety implemented but out of the top-level UI", () => {
    const page = read("../../app/admin/imports/page.tsx");
    const policy = read("./source-policy-table.tsx");
    expect(page).not.toContain("Review Required");
    expect(policy).toContain('policy.assertion_type === "work_presentation" || policy.assertion_type === "media"');
    expect(policy).toContain("disabled={busy === key || reviewOnly}");
  });

  it("uses lightweight canonical Master counts and excludes merged Venue losers", () => {
    const query = read("../../lib/admin/data-acquisition-operator-overview.ts");
    expect(query).toContain('select("id", { count: "exact", head: true })');
    expect(query).toContain('query.is("merged_into_venue_id", null)');
    expect(query).toContain('query.eq("publication_status", "published")');
    expect(query).toContain("unpublished: Math.max(0, total - published)");
    expect(query).not.toContain("getDataAcquisitionSummary");
  });
});
