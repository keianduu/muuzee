# Muuzee Data Model

Status: Draft for the Master Data Architecture; the existing Admin v0 publication rules remain Approved.

## Wikidata Venue Source A amendment

- `venues.inception_year`: 明示されたopening / inception year。field provenance必須。
- QIDは`source_records.external_id`で一意管理し、Muuzee内部PKはUUIDを維持する。
- Raw claims / classは`source_records.raw_payload`、曖昧な同一Venue候補は`venue_external_match_candidates`、field単位の採用・競合は`venue_field_sources`へ保持する。
- Venue / Artist画像は確定Wikidata QIDからP18、Wikipedia Article、Commons Category等を探索し、`source_image_candidates`でRights情報と取得経路を保持する。既存Primaryは維持し、PrimaryなしでusableなP18があればCandidate総数に関係なくPreferred Representative Imageとして自動Primary化する。P18がなくusable Candidateが1件だけの場合も自動Primary化し、複数件なら人が選択する。

## Canonical entities

| Table | Role |
| --- | --- |
| `venues` | Venue master and reviewed coordinate/enrichment state |
| `artists` | Artist master, including partial date precision |
| `works` | Work master, including text and range-based year precision |
| `exhibitions` | Exhibition identity and publication state |
| `exhibition_occurrences` | Exhibition × Venue with occurrence dates and local details |
| `exhibition_artists` | Exhibition × Artist with source-name/match audit fields |
| `work_artists` | Work × Artist, including collaborative roles |
| `collection_holdings` | Venue × Work holdings and inventory evidence |
| `work_presentations` | Work × Venueの常設/企画・現在展示状態。明示された場合のみ |
| `work_import_candidates` | Targeted sourceの代表作品候補、Artist/Venue照合、採用済みWork ID |

## Classification, source, and media tables

| Table | Role |
| --- | --- |
| `tags` | Typed genre, movement, era, theme, or other classification |
| `artist_tags`, `venue_tags`, `work_tags`, `exhibition_tags` | Explicit FK-safe tag relations |
| `data_sources` | External provider and terms metadata |
| `source_records` | Unique external record ID, latest raw payload, and optional explicit master owner |
| `venue_field_sources`, `artist_field_sources`, `work_field_sources`, `exhibition_field_sources` | Field-level provenance and review history |
| `source_image_candidates` | External image references, discovery route, and raw rights metadata awaiting review |
| `official_venue_crawl_results` | Immutable-per-run Source B extraction output, ambiguity, visited URLs, and field evidence before CSV confirmation |
| `venue_external_match_candidates` | Ranked Wikidata candidates, confidence, threshold evidence, and human state |
| `artist_external_match_candidates` | Ambiguous Artist identity candidates keyed by Artist and Wikidata QID |
| `media_assets` | Storage-backed, human-reviewed images owned by exactly one master |
| `import_runs` | Import/enrichment execution counts, errors, metrics, and timing |

## Relationship diagram

```text
venues ──< exhibition_occurrences >── exhibitions
   │                                      │
   │                                      └──< exhibition_artists >── artists
   │                                                                      │
   └──< collection_holdings >── works ──< work_artists >──────────────────┘

each master ──< its explicit tag relation >── tags
each master ──< its explicit field_sources
each master ──< source_records >── data_sources
each master ──< media_assets (exactly one owner per row)
```

## Integrity rules

- All canonical relationships use Muuzee UUID foreign keys.
- `source_records(data_source_id, external_id)` is unique and has zero or one explicit master owner.
- An unlinked source record is valid audit data when normalization failed; a source record can never point to multiple masters.
- Tag relations and core relations have uniqueness constraints to prevent duplicate links.
- Holdings are unique per Venue/Work, with inventory number included when present.
- Each master field can have at most one provenance row marked `is_current`.
- Every `media_assets` row has exactly one of `exhibition_id`, `venue_id`, `artist_id`, or `work_id`.

## Import identity and audit

Art Commons re-import uses the source record’s `exhibition_id` plus checksum. A linked unchanged record is skipped; a changed record updates its existing Exhibition and Occurrence. Provider names and raw JSON remain in `source_records` for audit/rematching, while display data comes through master joins.

## Publication and media rights

Publication state is `draft → ready → published → archived`. Existing Exhibition Admin server-side checks still require a title, occurrence/venue, dates, and an approved Primary asset before publish.

Images live in the private `exhibition-images` Supabase Storage bucket, never in Git. Source URL, credit, and usage notes remain optional. Reported license metadata is retained separately from Muuzee’s `approved`, `rejected`, or `needs_review` classification. Primary selection never approves rights. An Admin action is always required to approve rights; only the shared P18-first / single-fallback policy may promote a usable candidate to a Storage-backed Primary automatically.

## Venue enrichment

Venue enrichment retains ranked Wikidata candidates and a single actionable coordinate candidate, optional Geolonia comparison, P18 candidates, and search traces. The adopted Wikidata ID is the `matched` row in `venue_external_match_candidates`; it is not duplicated on `venues`. Raw Wikidata, Commons, and Geolonia payloads remain in `source_records`.

See `docs/master-data-architecture.md` for ownership, enrichment, and update-frequency rules.

## Artist Source A

Wikidata Artist Importerは既存`artists`、`source_records`、`artist_field_sources`、`source_image_candidates`、`media_assets`を再利用する。新規の`artist_external_match_candidates`は一意に決められないIdentity候補だけを保持し、Artist本体の重複Schemaを作らない。詳細は[`docs/integrations/wikidata-artist-import.md`](./integrations/wikidata-artist-import.md)を参照。

## Master Admin v1 application rules

Master Admin v1 does not add derived database columns. Completeness is calculated in application code from canonical fields, Primary media, and explicit relations. Manual, Official Website, trusted API, Wikidata, and CSV operations append field provenance history; only one row per field remains `is_current`. Priority is `Manual > Official Website > Trusted API > Wikidata`. CSV is only a transport: a known source must be declared in `source_type`, and an undeclared generic CSV cannot automatically displace attributable source data. Reliable values are applied at explicit import confirmation without a separate field decision, while ambiguity and higher-priority conflicts remain reviewable. Publication changes are separate server-side actions and CSV cannot publish a master directly.

Work–Artist and Work–Venue Holding edits write `work_artists` and `collection_holdings`。展示状態は独立した`work_presentations`へ書き、HoldingからDisplayを推測しない。Artist and Venue related-content sections are derived from those relations rather than duplicated onto master rows. See `docs/master-admin-v1.md` for the CRUD, CSV, publication, and delete-safety behavior.

Candidate adoptionは`adopt_work_candidate` DB functionで原子的に実行する。外部IDを優先し、補助的に正規化Title + Artist + Holding Venue + Yearを照合する。Work、relation、provenance、Candidate statusの途中状態を残さず、同一Candidateの再実行は冪等である。
