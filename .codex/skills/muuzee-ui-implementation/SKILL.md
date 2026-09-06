---
name: muuzee-ui-implementation
description: Implement or modify Muuzee web, PWA, prototype, or Admin UI. Use for pages, layouts, components, interactions, responsive behavior, and visual states; do not use for importing or adding master data merely because it appears in a UI.
---

# Muuzee UI Implementation

## Goal

Implement Muuzee UI without fragmenting the current design system or coupling the result to sample content. Preserve the principle: **Art first. UI stays quiet.**

## When to use

Use for new screens, layout changes, shared or page-specific components, responsive behavior, and UI states in `prototype/` or `src/`. A request such as “この展覧会を追加して” is data work and belongs to `muuzee-master-enrichment` unless the user explicitly asks to build its interface.

## Workflow

1. Read `AGENTS.md` and `docs/project-context.md`; determine Prototype Discovery, Approved Specification Change, or Production Implementation.
2. Inspect in order: `prototype/design-guide.html`, `prototype/assets/css/muuzee-global.css`, `prototype/assets/js/muuzee-global.js`, relevant shared modules, then the current page/component.
3. Search for an existing reusable component or behavior before adding one.
4. Decide whether the change is global, shared, or page-specific. Keep the change at the narrowest correct ownership boundary.
5. Implement against dynamic data. Do not depend on a particular Exhibition title, Artist, Venue UUID, image, item count, or fixture order.
6. Exercise missing image, empty data, long title, long Venue/Artist name, and loading/error states relevant to the change.
7. Verify desktop and mobile. For fixed layers, drawers, maps, horizontal rails, touch actions, or viewport-sensitive behavior, also perform the real-device checks required by `AGENTS.md`.
8. Run lint, typecheck, relevant tests, build, and the Design Guide font audit when applicable. A successful build does not replace visual verification.

## Rules

- Reuse Global Header, Footer/Bottom Navigation, Save/Seen, Map UI, section CTA, and other current shared implementations rather than copying them into a page.
- HTML owns prototype structure; global CSS/JS owns all-page behavior; shared modules own reusable behavior; page-specific files own only unique behavior.
- Reuse current tokens and typography. Do not introduce a new global rule to make one page fit.
- If a Global Design Rule changes, update `prototype/design-guide.html` in the same change and record a meaningful change in Notion according to `AGENTS.md`.
- Preserve semantic interaction boundaries: navigation links and action buttons remain separate controls.
- Update prototype asset cache-busting query values when shared CSS/JS changes.

## Verification

- Confirm the changed screen and representative consumers of every changed shared component.
- Check missing/long/dynamic data, keyboard/touch behavior, reduced motion where relevant, and unintended page-wide horizontal scrolling.
- Run only the environment operations authorized by the user; follow the LOCAL/STG/Production and Git boundaries in `AGENTS.md`.

## Output

Report changed files, reused components, new components, whether a Global Rule changed, desktop/mobile checks, tests, and known limitations. Include Git commands only as required by `AGENTS.md`; do not execute Git mutations without authorization.
