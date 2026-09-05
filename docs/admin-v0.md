# Muuzee Admin v0

> Master Admin v1 now provides shared Venue / Artist / Work CRUD, CSV, Completeness, publication, relation, and deletion-safety workflows. See `docs/master-admin-v1.md`. The Exhibition workflow described here remains in service.

## Purpose

Admin v0 completes this internal workflow:

```text
Art Commons import
  → Draft exhibition
  → Missing-image review
  → Copy image-research prompt
  → Human rights research and decision
  → Image upload
  → Readiness validation
  → Explicit publish
```

## Routes

- `/admin`: dashboard counts and latest import.
- `/admin/imports`: run a controlled Art Commons import and review history.
- `/admin/exhibitions`: search and filter normalized exhibitions.
- `/admin/exhibitions/[id]`: edit metadata, inspect raw source, upload/delete an image, and change publication state.
- `/admin/venues`: search/filter the venue master, compare entity/coordinate/image states, see the P18 found threshold, and run bounded Venue Enrichment batches.
- `/admin/venues/[id]`: edit venue data; independently inspect entity, coordinate, image, and rights candidates; review search diagnostics; manage venue images; and see related exhibitions.

## Security boundary

**Until Admin authentication is implemented, Admin is limited to local development or a separately protected staging environment. Supabase Auth (or equivalent Admin authentication and authorization) is mandatory before production internet exposure.**

The browser never receives `SUPABASE_SERVICE_ROLE_KEY`. All database mutations, imports, Storage writes, and publication decisions run in server route handlers.

## Import safety

- Admin imports every source result matching the specified keyword and date condition; there is no 100-record UI cap or manual start offset.
- Default date range is today through one year later. Japan Search Scroll API narrows to `f-db=exhib` and the requested years, then exact day-level overlap is checked locally.
- Scroll pages are requested sequentially until the snapshot ends. Detail records are also fetched sequentially with the configured request delay.
- Import history separates upstream API hits, scanned records, exact-date eligible records, fetched details, exclusions, and errors.
- Past or undated source records are imported only when the Admin explicitly enables that option.
- Initial validation should use 3–5 records, then 20, then 100 only after review.
- Detail calls are sequential with a configurable delay.
- Raw JSON is retained before normalized records are considered complete.
- Import errors are counted and retained in `import_runs.errors`.
- No import automatically publishes.

## Image workflow

The research prompt is generated locally from the exhibition and occurrence. It instructs the researcher to use official or open sources and to return evidence, not a legal conclusion. Muuzee does not call an OpenAI API.

Upload requires an image, source type, and one of three rights classifications. Source URL, credit, and usage / judgment notes are optional metadata. The three classifications map to `rejected` (explicit redistribution prohibition), `needs_review` (no usable statement / unclear), and `approved` (explicit permission compatible with the intended use). Choosing `approved` is an explicit human action. The private Storage object is referenced by `media_assets`; Admin uses signed URLs for previews.

The schema uses the same `media_assets` model for Exhibition, Venue, Artist, and Work, with exactly one explicit owner per row. Master Admin v1 now exposes Artist and Work media upload/review while preserving the existing Exhibition and Venue workflows.

Media asset previews use `object-fit: contain` so the complete image remains visible instead of being cropped to a landscape thumbnail.

When the API includes an image URL, Admin may show it as an `API candidate`. This is a remote reference for research only; it is not downloaded, made Primary, or rights-approved automatically.

## Publish validation

The UI displays missing requirements, but the route handler repeats the validation on the server. A disabled button is never the security boundary.

## Venue enrichment safety

Only high-confidence Wikidata matches are automatic. Entity Match, Coordinate Candidate, Image Candidate, and Rights are independent. Any non-rejected search result may contribute P625/P18 reference candidates without confirming identity, including below `0.60`. Coordinate candidates require explicit adoption; image discovery records the first configured threshold with P18 and labels results below `0.85` as relaxed. Rights use only 明確に不可, 記載なし・不明, or 明確に利用可能, and every new candidate starts unknown. Existing manual/approved coordinates and approved media are protected. Automatic Storage upload and Primary selection remain prohibited. An Admin can explicitly promote a non-rejected image candidate without making a separate license selection first; this copies the display thumbnail when available (otherwise the source image) to private Storage, preserves its current rights state and reported rights metadata, and makes the new asset Primary. Wikimedia download falls back to IPv4 native HTTPS when Node fetch cannot establish the local outbound route. A candidate explicitly marked unavailable remains blocked.
