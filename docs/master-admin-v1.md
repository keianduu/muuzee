# Muuzee Master Admin v1

Status: Draft. This is the local production-implementation reference for Venue / Artist / Work master operations.

## Wikidata Venue API Import

`/admin/venues`の`API Import → Wikidata`から件数指定Importと全件同期を実行できる。全件同期は事前COUNTなしでroot別・QID cursor paginationを行う。実行中は最新の`import_runs.metrics`を2秒間隔で読み、Processed / Fetched / Pages / Retries / New Venue / Linked Existing / Updated / Unchanged / Needs Review / Image Candidate Added / Errorsを表示する。完了時はVenue件数・平均Completenessの前後も表示する。Possible MatchはVenue詳細でLink / Create New / Ignoreを人が判断する。

## 1. Purpose and routes

Master Admin v1 adds human-review-first management for the three low-frequency masters. It does not change the existing Exhibition import and editorial workflow.

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

The browser receives the first 50 list rows, then requests the next 50 as the infinite-scroll sentinel approaches the viewport. Filters, search resolution, count, stable sort, and each bounded page run on the server. A Drawer fetches only the selected record's detail. CSV export deliberately bypasses screen pagination and reads the complete master in bounded server batches.

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

Preview classifies every row as `new`, `update`, `unchanged`, or `invalid`, and displays changed fields. A changed field is a conflict when its current provenance is `manual` or `approved`. The normal Confirm action stops on Invalid rows and requires a second explicit human confirmation before overwriting conflicts.

Imported fields are recorded as:

```text
source = csv_import
review_status = unreviewed
is_current = true
```

Previous provenance is retained as history with `is_current = false`. CSV never directly publishes a master; newly created rows remain Draft and the publication column is informational on export.

CSV Export supports complete current records and a template. It is not limited by list pagination.

## 5. External-source Import

External import is represented by the shared `MasterImporter` interface. The UI exposes only registered, real adapters:

- Venue: Wikidata Source Aは件数指定Importと明示的な全件同期、既存Venue起点のVenue Enrichmentはbounded sampleを実行できる。候補のidentity / coordinate / image / rightsは必要に応じて人が確認する。
- Artist: no source adapter is connected, so the UI says unavailable.
- Work: no source adapter is connected, so the UI says unavailable.

Artist / WorkのFull Syncは、adapterがdeterministic pagination、update identity、error aggregation、rate limiting、human-review boundaryを実装するまでunavailableのままにする。No sample or Full Sync button generates fictional data.

Standard future import results use `fetched / created / updated / skipped / needsReview / errors`.

## 6. Completeness

Completeness is calculated dynamically from shared configuration. It is not stored in the database.

- Venue: Name / Address / Coordinates / Description / Primary Image / Opening Hours.
- Artist: Name / Birth or Death / Country / Description / Style / Primary Image.
- Work: Title / Artist relation / Description / Holding Venue relation / Primary Image.

Lists show a percentage. Detail pages show a checklist. Missing values are displayed as `未設定` or an explicit empty state.

## 7. Publication

Venue, Artist, and Work publication uses `draft / ready / published / archived`. Master Admin v1 allows explicit Publish and Unpublish. The server repeats the minimum validation:

- Venue: `name` required.
- Artist: `name` required.
- Work: `title` required.

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

Work detail supports explicit add/remove operations for Artist and Holding Venue relations. Selectors perform server-side search and return at most 20 candidates. Artist detail derives related Exhibitions and Works; Venue detail derives related Exhibitions and Holdings. Existing Venue Enrichment, candidate review, coordinate review, image rights, and media operations remain available below the shared master sections.

Venue coordinate status and candidate coordinates provide a Google Maps link generated as `https://www.google.com/maps?q={latitude},{longitude}` and opened in a new tab. An inline map is not included in v2 because the current production app has no map dependency and the external link covers human verification without adding a tile-provider dependency.

## 10. Images and provenance

Artist and Work can upload Storage-backed images with the same three-way rights classification as Venue and Exhibition:

- `approved`: 明確に利用可能
- `rejected`: 明確に不可
- `needs_review`: 記載なし・不明

External image references remain Candidates and never become Primary or rights-approved automatically. Detail previews use `object-fit: contain` so the complete image is visible.

Field Provenance displays Manual, CSV, API, and future AI sources when recorded. AI enrichment is not implemented. A future AI adapter must write `generated_by_ai = true`, retain raw evidence, remain unreviewed by default, and never publish automatically.

## 11. Validation evidence

The synthetic CSV integration scenario uses temporary Artist rows only:

```text
New 1 / Update 1 / Unchanged 1 / Invalid 1
Manual-approved conflict 1
```

Preview, explicit conflict confirmation, Draft status, `csv_import` provenance, and cleanup are verified. Temporary rows and their cascaded provenance are removed after the test; no human data is overwritten.
