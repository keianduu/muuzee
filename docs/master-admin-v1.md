# Muuzee Master Admin v1

## Exhibition Daily Sync (Draft)

`/admin/imports`にはLOCAL検証用のDry Run / Applyを置く。既定はAsia/Tokyoの今日に対する45日buffer〜1年後で、UI実行は20件sampleに制限する。結果はNew / Changed / Unchanged、Venue / Artist resolution、Targeted handoff、Tier changeを返す。Productionの長時間処理はWeb requestではなくbackground jobへ移す。詳細は[`docs/integrations/exhibition-daily-sync.md`](./integrations/exhibition-daily-sync.md)。

Status: Draft. This is the local production-implementation reference for Venue / Artist / Work master operations.

## Wikidata Venue API Import

`/admin/venues`の`API Import → Wikidata`から件数指定Importと全件同期を実行できる。全件同期は事前COUNTなしでroot別・QID cursor paginationを行う。単一候補はSource Priorityに従って自動適用し、複数候補だけVenue詳細のDataタブでSource Candidateを選択する。confidenceとreasonは診断表示であり、Field適用の承認ボタンやNeeds Review Gateは持たない。

## 1. Purpose and routes

Master Admin v1 adds source-aware management for the three low-frequency masters. Human review is focused on ambiguity and explicit priority overrides; final publication remains a human content-level action. It does not change the existing Exhibition import and editorial workflow.

| Master | List + Detail Drawer | Manual create | Legacy detail URL |
| --- | --- | --- | --- |
| Venue | `/admin/venues?selected={id}` | `/admin/venues/new` | `/admin/venues/[id]` → List + Drawer |
| Artist | `/admin/artists?selected={id}` | `/admin/artists/new` | `/admin/artists/[id]` → List + Drawer |
| Work | `/admin/works?selected={id}` | `/admin/works/new` | `/admin/works/[id]` → List + Drawer |

`/admin` shows Total and Published counts for Exhibitions, Venues, Artists, and Works. Admin remains local-only until authentication and authorization are implemented.

## 2. Shared architecture

The three masters use shared configuration and services rather than copied CRUD implementations:

- `master-config.ts`: editable and CSV fields, labels, core field, and Completeness rules.
- `master-validation.ts`: server-side normalization and validation.
- `master-repository.ts`: list, detail, CRUD, publication, CSV, provenance, deletion, and adjacency.
- `master-csv.ts`: RFC-style quoted CSV parsing, export, template, Preview classification, and summary.
- `master-importers.ts`: explicit registry of real external source adapters and their supported modes.
- Shared list, filter, editor, navigation, CSV, publication, and relation UI components.

The browser receives the first 50 list rows, then requests the next 50 as the infinite-scroll sentinel approaches the viewport. Filters, search resolution, count, stable sort, and each bounded page run on the server. Venueは実効Tier A→E→未分類、同Tier内はCompleteness低→名称→UUIDで安定Sortする。A〜E / A〜C FilterはURL stateとして保持する。A Drawer fetches only the selected record's detail. CSV export deliberately bypasses screen pagination and reads the complete master in bounded server batches.

## 3. Manual Input

Manual create always produces `publication_status = draft`, regardless of submitted status. Manual create and edit write field-level provenance with:

```text
source = manual
review_status = approved
is_current = true
```

Publication state is not edited in the basic form. Publish / Unpublish has a separate server-validated endpoint.

## 4. CSV workflow

CSV Import is a two-step operation:

```text
Upload
  → Parse
  → Preview
  → Validation
  → Confirm
  → server re-parses and re-validates the original CSV
  → Import
```

Preview classifies every row as `new`, `update`, `unchanged`, or `invalid`, displays Before → After, and identifies higher-priority or ambiguous conflicts. The normal Confirm action stops on Invalid rows and requires a second explicit human confirmation before overriding conflicts.

Ordinary CSV fields are recorded as `csv_import`; Official Website CSV fields are recorded as `official_website`. Imported reliable fields use `review_status = applied`; Manual writes use `approved`.

```text
source = csv_import | official_website | trusted_api
review_status = applied
is_current = true
```

Previous provenance is retained as history with `is_current = false`. CSV never directly publishes a master; newly created rows remain Draft and the publication column is informational on export.

## 4.1 Official Website Source B

`/admin/venues`の`公式サイト情報取得`は、選択Venue、現在のFilter、Tier A、A+B、A〜Cから最大50件を対象に、同一domain・robots.txt準拠・最大6ページのbounded crawlを実行する。不足Fieldを指定でき、公式URLなしは対象外としてDashboard集計する。結果はMasterへ直接保存せず、Crawl Result → CSV Download → CSV Preview → Confirmを必須とする。最新Crawlと履歴、抽出値、Field Source URLはVenue DrawerのDataタブで確認できる。詳細は[`docs/integrations/official-venue-crawler.md`](./integrations/official-venue-crawler.md)を参照。

CSV Export supports complete current records and a template. It is not limited by list pagination.

## 5. External-source Import

External import is represented by the shared `MasterImporter` interface. The UI exposes only registered, real adapters:

- Venue: Wikidata Source Aは件数指定Importと明示的な全件同期、既存Venue起点のVenue Enrichmentはbounded sampleを実行できる。identity候補が複数のときだけ人がSourceを選ぶ。単一座標は自動適用し、画像はPrimary選択とrights確認を分離する。
- Artist: Wikidata Targeted ImportとImage再探索を提供する。Wikipedia EnrichmentとExhibition Artist MatchingはLOCAL用Admin APIとして実装し、Global Full Syncは提供しない。Getty ULAN / APJ DAJはCoverage TestだけでImportしない。
- Work: SHŪZŌ / ToMuCoのTier A Targeted Candidate adapterを提供する。Sourceが区別した`title_ja` / `title_en` / `title_original` / `original_language`を候補へ保存し、最大5候補/Artistを保持する。Core 3/3を満たすCandidateを人が1件または複数選択してDraft Workへ採用する。代表作の自動採用やGlobal Full Syncは行わない。

Artist / WorkのFull Syncは、adapterがdeterministic pagination、update identity、error aggregation、rate limiting、human-review boundaryを実装するまでunavailableのままにする。No sample or Full Sync button generates fictional data.

Standard future import results use `fetched / created / updated / skipped / sourceSelectionRequired / errors`.

## 6. Completeness

Completeness is calculated dynamically from shared configuration. It is not stored in the database.

- Venue: Name / Address / Coordinates / Description / Primary Image / Opening Hours.
- Artist: Name / Name EN / Nationality / Primary Imageの4項目だけ。Aliases / Life / Classification / Description / StyleはSupplemental。
- Work: Title（`title_ja` / `title_en` / `title_original` / Legacy `title`のいずれか1つ）/ Artist relation / Holding Venue relationの3項目だけ（Core Quality 3/3）。

Lists show a percentage. Detail pages show a checklist. Missing values are displayed as `未設定` or an explicit empty state.

## 7. Publication

Venue, Artist, and Work publication uses `draft / ready / published / archived`. Master Admin v1 allows explicit Publish and Unpublish. The server repeats the minimum validation:

- Venue: `name` required.
- Artist: `name` required.
- Work: `title_ja` / `title_en` / `title_original` / Legacy `title`のいずれか1つ、Artist relation、Holding Venue relation required. Year / Display / Imageは任意。

Bulk Publish / Unpublish applies the same server validation. UI disabled states are convenience only, never the validation boundary.

## 8. Delete safety

Delete always requires browser confirmation and server relation checks.

- Venue deletion is blocked by Exhibition Occurrences or Collection Holdings.
- Artist deletion is blocked by Exhibition or Work relations.
- Work deletion is blocked by Collection Holdings.

The error lists blocking relation counts and recommends Unpublish / Archive. When no blocker exists, owned provenance and media rows follow FK cascade rules, raw source records become unlinked audit records, and Storage objects are removed. Work–Artist relations may cascade with the Work because the Work owns those relation rows.

## 9. Navigation and relations

Venue / Artist / Work rows open a right-side Detail Drawer. `selected={id}` remains in the URL, so reload and direct links reopen the same record. Closing removes only `selected`, preserving Search / Filter state. Browser Back closes a Drawer opened from the list. The legacy `/admin/{entity}/[id]` routes redirect to the corresponding list and Drawer. Back to list and Previous / Next controls are not shown in the Drawer.

The Drawer uses the shared `状態 / 編集 / データ` information architecture. It is 40–55% of the desktop viewport, becomes a full-screen sheet on narrow viewports, traps focus, closes with Escape or the close button, and blocks background interaction.

Work detail supports explicit add/remove operations for Artist、Holding Venue、明示的なPresentation relations。Selectors perform server-side search and return at most 20 candidates. Artist detail derives related Exhibitions and Works; Venue detail derives related Exhibitions and Holdings. VenueのDataタブはQID、Source、confidence、reason、Provenanceと複数候補時のSource選択を表示する。Field reviewとcoordinate採用操作は持たない。

Venue coordinate status and candidate coordinates provide a Google Maps link generated as `https://www.google.com/maps?q={latitude},{longitude}` and opened in a new tab. An inline map is not included in v2 because the current production app has no map dependency and the external link covers human verification without adding a tile-provider dependency.

## 10. Images and provenance

Artist and Work can upload Storage-backed images with the same three-way rights classification as Venue and Exhibition:

- `approved`: 明確に利用可能
- `rejected`: 明確に不可
- `needs_review`: 記載なし・不明

Venue / Artist共通Policyは既存Primaryを維持し、Primaryなし+usable P18なら複数CandidateでもP18を自動Primary化する。P18なし+usable Candidate 1件も自動Primary化し、P18なし+複数Candidateは人が選択する。自動設定後もRightsは元の状態を保持し、Approvedにはしない。Detail previews use `object-fit: contain` so the complete image is visible.

Artistも同じComponentとRuleを利用する。Artist一覧はA/B/C Tier、共通Image Status、4項目Core Quality、Publicationを表示し、A→B→C→未分類、同Tier内はCore Quality不足順で安定Sortする。Drawer DataタブはWikidata / Wikipedia / Provenance / Image discovery diagnosticsを表示し、Getty ULAN / APJ DAJはResearch-onlyと明示する。

Field Provenance displays Manual, CSV, API, and AI transformation history. Source BのAI補完はAdminからCSVと固定Promptを取得し、Codexで構造化したCSVを既存Previewへ戻す。ConfirmしたFieldは`source=official_website`と公式URLを維持し、`generated_by_ai = true`、confidence、notesを記録する。AIはSourceとして扱わず、自動公開しない。

## 11. Validation evidence

The synthetic CSV integration scenario uses temporary Artist rows only:

```text
New 1 / Update 1 / Unchanged 1 / Invalid 1
Manual-approved conflict 1
```

Preview, explicit conflict confirmation, Draft status, `csv_import` provenance, and cleanup are verified. Temporary rows and their cascaded provenance are removed after the test; no human data is overwritten.
