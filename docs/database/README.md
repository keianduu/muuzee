# Muuzee Database ER Documentation

`supabase/migrations/*.sql` is the Source of Truth for the **Current Physical Schema**.

`docs/database/user-data-target.json` is the separate Source of Truth for the **Target User Data Schema v1**. Target entries marked `Planned` are finalized design contracts only; they are not database tables until a later migration implements them.

The files in this directory are generated views of the current migration-derived schema:

- `schema.dbml` — DBML representation for ER tools and code review
- `er-diagram.html` — self-contained searchable Current / Target ER and column explorer

The Target source is version-controlled but is not generated:

- `user-data-target.json` — User Data Target v1 tables, columns, FKs, constraints, delete policy, RLS expectations, downstream Orders, exclusions, and resolved Product Decisions

Do not edit the generated files directly.

## Regenerate

```bash
npm run db:docs
```

The generator applies migration files in filename order and reconstructs the current `public` schema from supported `CREATE TABLE`, `ALTER TABLE`, `DROP TABLE`, and simple index statements. It then reads `user-data-target.json` only for the separate Target v1 view. It never adds Planned tables to `schema.dbml` or the Current view.

After adding or changing a migration, regenerate these files in the same change.

## Verify generated files are current

```bash
npm run db:docs:check
```

`--check` exits non-zero when either generated file differs from the migration-derived result.

`.github/workflows/database-docs.yml` runs this check on pull requests that change migrations, the generator, generated database documentation, or its npm scripts. This keeps schema documentation drift visible during review without making the generated files a second Source of Truth.

## HTML explorer

Open `docs/database/er-diagram.html` in a browser. It is self-contained and does not require a server or external JavaScript library.

Use the schema switcher to compare:

- **Current Schema** — migration-derived physical schema only
- **Target v1** — the finalized User Data target, with `Implemented`, `Planned`, and `External / Managed` status labels

The Target sidebar also records tables explicitly excluded from Target v1, client-owned Guest Saved state, downstream Order ownership, and resolved Product Decisions. Status filtering is available in Target v1.

Search supports:

- table names
- column names
- data types
- foreign-key targets such as `artists.id`

Matching columns are highlighted and non-matching tables are dimmed. Selecting a result scrolls to the exact table / column and emphasizes its relationships.

## Scope

The ER documentation is optimized for tables, columns, PKs, FKs, common unique constraints, and searchable relationships. PostgreSQL functions, triggers, RLS policies, check-constraint expressions, and complex / partial expression indexes remain authoritative only in the migrations.

When the Current generated view and a migration disagree, the migration wins. When the Target view and `user-data-target.json` disagree, the JSON target source wins. Neither Target source nor Target view proves that a migration has been applied.
