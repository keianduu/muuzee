# Codex Repo-local Skills

Status: Draft

Muuzee keeps repository-wide rules in `AGENTS.md` and repeatable task procedures in `.codex/skills/`.

| Skill | Purpose |
| --- | --- |
| `muuzee-ui-implementation` | Implement or modify UI while reusing the current design system and shared components. |
| `muuzee-image-rights-research` | Research attributable image candidates and usage-rights evidence. |
| `muuzee-master-enrichment` | Add, enrich, import, or canonically connect Master data. |
| `muuzee-data-quality-audit` | Audit Master, relation, provenance, rights, publication, Tier, and sync state read-only. |

Skills should remain focused on task-specific workflow and link to current repository documentation instead of copying long-lived architecture or policy text. Add a new Skill only after repeated use demonstrates that a distinct workflow cannot stay clear within these four. v1 intentionally does not include UI QA, entity-specific top-level Skills, pipeline orchestration, deployment, or production operation.
