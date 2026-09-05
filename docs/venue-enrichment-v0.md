# Muuzee Venue Enrichment v0

Status: Draft, local verification only (2026-09-05).

This document covers the existing Venue → Wikidata candidate lookup flow. The separate Wikidata → Japan Venue Master Source A import is documented in [`docs/integrations/wikidata-venue-import.md`](./integrations/wikidata-venue-import.md).

## Purpose

Venue Enrichment treats three judgments independently:

1. **Venue Entity Match** — whether a Wikidata entity is the venue itself.
2. **Coordinate Candidate Decision** — whether a proposed coordinate may be used.
3. **Image Candidate Decision** — whether an image is relevant, followed separately by a rights judgment.

Candidate discovery never publishes data. Manual coordinates, adopted coordinates, accepted/rejected candidates, and approved media are protected during re-enrichment.

## Shared thresholds and scoring

`src/lib/venue-enrichment/policy.ts` owns the shared thresholds. Entity candidates are ranked by normalized Japanese/English labels and aliases, official-domain agreement, museum/gallery entity description, Japan signal, and prefecture/city consistency. Domain conflict lowers the score.

- `>= 0.85`: entity may be automatically linked.
- `< 0.85`: never automatically confirms the entity, but remains eligible for human-review candidate discovery down to the lowest configured `0.00` step.

Image discovery evaluates `0.95 → 0.90 → … → 0.10 → 0.05 → 0.00` in `0.05` steps. It stops at the first threshold whose eligible, non-rejected entities contain P18 and records that threshold, QID, confidence, reason, and the full search trace.

## Coordinate candidates

A non-rejected search result with P625 may supply a coordinate candidate before the entity match is confirmed, including below `0.60`. Candidates are evaluated from highest confidence downward, and the first coordinate-bearing result records its confidence-derived threshold. The candidate QID, coordinates, source, confidence, found threshold, reasons, and decision state live on `venues`; this avoids a duplicate candidate table.

The candidate is **not copied into current latitude/longitude automatically**. Admin must adopt or reject it. Manual edits set `coordinate_status = manual`; an adopted candidate sets `coordinate_status = approved`. Both states are protected from later enrichment.

When the Japanese address is parseable, Geolonia can provide a locality-level comparison candidate. If both Wikidata and Geolonia candidates exist, their distance is stored for review. Geolonia remains `town` precision and is never described as an exact entrance.

## Image candidates and search states

P18 candidates are saved through the existing `source_records` and `source_image_candidates` flow. Provider + stable file title deduplicates the same Commons file. Re-enrichment refreshes raw metadata without resetting a prior keep/reject or rights decision. An Admin may explicitly set a non-rejected candidate as the Venue Primary image without making a separate license selection first; this downloads the display thumbnail when available (otherwise the source image) to private Storage, preserves the candidate's current rights state and reported rights metadata in `media_assets`, and records the candidate as accepted. Wikimedia download uses the same IPv4 native-HTTPS fallback as external-data retrieval when Node fetch cannot establish the local outbound route. Candidates explicitly recorded as unavailable or rejected cannot be promoted. The Venue list is re-fetched after promotion so its thumbnail, completeness, and filtered membership reflect the saved image immediately.

An applied Wikidata identity is the `matched` row in `venue_external_match_candidates`. A single eligible row is applied automatically even at low confidence; multiple rows remain `candidate` until one Source is selected. `venues.wikidata_id` was removed as a duplicate shortcut; the Admin and enrichment service read the retained match relation instead.

Venue fields are written immediately according to `Manual > Official Website > Trusted API > Wikidata`. A same-source Wikidata value may refresh; Manual and Official Website values are protected. `publication_status`—not a field review state—controls use in the product. A single P625 coordinate follows the same rule. The legacy coordinate adopt/reject endpoint and UI were removed.

The venue records distinguish:

- `no_entity_candidate`: no eligible entity exists.
- `no_image_candidate`: eligible entities exist but no P18 was found within the configured thresholds.
- `image_candidate_found`: an unreviewed reference candidate exists.
- `image_candidate_kept`: a human kept at least one candidate.
- `image_candidate_rejected`: all active candidates were rejected.
- `approved_image_exists`: a human-approved Storage media asset exists.

The first threshold where P18 appears is retained. A result below `0.85` is explicitly shown as a relaxed-threshold candidate. It does not confirm the entity, become Primary, satisfy publication requirements, or create a `media_assets` row.

## Candidate relevance and rights

Image relevance and rights are separate decisions. Every new candidate starts with `review_status = unreviewed` and `rights_status = needs_review`, displayed as **記載なし・不明**. The only Muuzee rights judgments are:

- `approved`: 明確に利用可能
- `rejected`: 明確に不可
- `needs_review`: 記載なし・不明

Commons raw author, credit, reported license, license URL, usage terms, source page URL, and payload are preserved. Known reported licenses are normalized into Japanese review fields for usability, commercial use, modification/cropping, attribution, and share-alike. This reference display never changes Muuzee's human rights judgment automatically.

## Admin workflow

`/admin/venues` shows thumbnail, venue/address, coordinate state, image state, best entity confidence/QID, coordinate candidate confidence/source, P18 found threshold/QID, and updated time. Filters cover missing/candidate coordinates, missing/relaxed/waiting/approved images, and Wikidata review.

`/admin/venues/[id]` separates Basic Information, Current Coordinates, Coordinate Candidate, Wikidata Entity Match, Image Candidate, Search Diagnostics, manual research/upload, approved assets, and Related Exhibitions. The image-research prompt appears only when no active candidate exists or every active candidate was rejected.

## Local verification (2026-09-05)

- 5-venue batch: 5 entity candidates, 5 coordinate candidates, 5 image candidates, 5 found only below the strict `0.85` boundary, 0 automatic coordinate adoptions, 0 errors.
- 20-venue batch: 17 entity candidates, 17 coordinate candidates, 17 image candidates, 17 found only below the strict boundary, 3 genuinely had no eligible entity candidate, 0 errors.
- Both batches created 0 approved/Primary images and 0 automatically adopted coordinates.
- Re-running 茨城県陶芸美術館 found the existing image again with `imageCandidateAdded = false`; no duplicate candidate was created.

The first attempts through the default local Node fetch transport failed because that host could not establish an outbound Wikidata connection. External JSON retrieval now keeps standard fetch as primary and automatically tries native Node HTTPS only after a transport failure, so the normal local start command works without a special environment variable.

## Known limitations

- Search quality is constrained by upstream names, aliases, addresses, official URLs, P625, and P18 completeness.
- A score of `0.80` based mainly on name/entity signals is still a reference candidate, not proof of identity.
- The 20-item sample had three venues with no eligible entity: NTTインターコミュニケーション・センター [ICC], 泉屋博古館東京, and 土門拳写真美術館.
- Commons metadata assists review but is not a legal determination.
- Admin has no authentication yet and remains local/protected-staging only.
