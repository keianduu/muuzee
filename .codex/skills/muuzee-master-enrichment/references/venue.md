# Venue Enrichment

## Core fields

Current Venue completeness uses Name, Address, Coordinates, Description, Primary Image, and Opening Hours. Postal code and other visitor information may still be valuable without being core.

## Matching policy

Use an existing Muuzee Venue UUID when identity is clear. All importers and targeted resolvers must use the DB-side Shared Venue Resolver rather than loading every Venue into application memory. Preserve an existing relation first; then use source external mapping and indexed exact name/name_en/alias/official URL keys. A single candidate can be applied; multiple identity candidates require human selection and retain candidate IDs/method/reason. Merge two Venue UUIDs only with the stronger evidence and safety rules documented for canonical merge.

## Source order

Use targeted enrichment before broad synchronization. Current coverage flow is Wikidata Source A, Wikipedia explicit address fallback, Official Website Source B, then additional trusted/manual sources. Preserve the global field priority; Venue Address has the documented Wikipedia fallback exception.

## Completeness and publication

Respect `auto_priority_tier`, optional `manual_priority_tier`, and effective Tier. Tier/completeness never publish a Venue. New imports remain Draft. Existing Primary and manual/official values are protected.

## Special rules

- Exhibition-originated unresolved Venue mentions go through Targeted Master Resolution; do not create a Venue from the source string alone.
- Source B remains bounded official-domain crawl → CSV → Preview → Confirm and never updates Master directly during crawl.
- P18/Commons images remain candidates under shared image/rights policy.

## Repository sources

- `docs/master-data-architecture.md`
- `docs/integrations/wikidata-venue-import.md`
- `docs/integrations/wikipedia-venue-enrichment.md`
- `docs/integrations/official-venue-crawler.md`
- `docs/integrations/targeted-master-resolution.md`
- `docs/master-data/venue-data-quality-operations.md`
- `docs/master-data/source-application-policy.md`
- `docs/master-data/venue-canonical-merge.md`
