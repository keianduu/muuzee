# Artist Enrichment

## Core fields

Current Artist Core Quality is Name, Name EN, Nationality, and Primary Image. Descriptions, styles, movements, and biographies are supplemental.

## Matching policy

Artist enrichment is Exhibition/Work driven. Prefer existing exact name, English name, alias, and relevant date evidence. Multiple exact identities require human selection. Do not infer an Artist from description text or partial-name similarity.

## Source order

Use targeted Wikidata import first, Wikipedia explicit-field fallback, then APJ/Getty where current policy supports the needed field, followed by official Artist/Gallery/Foundation/Museum image research and Manual resolution. Do not run Global Artist Full Sync as ordinary enrichment.

## Completeness and publication

Respect A/B/C tiers derived from canonical Exhibition relations and preserve manual Tier override. New Artist records remain Draft. P18 may be the preferred Primary under shared policy, but it does not approve rights.

## Special rules

- Do not infer nationality from a Japanese name, APJ presence, birthplace, or activity country.
- Preserve multiple nationality descriptors in raw evidence rather than collapsing them to one country.
- Use existing `source_image_candidates` and `media_assets`; do not create an Artist-specific image model.

## Repository sources

- `docs/integrations/wikidata-artist-import.md`
- `docs/integrations/artist-targeted-enrichment.md`
- `docs/master-data/artist-data-quality-operations.md`
- `docs/research/artist-source-coverage.md`
- `docs/research/artist-priority-image-coverage.md`
