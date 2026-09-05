# Muuzee Master Data Architecture

Status: Draft. This document is the technical Source of Truth for the current master-data schema.

## Venue Source A

Venue Master Source AはWikidata。Japanのmuseum / art gallery系QIDをDiscoveryし、QIDをstable external IDとして差分同期する。単一のidentity candidateはconfidenceをGateにせず既存Venueへ適用し、複数候補だけSource Candidate Selectionへ送る。新規VenueはDraftから開始する。詳細は[`docs/integrations/wikidata-venue-import.md`](./integrations/wikidata-venue-import.md)と[`docs/master-data/source-application-policy.md`](./master-data/source-application-policy.md)を参照。

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

Venue Wikidata identity candidates and match diagnostics remain in `venue_external_match_candidates`. `candidate` means identity selection is unresolved; `needs_review` is no longer an application gate. The duplicated `venues.wikidata_id` shortcut was removed.

## 4. Master ID rule

```text
External record
  → retain raw payload and external ID
  → normalize source value
  → match a Muuzee master once during import
  → save Muuzee UUID in an explicit relation
  → render by joining the master
```

For example, a source venue name resolves to `exhibition_occurrences.venue_id`; an artist name resolves to `exhibition_artists.artist_id`. For Venue Source A, candidate count—not confidence—is the identity gate: one candidate is applied, multiple candidates require selection, and zero candidates leave the Master unchanged.

## 5. Field-level enrichment

The provenance tables are deliberately separate to preserve foreign-key integrity:

- `venue_field_sources`
- `artist_field_sources`
- `work_field_sources`
- `exhibition_field_sources`

Each records `field_name`, human-readable `source`, optional `source_url` and `source_record_id`, a JSON `value_snapshot`, `generated_by_ai`, optional AI confidence / transformation notes, `review_status`, `is_current`, and timestamps. A partial unique index allows at most one current provenance row for each master field. AIはSourceではなく、公式サイト等のSourceを構造化するTransformationとして記録する。

These tables record where a value came from. Reliable source values become current at an explicit import boundary according to system priority; they do not require a separate field-level accept/reject action. `review_status` remains compatibility/history metadata and does not control product use. Manual values remain protected. Multiple identity candidates stay unresolved for human selection.

## 6. AI and CSV fallback

Master Admin v1 implements CSV export, Preview, conflict detection, explicit Confirm, and field-level provenance. AI API enrichment remains unimplemented. The supported sequence is:

```text
Detect missing fields
  → export/research using CSV or AI
  → Preview and classify New / Update / Unchanged / Invalid
  → stop higher-priority and ambiguous conflicts for explicit human confirmation
  → apply reliable fields using source priority
  → mark generated_by_ai when applicable
  → update master and current provenance
```

AI-generated values must never be presented as verified facts merely because they exist in a provenance table.

## 7. Source priority, ambiguity, and publication

The default field priority is `Manual > Official Website > Trusted API > Wikidata`. CSV is a transport rather than a source rank; an attributable CSV must declare its real source, while an undeclared generic CSV does not override sourced values automatically. Field-level accept/reject review is not the normal workflow. Human judgment is required when multiple candidates cannot be uniquely resolved, or when an operator explicitly chooses to override a higher-priority value. Re-enrichment must preserve manual decisions. Publication status remains the final content-wide control using `draft → ready → published → archived`.

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

Source B is the bounded Official Website Crawler documented in [`docs/integrations/official-venue-crawler.md`](./integrations/official-venue-crawler.md). Source order follows the priority above unless a field has a documented exception. Manual overrides must not be overwritten by enrichment.

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

Future scope includes real Artist/Work source adapters and matching, AI-assisted research, authenticated remote environments, deployment, scheduling, Source C, and remote-environment Full Sync. Venue currently has Wikidata Source A and Official Website Source B. Source B is local-only and always stops at a CSV artifact before explicit Preview / Confirm.

## Validation and reproducibility

Migration files under `supabase/migrations/` are the database Source of Truth. `supabase/snippets/master_data_validation.sql` checks relation orphans, duplicate relations and external IDs, duplicate holdings, invalid media owners, and provenance orphans. A clean local database must reach the same schema through `supabase db reset`.
