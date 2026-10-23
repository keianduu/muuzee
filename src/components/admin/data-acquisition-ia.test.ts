import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const read = (file: string) => readFileSync(new URL(file, import.meta.url), "utf8");

describe("Data Acquisition unified IA", () => {
  it("keeps one canonical entry with all seven operator concepts", () => {
    const page = read("../../app/admin/imports/page.tsx");
    const daily = read("./daily-sync-form.tsx");
    const resolution = read("./targeted-resolution-form.tsx");
    const refresh = read("./venue-periodic-refresh-form.tsx");
    const backfill = read("./import-form.tsx");
    const content = [page, daily, resolution, refresh, backfill].join("\n");
    expect(page).toContain("<h1>データ取り込み</h1>");
    for (const label of [
      "取り込み状況を確認する",
      "展示会データを更新する",
      "Venue / Artist情報を確認する",
      "Venue / Artist / Worksを定期更新する",
      "データごとの反映ルールを確認する",
      "過去データを一括取り込みする",
      "取り込み履歴を確認する",
    ]) expect(content).toContain(label);
    expect(page).toContain('href="/admin/imports/summary"');
    expect(page).toContain('href="/admin/sources"');
  });

  it("preserves the current execution boundaries and distinguishes Daily Sync from Backfill", () => {
    const daily = read("./daily-sync-form.tsx");
    const resolution = read("./targeted-resolution-form.tsx");
    const backfill = read("./import-form.tsx");
    expect(daily).toContain('fetch("/api/admin/imports/daily-sync"');
    expect(daily).toContain("変更があるデータだけを更新します");
    expect(resolution).toContain('fetch("/api/admin/imports/targeted-resolution"');
    expect(resolution).toContain("dryRun, batchSize: 10");
    expect(backfill).toContain('fetch("/api/admin/imports"');
    expect(backfill).toContain("通常の毎日更新では使いません");
  });

  it("keeps the operation stack as the single spacing owner and uses white card surfaces", () => {
    const styles = read("../../app/globals.css");
    const refresh = read("./venue-periodic-refresh-form.tsx");
    expect(styles).toContain(".data-acquisition-operation-stack { display: grid; gap: var(--admin-space-section); }");
    expect(styles).toContain(".data-acquisition-operation-stack > .data-acquisition-operation { background: var(--white); }");
    expect(styles).toContain(".data-acquisition-operation-stack > .resolution-worker { margin: 0; }");
    expect(styles).toContain(".data-acquisition-operation .metric { background: var(--white); }");
    expect(refresh).toContain('id="master-refresh"');
    expect(refresh).toContain('fetch("/api/admin/imports/master-refresh/venue"');
    expect(refresh).toContain("事前確認");
    expect(refresh).toContain("更新する");
    expect(refresh).toContain("ID要確認");
    expect(refresh).toContain("identityAmbiguities");
    expect(refresh).toContain("sourceRowsScanned");
    expect(refresh).toContain("scanTruncated");
    expect(refresh).toContain("reachedCorpusEnd");
    expect(refresh).toContain("coverageContinues");
    expect(refresh).toContain("次回は続きから確認します");
    expect(refresh).toContain("次回は先頭から確認します");
    expect(refresh).toContain("Order 150");
    expect(refresh).toContain("Order 160");
    expect(refresh.match(/<button/g)).toHaveLength(2);
  });

  it("keeps Presentation and Media policy safety visible", () => {
    const page = read("../../app/admin/imports/page.tsx");
    const policy = read("./source-policy-table.tsx");
    expect(page).toContain("Work PresentationとMedia / Imageは常にReview Requiredです");
    expect(policy).toContain('policy.assertion_type === "work_presentation" || policy.assertion_type === "media"');
    expect(policy).toContain("disabled={busy === key || reviewOnly}");
  });
});
