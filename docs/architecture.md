# Muuzee Production Architecture

The first Admin vertical slice is Approved. The Master Data Architecture extension is Draft and is technically defined in `docs/master-data-architecture.md`.

## Runtime

```text
Browser
  ↓
Next.js App Router / Vercel
  ↓
Supabase PostgreSQL / private Storage
```

The Admin UI uses server-side Next.js code and route handlers. The Supabase service-role key is server-only and must never be exposed through a `NEXT_PUBLIC_*` variable or client bundle. Until Admin authentication exists, `/admin` is local-only or must be protected separately in staging.

`docs/environment-strategy.md` owns the Draft LOCAL / STG / Production isolation, deployment-promotion, migration, secret, and rollback contract. Remote projects are not provisioned by that planning document: Orders 270–340 perform the environment-specific setup after Human Review.

## Data architecture

```text
External sources
  ↓
source_records (raw ID/payload/audit)
  ↓ normalize and match once
Muuzee UUID masters
  ├─ Venue
  ├─ Artist
  ├─ Work
  └─ Exhibition
  ↓
explicit FK relations / field provenance / human review
```

Canonical names, addresses, coordinates, and artist information live on masters and are joined by UUID. External source strings remain audit evidence rather than duplicate display data.

## Separate update pipelines

Master enrichment is low-frequency and quality-first:

```text
Venue / Artist / Work
  → Source A
  → missing fields from B/C
  → AI or CSV candidates
  → human review
  → manual override wins
```

Exhibition sync is lightweight and frequent:

```text
Daily source sync
  → stable external ID and checksum
  → changed records only
  → normalize
  → match masters during import
  → update explicit relations
```

These are separate jobs by design. No master API, AI/CSV workflow, scheduler, or remote deployment is included yet.

## Current Art Commons flow

```text
Art Commons via Japan Search
  → scroll snapshot and exact date-overlap filtering
  → source_records
  → exhibitions + exhibition_occurrences + venue_id
  → Admin review and rights review
  → future public service
```

Full import uses Japan Search’s scroll snapshot to avoid ordinary offset limits and retain one stable upstream result set. Re-import compares checksums and updates only changed linked records. Imported content and external image candidates remain Draft/unapproved.

## Venue enrichment flow

```text
Existing Venue
  → Wikidata ranked entity candidates
  ├─ coordinate candidate
  ├─ Wikimedia Commons P18 candidate
  └─ Geolonia coordinate comparison/fallback
  → Admin human review
  → optional approved Storage asset
```

It reuses `data_sources`, `source_records`, `source_image_candidates`, `media_assets`, and `import_runs`; it does not create a parallel media architecture. Candidate relevance, reported license, Muuzee rights classification, and Primary selection remain separate decisions.

## Responsibility boundaries

- `prototype/`: exploratory UX and visual reference; never imported by Production.
- `src/app/`: production Next.js routes and Admin UI.
- `src/lib/`: integration, matching, persistence, and validation logic.
- `supabase/migrations/`: versioned database and Storage Source of Truth.
- `docs/master-data-architecture.md`: technical master-data Source of Truth.
- `docs/environment-strategy.md`: environment and release-operating Source of Truth after Human Review approval.
- Notion: concise product/design context and decision log.
- Git: implementation history.

## Deliberate current constraints

- No ORM; Supabase client plus SQL migrations.
- No remote Supabase/Vercel project has been provisioned by the environment-planning scope.
- No new master Admin screens or external master APIs.
- No automatic entity, content, or rights approval.
- No Admin auth yet; production exposure is prohibited.
