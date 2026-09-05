# Master Data Source Application Policy

Status: Draft / LOCAL (2026-09-05)

## Policy

Muuzee separates data ingestion from content publication. A value obtained from an attributable source is written to the canonical Master according to source priority; operators do not approve or reject each field. Whether a Venue is used by the product is controlled by `publication_status`.

```text
External Data
  → Canonical Master
  → Field Provenance
  → draft / ready / published / archived
```

Source priority is `Manual > Official Website > Trusted API > Wikidata`.

- Blank field: apply the source value.
- Current value owned by the same source: refresh it.
- Higher-priority current source: preserve it and retain the lower-priority value as provenance history.
- Single Wikidata identity candidate: apply automatically regardless of confidence.
- Multiple Wikidata identity candidates: stop only for Source Candidate Selection.
- No candidate: keep the Master unchanged.

Confidence, match reasons, discovery threshold, raw payload, QID, and historical provenance are diagnostics, not application gates.

## Images and coordinates

One Wikidata coordinate is applied automatically unless a higher-priority coordinate exists. P18 / Wikimedia Commons remains a Media Candidate because selecting a Primary image and evaluating rights are separate content operations. The existing three-way rights classification remains unchanged.

## LOCAL migration result

For 178 Exhibition-linked Venue UUIDs, dry-run classified `single 138 / multiple 11 / none 29`. Source A was applied to all 138 single candidates without creating or merging Venue rows. Publication remained `Draft 177 / Published 1`.

Coverage before → after:

| Field | Before | After |
| --- | ---: | ---: |
| Name EN | 2 | 138 |
| Classified Venue Type | 0 | 137 |
| Country | 2 | 138 |
| Region | 2 | 138 |
| Address | 1 | 68 |
| Postal code | 2 | 96 |
| Coordinates | 3 | 134 |
| Official URL | 2 | 138 |
| Image Candidate | 66 | 66 |
| Opening year | 2 | 126 |

Image Candidate count did not change because the P18 candidates had already been saved before the canonical Venue fields were applied.

The six-field Master completeness score (`name`, `address`, coordinates, description, Primary image, opening hours) improved from **17.0% to 48.4%** for the same 178 Venue UUIDs.

## Priority Tier simulation before → after

The Tier model itself was not changed by this migration. Counts can move slightly because the coverage-derived score is recalculated after Source A application.

| Tier | Before: rows / average completeness | After: rows / average completeness |
| --- | ---: | ---: |
| A | 45 / 17.0% | 46 / 52.3% |
| B | 19 / 17.0% | 19 / 43.2% |
| C | 110 / 17.7% | 108 / 47.6% |
| D | 1,037 / 38.6% | 1,037 / 38.7% |
| E | 3,769 / 38.8% | 3,770 / 38.8% |

For the post-migration A–C set (173 Venues), Source A now supplies coordinates for 130, official URLs for 134, addresses for 64, and image candidates for 65. Opening hours, closed days, and access remain Source B targets.
