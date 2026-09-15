# Codex Repo-local Skills

Status: Draft

Muuzee keeps repository-wide rules in `AGENTS.md` and repeatable task procedures in `.codex/skills/`.

| Skill | Purpose |
| --- | --- |
| `muuzee-ui-implementation` | Implement or modify UI while reusing the current design system and shared components. |
| `muuzee-admin-ui-polish` | Audit and refine existing Admin control hierarchy, states, density, spacing, typography, tables, filters, drawers, forms, responsive behavior, and accessibility. |
| `muuzee-image-rights-research` | Research attributable image candidates and usage-rights evidence. |
| `muuzee-master-enrichment` | Add, enrich, import, or canonically connect Master data. |
| `muuzee-data-quality-audit` | Audit Master, relation, provenance, rights, publication, Tier, and sync state read-only. |

Skills should remain focused on task-specific workflow and link to current repository documentation instead of copying long-lived architecture or policy text. `muuzee-ui-implementation` remains the general UI workflow; `muuzee-admin-ui-polish` is the narrower rendered-audit and polish pass for operational Admin surfaces. The current set intentionally does not include entity-specific top-level Skills, pipeline orchestration, deployment, or production operation.

## UI Skill routing

- New public page, shared public component, or structural UI implementation: `muuzee-ui-implementation`.
- Existing Admin button states, typography, spacing, table readability, filters, drawers, forms, or responsive polish: `muuzee-admin-ui-polish`.
- New Admin API/import feature: use the relevant implementation/data workflow first; add `muuzee-admin-ui-polish` only for its visual and interaction quality pass.
