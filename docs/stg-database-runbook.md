# STG Database Migration and Smoke Seed Runbook

This runbook applies only to the Muuzee STG Supabase project:

- Project: `muuzee-stg`
- Project ref: `steibqgeoqcsfsafaqcv`

`supabase/migrations/*.sql` remains the schema Source of Truth. The smoke seed is synthetic test data only. It contains no Production, LOCAL developer, or real user data.

## Safety boundary

- Never run a remote reset, truncate, reseed, migration repair, or database dump import.
- Never apply the smoke seed to Production.
- Do not store or print database URLs, passwords, API keys, tokens, or other secret values.
- Apply remote migrations only after a LOCAL clean rebuild and migration diff review.
- Apply the remote smoke seed only after the Order 300 Phase A Human Review approves it.
- The seed runner rejects a remote target unless both the connection identity and explicit confirmation match `steibqgeoqcsfsafaqcv`.
- Future public objects require explicit `service_role` grants in the migration that creates them; default privileges must not expose future tables or sequences automatically.

## LOCAL clean rebuild

```bash
npx supabase start
npx supabase db reset --local --no-seed
npm run db:docs:check
```

Run the repository SQL tests with the documented LOCAL PostgreSQL container and `ON_ERROR_STOP=1`. The current files are transaction-based SQL assertions rather than pgTAP plans.

## STG migration preflight and apply

Confirm the linked project before any write:

```bash
npx supabase projects list
npx supabase migration list --linked
npx supabase db push --linked --dry-run --skip-vault
```

The dry run must list only reviewed, committed migrations and must list no seeds. Then apply:

```bash
npx supabase db push --linked --skip-vault --yes
npx supabase migration list --linked
```

Do not use `--include-seed`. Schema and smoke data are separate operations.

## Smoke seed contents

`supabase/seeds/stg_smoke.sql` upserts stable synthetic records for:

- one Venue
- one Artist
- one Work
- one published Exhibition
- one active Exhibition occurrence
- Exhibition–Artist, Work–Artist, and Collection Holding relations
- one Exhibition tag

The public smoke slug is `stg-smoke-exhibition`. No media row is created; the Public page deliberately exercises its fallback image state.

## LOCAL seed validation

Run twice to prove idempotency:

```bash
npm run db:seed:smoke -- --local
npm run db:seed:smoke -- --local
```

Then verify the stable IDs have exactly one row each and inspect:

- `/admin`
- `/admin/venues`
- `/admin/artists`
- `/admin/works`
- `/exhibitions/stg-smoke-exhibition`

## STG smoke seed after Human Review

The remote command requires `psql`, a securely supplied STG database URL, and an explicit non-secret project-ref confirmation. Do not paste or persist the database URL in shell history, Git, Notion, screenshots, or reports.

After loading `SUPABASE_DB_URL` from the approved secret source without printing it:

```bash
MUUZEE_STG_PROJECT_REF=steibqgeoqcsfsafaqcv npm run db:seed:smoke -- --stg
```

Run the same command a second time and verify seed-specific counts remain one. Phase A does not execute either remote seed command.
