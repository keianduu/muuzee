# Exhibition Enrichment

## Core fields

Exhibition publication requires a Title, canonical Venue occurrence, at least one start/end date, a Primary image, and approved image rights. Artist relation is not required for publication.

## Matching and source flow

The current pipeline is Japan Search / Art Commons scan → normalize → external ID/checksum diff → apply permitted changes → canonical Venue/Artist relation → unresolved handoff → Targeted Master Resolution. Daily Sync and low-frequency Master enrichment remain separate jobs.

## Source order

Use `source_records(data_source_id, external_id)` as import identity and retain raw source values. Changed fields follow current provenance priority. Source images remain candidates; use Exhibition-specific image-rights research rather than Venue/Artist image assumptions.

## Completeness and publication

Keep event status (`upcoming`, `ongoing`, `ended`) separate from publication status. Do not delete ended Exhibitions. Source sync does not publish, select/approve an image, or overwrite protected higher-priority fields.

## Special relation rules

- Venue resolution preserves an existing occurrence, then accepts only a single normalized exact canonical match before targeted resolution.
- Artist resolution uses structured names or safe exact evidence; never infer from prose/fuzzy fragments.
- Preserve source mentions, last-seen state, and unresolved/ambiguous outcomes for audit. Do not delete/recreate relations on every sync.
- Run Targeted Master Resolution as a bounded separate job; it is not part of the Daily Sync transaction.

## Repository sources

- `docs/integrations/art-commons.md`
- `docs/integrations/exhibition-daily-sync.md`
- `docs/integrations/targeted-master-resolution.md`
- `docs/data-model.md`
- `src/lib/exhibition-sync/daily-sync.ts`
- `src/lib/master-resolution/worker.ts`
