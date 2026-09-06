---
name: muuzee-master-enrichment
description: Add, enrich, import, or canonically connect Muuzee Venue, Artist, Work, or Exhibition data. Use for targeted enrichment, unresolved Master resolution, source imports, and requests such as “この展覧会を追加して”; do not use for UI-only rendering changes or read-only audits.
---

# Muuzee Master Enrichment

## Goal

Add or improve canonical Master data while preserving identity, provenance, source priority, publication safety, and idempotency.

## When to use

Use for Venue, Artist, Work, or Exhibition imports/enrichment; canonical relation creation; unresolved mention processing; and targeted external-source lookup. Read the matching entity reference before acting.

## Workflow

1. Read `AGENTS.md`, `docs/project-context.md`, `docs/master-data-architecture.md`, and the relevant reference below.
2. Confirm the authorized environment and scope. A targeted request does not authorize a Global Full Sync, scheduler, remote Supabase operation, or publication.
3. Search existing canonical Masters first using current matching policy. For Venue identity, always use the shared DB-side Venue Resolver; never fetch the full Venue Master into application memory for matching.
4. If one canonical identity is clear, enrich it. If none exists, use the entity's targeted external-source path. If multiple plausible identities remain, stop for human selection.
5. Use the Muuzee UUID for canonical relations; keep external IDs/raw names for import, matching, provenance, and audit only.
6. Apply trustworthy fields according to current source priority, preserving Manual/Official/higher-priority values and field provenance.
7. Create or update canonical relations once at import/resolution time. Do not defer repeated raw-string matching to display time.
8. Keep ingestion, image Candidate/Primary/Rights, and publication as distinct operations.
9. Recalculate applicable quality/tier state while preserving manual overrides.
10. Verify duplicates, relations, provenance, idempotency, and unintended publication changes.

## Rules

- Do not create Masters in bulk from unverified source strings.
- Do not auto-select an ambiguous top candidate merely because it ranks first.
- Route every Venue relation caller/importer through the shared Resolver. Preserve an existing relation, retain candidate IDs/method/reason, and leave multi-venue-like source strings unresolved.
- Do not add a field-level accept/reject gate; use human review for identity ambiguity, source conflict, rights, or editorial choice.
- Preserve `Manual > Official Website > Trusted API > Wikidata`, including documented field-specific exceptions.
- Do not overwrite an existing Primary, approve rights, publish content, or discard ended Exhibitions unless explicitly authorized and valid under current rules.
- Prefer bounded Dry Run/sample validation before Apply when the operation can create or connect multiple records.

## References

- Venue: [references/venue.md](references/venue.md)
- Artist: [references/artist.md](references/artist.md)
- Work: [references/work.md](references/work.md)
- Exhibition: [references/exhibition.md](references/exhibition.md)

## Verification

Check duplicate Masters and relations, orphan relations, source-priority violations, missing provenance, ambiguous auto-resolution, publication changes, manual-override loss, and repeat-run idempotency. Reuse `supabase/snippets/master_data_validation.sql` and relevant tests when their scope applies.

## Output

Report scope/environment, Dry Run and Apply counts, existing/new/ambiguous/unresolved outcomes, relations and provenance changed, tier/quality impact, validation results, publication impact, and limitations.
