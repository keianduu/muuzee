---
name: muuzee-admin-ui-polish
description: Audit and polish the existing Muuzee Admin UI for control hierarchy, interaction and selection states, typography, spacing, tables, filters, drawers, forms, responsiveness, and accessibility. Use for Admin visual QA or refinement; do not use for public-site UI, backend-only work, or creating Admin features whose main task is behavior or data flow.
---

# Muuzee Admin UI Polish

## Goal

Make Muuzee Admin quiet, compact, clear, operational, and consistent without replacing its architecture or turning it into a generic SaaS dashboard.

## Scope

Use after the Admin feature and data behavior exist, or when reviewing an existing Admin surface such as Dashboard, Imports, Exhibitions, Venues, Artists, Works, filters, tables, drawers, forms, statuses, or action bars.

Use `muuzee-ui-implementation` for a new public page or the structural implementation of a new Admin feature. Use this Skill as a secondary pass when that Admin work also needs visual and interaction polish.

## Required reading

1. Read `AGENTS.md` and `docs/project-context.md`.
2. Read `prototype/design-guide.html`, `prototype/assets/css/muuzee-global.css`, and `prototype/assets/js/muuzee-global.js` for the current design language.
3. Inspect the relevant production Admin page, shared components, and `src/app/globals.css`.
4. Read [references/admin-ui-principles.md](references/admin-ui-principles.md) and [references/control-state-policy.md](references/control-state-policy.md).
5. Consult `docs/research/admin-ui-visual-audit.md` when it still reflects the current implementation.

## Workflow

1. Open the current Admin in a real browser before editing. Inspect the requested surface and one comparable existing surface.
2. Exercise actual controls: filters, tabs, enabled and disabled actions, selection, drawers, forms, errors, empty states, and pagination or infinite loading where applicable.
3. Check desktop and narrow/mobile widths. Record concrete issues by hierarchy, state, spacing, typography, density, overflow, and accessibility.
4. Classify each control as Primary, Secondary, Tertiary/Ghost, or Danger before changing its appearance. Classify visible labels as action, selection, or data status.
5. Reuse current tokens and shared Admin patterns. Add an Admin semantic token only when an existing token cannot express a durable role.
6. Change the narrowest correct shared boundary. Do not copy a shared control style into individual pages.
7. Verify every affected state in the browser. A lint or build result alone is insufficient for polish work.
8. Run relevant lint, typecheck, tests, build, and `git diff --check` in proportion to the change.

## Non-negotiable rules

- Do not add Tailwind, shadcn/ui, Radix, or another UI library solely for polish.
- Do not change database schema, backend behavior, API semantics, or data policy to solve a visual problem.
- Do not use color as the only signal for selected, active, failed, dangerous, or disabled states.
- Do not call a disabled control, an unselected option, or an off toggle “Inactive.” Reserve Active/Inactive for data or operational status.
- Do not style a passive badge like a clickable button. Clickable controls must have an action affordance and complete interaction states.
- Do not wrap every section in a card or add shadows everywhere. Prefer spacing, borders, restrained surface changes, and headings.
- Do not use marketing-scale headings in operational screens. Preserve a compact hierarchy appropriate to dense Admin work.
- Do not hide required information or actions merely to make a table look cleaner.
- Do not claim completion without rendered browser checks at relevant widths.

## Verification checklist

- Action hierarchy is legible without relying on position alone.
- Default, hover, pressed, focus-visible, and disabled states are distinguishable.
- Selected/unselected and on/off states have semantic state plus a non-color cue.
- Active/Inactive, Published/Draft, Resolved/Failed remain data statuses, not control states.
- Buttons, links, tabs, toggles, checkboxes, and badges use correct semantic HTML and accessible names.
- Table headers, row actions, long values, empty values, loading, errors, and horizontal overflow remain usable.
- Filter groups and action bars wrap intentionally; narrow layouts do not produce oversized controls or page-wide overflow.
- Drawers preserve context, focus behavior, close affordance, readable forms, and usable internal scrolling.
- Section spacing follows Page > Section > Group > Field > Inline > control-internal hierarchy.
- Typography supports scanning: page title, section heading, body/control, then metadata.

## Output

Report audited routes and interactions, issues found, files changed, shared patterns reused, state/accessibility checks, desktop/mobile browser checks, automated checks, Notion log status when required, and remaining limitations. Do not commit or push unless explicitly requested.
