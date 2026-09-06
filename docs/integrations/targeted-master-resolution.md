# Targeted Master Resolution Worker v1

Status: Draft

## Purpose

```text
Exhibition Daily Sync
  → Resolution Handoff
  → Targeted Master Resolution Worker
  → Canonical Venue / Artist Relation
  → Priority Tier refresh
```

The worker consumes the existing `exhibition_venue_mentions` and `exhibition_artist_mentions` ledgers. It does not introduce a second queue and does not run global Venue, Artist, or Work synchronization. Default batch size is 10 and the hard maximum is 50. Production scheduling/background execution is deliberately outside v1.

## Resolution policy

Existing canonical Venue masters are searched first through the DB-side Shared Venue Resolver using indexed exact name, English name, alias, official URL, and prior external-ID mapping. The worker does not load the full Venue Master. A single exact match is linked; multiple exact matches stop as `ambiguous`. Only when no existing master matches does the worker perform a targeted Wikidata search.

Venue candidates must satisfy the existing safe confidence threshold and be separated from the runner-up. A weak top result is not auto-selected. Artist candidates require one exact Wikidata label/alias match; the worker does not infer people from description text, partial names, or an LLM.

Outcomes are `pending`, `resolved`, `ambiguous`, `no_candidate`, and `failed`. `no_candidate` is a valid research outcome, while `failed` means a retryable API/parse failure. Original source value, Exhibition, candidate, external ID, method, reason, resolved master, attempts, and timestamps remain in the mention ledger and diagnostics.

## Apply and safety

Final relation apply uses database functions that lock the mention, protect an existing canonical relation, upsert without duplicates, and change the mention to `resolved` in the same transaction. Existing publication status, manual/official fields, Primary image, and rights state are not changed. New targeted Wikidata masters begin as Draft and reuse current importer/provenance/image-candidate policy. Existing source and field provenance remain authoritative.

Resolved items are skipped on later runs. Unique relation indexes plus atomic apply prevent duplicate occurrences and Artist relations. The worker refreshes existing Venue and Artist Tier calculations, preserving manual overrides. It never publishes an Exhibition or master.

## Operations

Admin Imports shows status counts, unresolved details, Dry Run, and Resolve Pending. Dry Run performs no database writes. Apply writes an `import_runs` entry with `operation_type=targeted_master_resolution`; targeted Wikidata imports retain their own child audit runs.

In Production, invoke the service runner after Daily Sync as a separate bounded background job. Add job leasing/advisory locking and retries before enabling concurrent workers. Ambiguous items remain for human candidate selection; no-candidate items remain available for Manual, Official, or Editorial resolution.
