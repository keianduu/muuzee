---
name: muuzee-data-quality-audit
description: Perform a read-only quality audit of Muuzee Venue, Artist, Work, Exhibition, relations, provenance, media rights, publication, tiers, or sync/resolution state. Use for integrity checks, import QA, and pre-production data review; do not repair data unless explicitly asked.
---

# Muuzee Data Quality Audit

## Goal

Find and classify data integrity, quality, provenance, rights, publication, and resolution problems without changing data by default.

## When to use

Use for DB audits, import verification, relation checks, Master consistency checks, and production-readiness data reviews across Venue, Artist, Work, and Exhibition.

## Workflow

1. Read `AGENTS.md`, `docs/project-context.md`, `docs/master-data-architecture.md`, `docs/data-model.md`, and relevant integration/quality documentation.
2. Confirm environment, scope, as-of date, and whether the request is audit-only. Default to read-only.
3. Inspect the current migrations/schema and existing validation queries before composing new SQL.
4. Count checked records and test, as applicable: duplicate Master candidates; duplicate/orphan/missing relations; core completeness; publication violations; published-but-incomplete entities; manual override/source-priority inconsistencies; Tier inconsistency; duplicate source records; missing provenance; invalid external-ID ownership; invalid/multiple Primary images; rejected Primary or rights inconsistency; Exhibition date inconsistency; unresolved Venue/Artist and resolution-state inconsistency; and Holding/Presentation confusion.
5. Separate confirmed integrity violations from potential duplicate candidates and optional quality gaps.
6. Classify severity and propose a repair path. Do not apply it unless the user explicitly asks to fix the data.

## Severity

- **Critical:** broken foreign-key meaning, invalid ownership, or impossible published state.
- **High:** published entity missing a required canonical relation or publication prerequisite; destructive source-priority/manual-override loss.
- **Medium:** missing provenance, unresolved relation, Tier inconsistency, likely duplicate candidate, or required quality target not met.
- **Low:** optional field or supplemental enrichment gap without integrity/publication impact.

Adjust severity when current Muuzee policy or the requested environment makes the impact materially different.

## Rules

- Read-only means no update, insert, delete, migration, repair script execution, publication change, or external sync.
- Use Muuzee UUID relations and current schema, not assumed table/column names from older prompts.
- Report query limitations, incomplete coverage, and false-positive risk.
- Reuse `supabase/snippets/master_data_validation.sql` where applicable; add one-off read-only queries only for gaps in its coverage.
- Never treat a potential identity match as a confirmed duplicate without sufficient evidence.

## Verification

Confirm every reported count is tied to a query/scope and that the audit itself caused no writes. When practical, repeat key aggregate checks or reconcile them against entity totals.

## Output

Start with checked-record counts and Critical/High/Medium/Low totals. Then report Entity, Issue, Reason, Affected ID(s), and Recommended action. For large results, provide top issues plus totals and a local artifact/query path. State explicitly that no repair was performed unless authorized.
