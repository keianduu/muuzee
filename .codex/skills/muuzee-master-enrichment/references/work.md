# Work Enrichment

## Core fields

Work Core Quality is Title, canonical Artist relation, and canonical Holding Venue relation. Year and Image are optional.

## Matching policy

Muuzee does not pursue exhaustive Work coverage. Target representative Works for relevant Artists/Venues. Use source external ID first, then normalized title + Artist UUID + Venue UUID + year as supporting identity evidence. Ambiguous duplicates are not auto-merged.

## Source order

Use the current targeted adapters (SHŪZŌ and ToMuCo where available) to create candidates, not canonical Works. Only an explicitly adopted Core 3/3 candidate becomes a Draft Work through the existing transactional path.

## Completeness and publication

Title may be `title_ja`, `title_en`, `title_original`, or legacy `title`; use the documented locale fallback. Never infer original title/language. Publish only after server-side Core 3/3 validation.

## Special relation rules

- `collection_holdings` means ownership/holding; it does not mean currently displayed.
- `work_presentations` records permanent/current/temporary presentation only when explicitly sourced.
- Use Muuzee Artist and Venue UUIDs. Do not create either Master from an ambiguous Work candidate.
- Adoption must remain atomic and idempotent and preserve relation/source provenance.

## Repository sources

- `docs/integrations/work-collection-import.md`
- `docs/master-data-architecture.md`
- `docs/data-model.md`
- `src/lib/work-title.ts`
- `src/lib/work-collection/adoption.ts`
