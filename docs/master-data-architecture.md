# Muuzee Master Data Architecture

Status: Draft. This document is the technical Source of Truth for the current master-data schema.

## Venue Source A

Venue Master Source AはWikidata。Japanのmuseum / art gallery系QIDをDiscoveryし、QIDをstable external IDとして差分同期する。Full Syncは事前COUNTに依存せず、root別・QID順のcursor paginationで最後のpageまで逐次保存する。既存Venueとの曖昧一致は重複作成せずHuman Reviewへ送り、新規VenueはDraftから開始する。詳細は[`docs/integrations/wikidata-venue-import.md`](./integrations/wikidata-venue-import.md)を参照。

## 1. Core masters

Muuzee has four independent canonical masters. Their internal UUIDs are the only canonical relation keys.

| Master | Purpose | Update character |
| --- | --- | --- |
| `venues` | Museums, galleries, art spaces, and other venues | Low frequency, quality-first enrichment |
| `artists` | Artist identity and profile | Low frequency, quality-first enrichment |
| `works` | Artwork identity and metadata | Low frequency, quality-first enrichment |
| `exhibitions` | Exhibition identity and editorial publication state | Daily external-source sync |

External IDs, names, or URLs must never replace a Muuzee UUID primary key. A source venue or artist name is matched during import; it is not repeatedly matched at display time.

## 2. Relations

| Relation | Meaning |
| --- | --- |
| `exhibition_occurrences` | Exhibition × Venue, including dates and occurrence-specific ticket/opening information |
| `exhibition_artists` | Exhibition × Artist, including source name and match review state |
| `work_artists` | Work × Artist; supports collaboration and multiple creators |
| `collection_holdings` | Venue × Work; collection inventory and verification metadata |

“Artists held by a venue” is derived through `collection_holdings` plus `work_artists`; it is not stored as another direct relation. Canonical venue names, addresses, coordinates, and artist names are not copied into exhibitions or occurrences.

## 3. External sources and raw values

`data_sources` describes providers and their terms. `source_records` is the raw-payload and external-record ledger, unique by `(data_source_id, external_id)`. It has explicit nullable owner foreign keys for the four masters. At most one owner may be set, while zero owners are allowed for an audit record that could not be normalized or matched.

Deleting a master sets the source owner to null instead of deleting the raw audit record. Provider values such as the original venue or artist string remain in the raw payload and matching tables for audit and rematching. They are not canonical display values.

Venue Wikidata identity and human match state remain in `venue_external_match_candidates`. The duplicated `venues.wikidata_id` shortcut was removed.

## 4. Master ID rule

```text
External record
  → retain raw payload and external ID
  → normalize source value
  → match a Muuzee master once during import
  → save Muuzee UUID in an explicit relation
  → render by joining the master
```

For example, a source venue name resolves to `exhibition_occurrences.venue_id`; an artist name resolves to `exhibition_artists.artist_id`. Low-confidence matching must remain reviewable rather than being forced.

## 5. Field-level enrichment

The provenance tables are deliberately separate to preserve foreign-key integrity:

- `venue_field_sources`
- `artist_field_sources`
- `work_field_sources`
- `exhibition_field_sources`

Each records `field_name`, human-readable `source`, optional `source_url` and `source_record_id`, a JSON `value_snapshot`, `generated_by_ai`, `review_status`, `is_current`, and timestamps. A partial unique index allows at most one current provenance row for each master field.

These tables record where a value came from; they do not silently overwrite a manual or approved master value. Application code that performs future enrichment must explicitly choose when a candidate becomes current.

## 6. AI and CSV fallback

Master Admin v1 implements CSV export, Preview, conflict detection, explicit Confirm, and field-level `csv_import` provenance. AI enrichment remains unimplemented. The supported sequence is:

```text
Detect missing fields
  → export/research using CSV or AI
  → Preview and classify New / Update / Unchanged / Invalid
  → stop Manual / Approved conflicts for explicit human confirmation
  → import as unreviewed provenance
  → mark generated_by_ai when applicable
  → human review
  → update master and current provenance explicitly
```

AI-generated values must never be presented as verified facts merely because they exist in a provenance table.

## 7. Human review and override priority

Human-approved values, manual coordinates, image rights judgments, credits, and usage notes take priority over automatic enrichment. Re-enrichment must preserve those decisions. Publication status remains the lightweight existing sequence `draft → ready → published → archived`; this change does not introduce a workflow engine.

`media_assets` serves all four masters through explicit `exhibition_id`, `venue_id`, `artist_id`, and `work_id` foreign keys. Exactly one owner is required, preventing orphan or ambiguous assets. Raw reported license, license URL, author, and usage terms are stored separately from Muuzee’s three-way rights classification:

- `approved`: 明確に利用可能
- `rejected`: 明確に不可
- `needs_review`: 記載なし・不明

An external image candidate always begins as `needs_review` and never becomes a publication asset automatically.

## 8. Master update frequency

Venue, Artist, and Work use a low-frequency, multi-source enrichment process:

```text
Source A
  → fill missing fields from Source B
  → fill remaining fields from Source C
  → AI / CSV candidates
  → manual review and final approval
```

Source order is field-specific. Manual overrides must not be overwritten by scheduled enrichment.

## 9. Difference from daily exhibition sync

Exhibition ingestion is a separate, lightweight pipeline:

```text
Daily sync
  → stable external ID / checksum comparison
  → changed records only
  → normalize source values
  → match Venue and Artist masters during import
  → update relations
```

Master enrichment and daily exhibition sync must not be combined into one job. They have different frequency, failure, load, and review characteristics.

## 10. Current and future scope

Current scope includes schema, validation SQL, the existing Art Commons / Exhibition / Venue workflows, and Master Admin v1 shared CRUD / CSV / publication / deletion-safety interfaces.

Future scope includes real Artist/Work source adapters and matching, AI-assisted research, authenticated remote environments, deployment, scheduling, and remote-environment Full Sync. Venue currently has Wikidata Source A Import and the existing Venue Enrichment adapter; both remain local-only and human-review-first.

## Validation and reproducibility

Migration files under `supabase/migrations/` are the database Source of Truth. `supabase/snippets/master_data_validation.sql` checks relation orphans, duplicate relations and external IDs, duplicate holdings, invalid media owners, and provenance orphans. A clean local database must reach the same schema through `supabase db reset`.
