#!/usr/bin/env node

import { execFileSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";

const ROOT = resolve(import.meta.dirname, "..");
const AS_OF = process.argv.find((arg) => arg.startsWith("--as-of="))?.split("=")[1] || "2026-09-05";
const DATABASE_CONTAINER = process.env.MUUZEE_DB_CONTAINER || "supabase_db_muuzee";
const CSV_PATH = resolve(ROOT, "tmp/venue-priority-tier-simulation.csv");
const REPORT_PATH = resolve(ROOT, "docs/research/venue-priority-tier-simulation.md");

const SQL = String.raw`
select row_to_json(result)::text
from (
  select
    v.id,
    v.name,
    v.name_en,
    v.venue_type,
    v.postal_code,
    v.address,
    v.latitude,
    v.longitude,
    v.official_url,
    v.description,
    v.opening_hours_text,
    v.closed_days_text,
    v.access_text,
    v.auto_priority_tier,
    v.manual_priority_tier,
    v.effective_priority_tier,
    v.tier_reason as persisted_tier_reason,
    coalesce(activity.total_exhibition_count, 0) as total_exhibition_count,
    coalesce(activity.past_12m_exhibition_count, 0) as past_12m_exhibition_count,
    coalesce(activity.active_now_exhibition_count, 0) as active_now_exhibition_count,
    coalesce(activity.upcoming_exhibition_count, 0) as upcoming_exhibition_count,
    activity.latest_exhibition_date,
    activity.next_exhibition_date,
    coalesce(media.has_primary_image, false) as has_primary_image,
    coalesce(media.has_approved_primary_image, false) as has_approved_primary_image,
    coalesce(images.has_image_candidate, false) as has_image_candidate,
    wikidata.raw_type_ids,
    wikidata.discovery_root_ids,
    wikidata.wikidata_description
  from public.venues v
  left join lateral (
    select
      count(distinct eo.exhibition_id)::int as total_exhibition_count,
      count(distinct eo.exhibition_id) filter (
        where eo.end_date >= date '${AS_OF}' - interval '12 months'
          and eo.start_date <= date '${AS_OF}'
      )::int as past_12m_exhibition_count,
      count(distinct eo.exhibition_id) filter (
        where eo.start_date <= date '${AS_OF}' and eo.end_date >= date '${AS_OF}'
      )::int as active_now_exhibition_count,
      count(distinct eo.exhibition_id) filter (where eo.start_date > date '${AS_OF}')::int as upcoming_exhibition_count,
      max(eo.end_date) filter (where eo.end_date < date '${AS_OF}') as latest_exhibition_date,
      min(eo.start_date) filter (where eo.start_date > date '${AS_OF}') as next_exhibition_date
    from public.exhibition_occurrences eo
    where eo.venue_id = v.id
  ) activity on true
  left join lateral (
    select
      bool_or(ma.is_primary) as has_primary_image,
      bool_or(ma.is_primary and ma.rights_status = 'approved') as has_approved_primary_image
    from public.media_assets ma
    where ma.venue_id = v.id
  ) media on true
  left join lateral (
    select bool_or(sic.is_active) as has_image_candidate
    from public.source_records sr
    join public.source_image_candidates sic on sic.source_record_id = sr.id
    where sr.venue_id = v.id
  ) images on true
  left join lateral (
    select
      sr.raw_payload #> '{normalized,rawTypeIds}' as raw_type_ids,
      sr.raw_payload #> '{normalized,discoveryRootIds}' as discovery_root_ids,
      sr.raw_payload #>> '{normalized,description}' as wikidata_description
    from public.source_records sr
    join public.data_sources ds on ds.id = sr.data_source_id
    where sr.venue_id = v.id and ds.key = 'wikidata'
    order by sr.fetched_at desc nulls last
    limit 1
  ) wikidata on true
  order by v.name, v.id
) result;
`;

function readRows() {
  const output = execFileSync("docker", [
    "exec", DATABASE_CONTAINER, "psql", "-U", "postgres", "-d", "postgres",
    "-X", "-A", "-t", "-P", "pager=off", "-v", "ON_ERROR_STOP=1", "-c", SQL,
  ], { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
  return output.split("\n").filter(Boolean).map((line) => JSON.parse(line));
}

const ART_NAME = /(美術館|美術室|画廊|ギャラリー|art museum|museum of art|art gallery)/i;
const WEAK_ART = /(アートセンター|アートスペース|芸術センター|芸術文化|文化会館|culture center|art cent(?:er|re))/i;
const CLEAR_NON_ART = /(科学博物館|科学館|自然史|鉄道|電車|航空|空港|宇宙|天文|プラネタリウム|動物園|水族館|昆虫|恐竜|自動車|オートバイ|消防|防災|警察|医学|医療|くすり|薬の|スポーツ|競馬|考古|歴史博物館|郷土博物館|民俗博物館|science museum|natural history|railway museum|aviation museum|aerospace|zoo|aquarium|archaeolog|history museum|maritime museum|sports museum|medical museum)/i;
const PUBLIC_MARKER = /(国立|都立|道立|府立|県立|市立|区立|町立|村立)/;
const USER_NAMED_A = new Set(["国立新美術館", "国立西洋美術館", "東京国立近代美術館", "東京都現代美術館", "森美術館"]);

function ids(value) {
  return new Set(Array.isArray(value) ? value.map(String) : []);
}

function classifyArt(row) {
  const typeIds = ids(row.raw_type_ids);
  const roots = ids(row.discovery_root_ids);
  const evidence = `${row.name || ""} ${row.wikidata_description || ""}`;
  const explicitArtClass = typeIds.has("Q207694") || roots.has("Q1007870");
  const artName = ART_NAME.test(evidence);
  const weakArt = WEAK_ART.test(evidence);
  const nonArt = CLEAR_NON_ART.test(evidence);
  const exhibitionEvidence = row.total_exhibition_count > 0;

  if (explicitArtClass && !nonArt) return { value: "art", reason: "Wikidata art museum / art gallery class" };
  if ((explicitArtClass || artName || row.venue_type === "gallery" || exhibitionEvidence) && nonArt) {
    return { value: "possible", reason: "Art evidence and clear non-art evidence conflict; human review required" };
  }
  if (exhibitionEvidence) return { value: "art", reason: "Muuzee Exhibition relation exists" };
  if (artName && !nonArt) return { value: "art", reason: "Explicit art-museum / gallery wording" };
  if (nonArt) return { value: "non_art", reason: "Explicit non-art museum category in name or Wikidata description" };
  if (weakArt) return { value: "possible", reason: "Weak art/culture wording only" };
  return { value: "unverified", reason: "No explicit art evidence in current LOCAL data" };
}

function hasValue(value) {
  return value !== null && value !== undefined && String(value).trim() !== "";
}

function completeness(row) {
  const checks = [
    hasValue(row.name), hasValue(row.address), row.latitude != null && row.longitude != null,
    hasValue(row.description), row.has_primary_image, hasValue(row.opening_hours_text),
  ];
  return Math.round((checks.filter(Boolean).length / checks.length) * 100);
}

function isAutoA(row) {
  return row.art_relevance_candidate === "art"
    && PUBLIC_MARKER.test(row.name)
    && ART_NAME.test(row.name)
    && (row.past_12m_exhibition_count >= 1 || row.upcoming_exhibition_count >= 1 || row.total_exhibition_count >= 3);
}

const SCENARIOS = [
  { id: "S1", label: "Past 12m ≥3 OR Upcoming ≥2", qualifies: (r) => r.past_12m_exhibition_count >= 3 || r.upcoming_exhibition_count >= 2 },
  { id: "S2", label: "Past 12m ≥2 OR Upcoming ≥2", qualifies: (r) => r.past_12m_exhibition_count >= 2 || r.upcoming_exhibition_count >= 2 },
  { id: "S3", label: "Past 12m ≥5 OR Upcoming ≥3", qualifies: (r) => r.past_12m_exhibition_count >= 5 || r.upcoming_exhibition_count >= 3 },
];
const RECOMMENDED_SCENARIO = SCENARIOS[1];

function tierFor(row, scenario) {
  if (row.auto_a_candidate) return "A";
  if (row.art_relevance_candidate !== "art") return "E";
  if (scenario.qualifies(row)) return "B";
  if (row.past_12m_exhibition_count >= 1 || row.active_now_exhibition_count >= 1 || row.upcoming_exhibition_count >= 1) return "C";
  return "D";
}

function manualA(row) {
  return row.art_relevance_candidate === "art" && !row.auto_a_candidate && (
    PUBLIC_MARKER.test(row.name) || USER_NAMED_A.has(row.name)
    || row.past_12m_exhibition_count >= 2 || row.upcoming_exhibition_count >= 2 || row.total_exhibition_count >= 3
  );
}

function tierReason(row, tier) {
  if (tier === "A") return "Public art museum with strong current or cumulative Exhibition evidence";
  if (tier === "B") return `Art Venue; ${RECOMMENDED_SCENARIO.label}`;
  if (tier === "C") return "Art Venue with a past-12m, active-now, or upcoming Exhibition";
  if (tier === "D") return "Confirmed Art Venue without recent or upcoming Exhibition activity";
  return `${row.art_relevance_candidate}: ${row.art_relevance_reason}`;
}

const rows = readRows().map((row) => {
  const relevance = classifyArt(row);
  const calculated = { ...row, art_relevance_candidate: relevance.value, art_relevance_reason: relevance.reason };
  calculated.auto_a_candidate = isAutoA(calculated);
  calculated.manual_a_review_candidate = manualA(calculated);
  calculated.auto_tier_candidate = calculated.effective_priority_tier || tierFor(calculated, RECOMMENDED_SCENARIO);
  calculated.tier_reason = calculated.persisted_tier_reason || tierReason(calculated, calculated.auto_tier_candidate);
  calculated.completeness = completeness(calculated);
  return calculated;
});

const CSV_COLUMNS = [
  "venue_id", "venue_name", "venue_name_en", "venue_type", "art_relevance_candidate", "auto_tier_candidate", "tier_reason",
  "total_exhibition_count", "past_12m_exhibition_count", "active_now_exhibition_count", "upcoming_exhibition_count",
  "latest_exhibition_date", "next_exhibition_date", "completeness", "missing_address", "missing_coordinates",
  "missing_description", "missing_opening_hours", "missing_closed_days", "missing_access", "missing_approved_image",
  "manual_a_review_candidate", "notes",
];

function csvEscape(value) {
  const text = value == null ? "" : String(value);
  return /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

function csvRow(row) {
  const values = {
    venue_id: row.id,
    venue_name: row.name,
    venue_name_en: row.name_en,
    venue_type: row.venue_type,
    art_relevance_candidate: row.art_relevance_candidate,
    auto_tier_candidate: row.auto_tier_candidate,
    tier_reason: row.tier_reason,
    total_exhibition_count: row.total_exhibition_count,
    past_12m_exhibition_count: row.past_12m_exhibition_count,
    active_now_exhibition_count: row.active_now_exhibition_count,
    upcoming_exhibition_count: row.upcoming_exhibition_count,
    latest_exhibition_date: row.latest_exhibition_date,
    next_exhibition_date: row.next_exhibition_date,
    completeness: row.completeness,
    missing_address: !hasValue(row.address),
    missing_coordinates: row.latitude == null || row.longitude == null,
    missing_description: !hasValue(row.description),
    missing_opening_hours: !hasValue(row.opening_hours_text),
    missing_closed_days: !hasValue(row.closed_days_text),
    missing_access: !hasValue(row.access_text),
    missing_approved_image: !row.has_approved_primary_image,
    manual_a_review_candidate: row.manual_a_review_candidate,
    notes: row.art_relevance_reason,
  };
  return CSV_COLUMNS.map((column) => csvEscape(values[column])).join(",");
}

function percent(count, total = rows.length) {
  return total ? `${(count * 100 / total).toFixed(1)}%` : "0.0%";
}

function median(values) {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}

function average(values) {
  return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;
}

const BINS = [
  { label: "10+", test: (n) => n >= 10 },
  { label: "5–9", test: (n) => n >= 5 && n <= 9 },
  { label: "3–4", test: (n) => n >= 3 && n <= 4 },
  { label: "2", test: (n) => n === 2 },
  { label: "1", test: (n) => n === 1 },
  { label: "0", test: (n) => n === 0 },
];

function distribution(field) {
  return BINS.map((bin) => ({ label: bin.label, count: rows.filter((row) => bin.test(row[field])).length }));
}

function scenarioCounts(scenario) {
  const counts = Object.fromEntries(["A", "B", "C", "D", "E"].map((tier) => [tier, 0]));
  for (const row of rows) counts[tierFor(row, scenario)] += 1;
  return counts;
}

const TARGETS = { A: 100, B: 83, C: 67, D: 50, E: 17 };
const TIERS = ["A", "B", "C", "D", "E"];
const tierStats = Object.fromEntries(TIERS.map((tier) => {
  const set = rows.filter((row) => row.auto_tier_candidate === tier);
  const coverage = (test) => set.filter(test).length;
  return [tier, {
    rows: set,
    average: average(set.map((row) => row.completeness)),
    median: median(set.map((row) => row.completeness)),
    targetUnmet: set.filter((row) => row.completeness < TARGETS[tier]).length,
    fields: {
      name: coverage((r) => hasValue(r.name)), name_en: coverage((r) => hasValue(r.name_en)), address: coverage((r) => hasValue(r.address)),
      postal_code: coverage((r) => hasValue(r.postal_code)), coordinates: coverage((r) => r.latitude != null && r.longitude != null),
      official_url: coverage((r) => hasValue(r.official_url)), image_candidate: coverage((r) => r.has_image_candidate),
      approved_image: coverage((r) => r.has_approved_primary_image), description: coverage((r) => hasValue(r.description)),
      opening_hours: coverage((r) => hasValue(r.opening_hours_text)), closed_days: coverage((r) => hasValue(r.closed_days_text)),
      access: coverage((r) => hasValue(r.access_text)),
    },
  }];
}));

function table(headers, data) {
  return [`| ${headers.join(" | ")} |`, `| ${headers.map(() => "---").join(" | ")} |`, ...data.map((line) => `| ${line.join(" | ")} |`)].join("\n");
}

const relevanceCounts = Object.fromEntries(["art", "possible", "non_art", "unverified"].map((key) => [key, rows.filter((r) => r.art_relevance_candidate === key).length]));
const manualCandidates = rows.filter((row) => row.manual_a_review_candidate).sort((a, b) =>
  b.upcoming_exhibition_count - a.upcoming_exhibition_count
  || b.past_12m_exhibition_count - a.past_12m_exhibition_count
  || b.total_exhibition_count - a.total_exhibition_count
  || a.name.localeCompare(b.name, "ja"));
const priorityRows = rows.filter((row) => ["A", "B", "C"].includes(row.auto_tier_candidate));
const priorityTargetUnmet = priorityRows.filter((row) => row.completeness < TARGETS[row.auto_tier_candidate]).length;
const sourceBCrawlNeeded = priorityRows.filter((row) => hasValue(row.official_url) && [row.address, row.description, row.opening_hours_text, row.closed_days_text, row.access_text].some((value) => !hasValue(value))).length;
const sourceBBlockedByMissingUrl = priorityRows.filter((row) => !hasValue(row.official_url)).length;
const manualAInPriority = priorityRows.filter((row) => row.manual_a_review_candidate).length;
const initialHumanReviewSet = rows.filter((row) => ["A", "B", "C"].includes(row.auto_tier_candidate) || row.manual_a_review_candidate).length;

const report = `# Venue Priority Tier Simulation

Date: ${AS_OF}  
Environment: LOCAL / Read only  
Venue rows: ${rows.length}

## 1. Purpose

全Venueを同じ品質へ揃えるのではなく、Art relevanceとOperational priorityを分離し、A〜E Tierごとの整備範囲を検討するための読み取り専用Simulation。DBへの書き込み、Crawler、Sync、公開状態変更は行っていない。

## 2. Current Data

- Venue: ${rows.length}
- Exhibition relationあり: ${rows.filter((r) => r.total_exhibition_count > 0).length}
- 過去12か月に重なる展示あり: ${rows.filter((r) => r.past_12m_exhibition_count > 0).length}
- 開催中: ${rows.filter((r) => r.active_now_exhibition_count > 0).length}
- 今後予定あり: ${rows.filter((r) => r.upcoming_exhibition_count > 0).length}
- 基準日: ${AS_OF}

## 3. Art Relevance Logic

${table(["Candidate", "Venue", "Share", "Rule"], [
  ["art", relevanceCounts.art, percent(relevanceCounts.art), "Wikidata art class、明示的な美術館・Gallery表記、またはMuuzee Exhibition relation"],
  ["possible", relevanceCounts.possible, percent(relevanceCounts.possible), "Art evidenceとnon-art evidenceの競合、または弱い文化・Art表記"],
  ["non_art", relevanceCounts.non_art, percent(relevanceCounts.non_art), "Science、Railway、Natural History等の明確な非Art分類"],
  ["unverified", relevanceCounts.unverified, percent(relevanceCounts.unverified), "現在のLOCALデータに明示的Art evidenceなし"],
])}

名称は補助Evidenceに限定し、曖昧な名称だけでartへ強制分類していない。これは正式分類ではなく候補である。

## 4. Exhibition Activity

- \`total_exhibition_count\`: 全期間のdistinct Exhibition数
- \`past_12m_exhibition_count\`: ${AS_OF}までの12か月間に会期が重なる展示。開催中を含む
- \`active_now_exhibition_count\`: 基準日に開催中
- \`upcoming_exhibition_count\`: 開始日が基準日より後
- Date欠損の推測は行っていない（現在のOccurrence 241件はstart/endとも入力済み）。

## 5. Exhibition Distribution

${table(["Exhibition count", "All time", "Past 12m", "Upcoming"], BINS.map((bin, index) => {
  const all = distribution("total_exhibition_count")[index].count;
  const past = distribution("past_12m_exhibition_count")[index].count;
  const upcoming = distribution("upcoming_exhibition_count")[index].count;
  return [bin.label, `${all} (${percent(all)})`, `${past} (${percent(past)})`, `${upcoming} (${percent(upcoming)})`];
}))}

## 6. Tier Logic

- A: art + 公立表記 + 明示的Art Museum名 + recent/upcoming 1件以上または全期間3件以上
- B: artかつScenario thresholdを満たす
- C: artで過去12か月・開催中・今後のいずれかに1件以上
- D: artだがrecent/upcomingなし
- E: possible / non_art / unverified

## 7. Scenario Comparison

${table(["Scenario", "B threshold", "A", "B", "C", "D", "E"], SCENARIOS.map((scenario) => {
  const counts = scenarioCounts(scenario);
  return [scenario.id, scenario.label, counts.A, counts.B, counts.C, counts.D, counts.E];
}))}

推奨は**S2（Past 12m ≥2 OR Upcoming ≥2）**。現在のExhibition coverageが178 Venueに限られるため、S3では主要な継続開催Venueを落としやすく、S1よりも初期B候補を少し広く保てる。

## 8. A Manual Review candidates

AUTO A: ${rows.filter((r) => r.auto_a_candidate).length}件。Manual Review: ${manualCandidates.length}件。

${table(["Venue", "Type", "All", "Past 12m", "Upcoming", "Current tier", "Reason"], manualCandidates.slice(0, 50).map((row) => [
  row.name.replaceAll("|", "\\|"), row.venue_type, row.total_exhibition_count, row.past_12m_exhibition_count,
  row.upcoming_exhibition_count, row.auto_tier_candidate,
  USER_NAMED_A.has(row.name) ? "User-named landmark candidate" : PUBLIC_MARKER.test(row.name) ? "Public art venue" : "High Exhibition activity",
]))}

候補が50件を超える場合、全件はCSVの\`manual_a_review_candidate\`で確認する。

## 9. Tier Counts

${table(["Tier", "Venue", "Share"], TIERS.map((tier) => [tier, tierStats[tier].rows.length, percent(tierStats[tier].rows.length)]))}

## 10. Tier Completeness

現行Adminと同じ6項目（Name / Address / Coordinates / Description / Primary image / Opening Hours）で計算。

${table(["Tier", "Venue", "Average", "Median", "Target", "Target未達"], TIERS.map((tier) => [
  tier, tierStats[tier].rows.length, `${tierStats[tier].average.toFixed(1)}%`, `${tierStats[tier].median.toFixed(1)}%`, `${TARGETS[tier]}%`, tierStats[tier].targetUnmet,
]))}

## 11. Missing Fields

${table(["Tier", "Name EN", "Address", "Postal", "Coordinates", "Official URL", "Image candidate", "Approved image", "Description", "Hours", "Closed", "Access"], TIERS.map((tier) => {
  const stats = tierStats[tier];
  const total = stats.rows.length;
  return [tier, total - stats.fields.name_en, total - stats.fields.address, total - stats.fields.postal_code, total - stats.fields.coordinates,
    total - stats.fields.official_url, total - stats.fields.image_candidate, total - stats.fields.approved_image,
    total - stats.fields.description, total - stats.fields.opening_hours, total - stats.fields.closed_days, total - stats.fields.access];
}))}

## 12. Human Workload

- A〜C合計: ${priorityRows.length} Venue
- Tier target未達: ${priorityTargetUnmet} Venue
- Official URLがあり、直ちにSource B Crawl可能: ${sourceBCrawlNeeded} Venue
- Official URL不足でSource B Crawl前にURL調査が必要: ${sourceBBlockedByMissingUrl} Venue
- Description不足: ${priorityRows.filter((r) => !hasValue(r.description)).length} Venue
- Approved image不足: ${priorityRows.filter((r) => !r.has_approved_primary_image).length} Venue
- 初期に人間が触る可能性がある最大集合はTarget未達の${priorityTargetUnmet} Venue。Fieldごとの件数は重複するため合算しない。
- A Manual Review候補${manualCandidates.length}件のうちA〜Cとの重複は${manualAInPriority}件。A〜C整備とA候補判定を合わせたdistinct Venueは${initialHumanReviewSet}件。

## 13. Recommended Threshold

S2を初期値とする。BはPast 12m 2件以上またはUpcoming 2件以上。Aは自動判定を狭く維持し、Manual Review候補を人間がA/Bへ確定する。

## 14. Recommended Completeness Target

現行Completenessは6項目のため17ポイント刻み。90%や80%を設定しても実質100%・83%になる。

- A: 100%
- B: 83%（6項目中5）
- C: 67%（6項目中4）
- D: 50%（6項目中3）
- E: 17%（Name最低限。正式対象外は追加整備しない）

Closed DaysとAccess等は現行Completeness外なので、Tier別必須Field policyを別途持つ必要がある。

## 15. Exhibition-driven Tier Update

- D + recent/upcoming Exhibition → 最低Cへ自動候補昇格
- E / possible + Exhibition → art relevance reviewを作成し、確認後は最低C候補
- E / non_art + Exhibition →自動でartへ変更せず、scope conflictとしてReview

## 16. Manual Override Design

\`auto_priority_tier\`、\`manual_priority_tier\`、\`effective_priority_tier = manual_priority_tier ?? auto_priority_tier\`は妥当。加えて\`tier_reason\`と\`tier_calculated_at\`を保持する。Art relevanceにもauto/manual/effectiveを分けると、分類根拠と運用優先度を混同しない。

## 17. Known Limitations

- Exhibition relationは178 Venueのみで、全Venueの活動実態ではなく現在のMuuzee取込coverageを示す。
- Exhibition relationありの178 Venueはすべて\`venue_type=other\`で、Source A由来の詳細Fieldがほぼ未統合。Tier判定には使えるが、Completenessの低さには取込経路の分断が大きく影響する。
- 直近データは開催中・今後の会期に偏っており、Past 12mの分布は実際の年間開催頻度を完全には表さない。
- Wikidataのgeneric museum rootはArt Museumを保証しない。Subclass labelの完全な階層解決は今回行っていない。
- 明示的なArt/Non-art文字列を高精度優先で使っており、名称・descriptionが曖昧なVenueはunverifiedへ寄せた。
- 公的区分、施設規模、有名度、来館者数の正規データがないためAUTO Aは意図的に狭い。
- Image candidateは利用可能性ではなく候補の存在、Approved imageはPrimaryかつrights approvedを数えた。
- TierとArt relevanceはSimulationでありDBへ保存していない。
`;

mkdirSync(dirname(CSV_PATH), { recursive: true });
mkdirSync(dirname(REPORT_PATH), { recursive: true });
writeFileSync(CSV_PATH, `${CSV_COLUMNS.join(",")}\r\n${rows.map(csvRow).join("\r\n")}\r\n`);
writeFileSync(REPORT_PATH, report);

console.log(JSON.stringify({
  asOf: AS_OF,
  venues: rows.length,
  artRelevance: relevanceCounts,
  venuesWithExhibitions: rows.filter((r) => r.total_exhibition_count > 0).length,
  past12m: rows.filter((r) => r.past_12m_exhibition_count > 0).length,
  activeNow: rows.filter((r) => r.active_now_exhibition_count > 0).length,
  upcoming: rows.filter((r) => r.upcoming_exhibition_count > 0).length,
  autoA: rows.filter((r) => r.auto_a_candidate).length,
  manualA: manualCandidates.length,
  scenarios: Object.fromEntries(SCENARIOS.map((s) => [s.id, scenarioCounts(s)])),
  recommended: RECOMMENDED_SCENARIO.id,
  recommendedCounts: Object.fromEntries(TIERS.map((tier) => [tier, tierStats[tier].rows.length])),
  priorityRows: priorityRows.length,
  priorityTargetUnmet,
  sourceBCrawlNeeded,
  sourceBBlockedByMissingUrl,
  manualAInPriority,
  initialHumanReviewSet,
  priorityCoverage: {
    total: priorityRows.length,
    nameEn: priorityRows.filter((row) => hasValue(row.name_en)).length,
    address: priorityRows.filter((row) => hasValue(row.address)).length,
    coordinates: priorityRows.filter((row) => row.latitude != null && row.longitude != null).length,
    officialUrl: priorityRows.filter((row) => hasValue(row.official_url)).length,
    imageCandidate: priorityRows.filter((row) => row.has_image_candidate).length,
    approvedImage: priorityRows.filter((row) => row.has_approved_primary_image).length,
  },
  csv: CSV_PATH,
  report: REPORT_PATH,
}, null, 2));
