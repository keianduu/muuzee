# Muuzee Database ER Documentation

`supabase/migrations/*.sql` is the database Source of Truth.

The files in this directory are generated views of the current migration-derived schema:

- `schema.dbml` — DBML representation for ER tools and code review
- `er-diagram.html` — self-contained searchable ER / column explorer

Do not edit the generated files directly.

## Regenerate

```bash
npm run db:docs
```

The generator applies migration files in filename order and reconstructs the current `public` schema from supported `CREATE TABLE`, `ALTER TABLE`, `DROP TABLE`, and simple index statements.

After adding or changing a migration, regenerate these files in the same change.

## Verify generated files are current

```bash
npm run db:docs:check
```

`--check` exits non-zero when either generated file differs from the migration-derived result.

`.github/workflows/database-docs.yml` runs this check on pull requests that change migrations, the generator, generated database documentation, or its npm scripts. This keeps schema documentation drift visible during review without making the generated files a second Source of Truth.

## HTML explorer

Open `docs/database/er-diagram.html` in a browser. It is self-contained and does not require a server or external JavaScript library.

Search supports:

- table names
- column names
- data types
- foreign-key targets such as `artists.id`

Matching columns are highlighted and non-matching tables are dimmed. Selecting a result scrolls to the exact table / column and emphasizes its relationships.

## Scope

The ER documentation is optimized for tables, columns, PKs, FKs, common unique constraints, and searchable relationships. PostgreSQL functions, triggers, RLS policies, check-constraint expressions, and complex / partial expression indexes remain authoritative only in the migrations.

When the generated view and a migration disagree, the migration wins.
