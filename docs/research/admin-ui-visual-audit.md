# Muuzee Admin UI Visual Audit

Date: 2026-09-07  
Status: Draft  
Scope: Current LOCAL Admin implementation. The initial observations below were recorded before implementation; the final section records the LOCAL v1 outcome.

## Routes and interactions checked

- `/admin`
- `/admin/imports`
- `/admin/exhibitions`
- `/admin/venues`
- `/admin/artists`
- `/admin/works`
- Venue filters and filter submission
- Venue drawer tabs: status, edit, and data
- Works tabs: accepted works and work candidates
- Enabled, disabled, primary, secondary, and danger actions
- Wide desktop, intermediate width, and narrow/mobile layouts

## Facts observed in the current rendered build

### Control and state clarity

1. Disabled secondary actions are communicated mainly by reduced opacity, so they can resemble low-priority or unselected controls.
2. Selected view tabs use a bottom indicator and color/weight change; semantics are present, but the visible distinction becomes subtle in dense contexts.
3. Status badges and action buttons often share pill-like geometry, reducing the immediate distinction between passive state and an available action.
4. Long action bars contain many controls with similar weight, so the main next action is not always obvious.
5. Mixed action, selection, and data-state labels make it easy to misuse terms such as Inactive unless the state families are explicitly governed.

### Spacing and section hierarchy

1. Filter panels use a large bordered surface and equal grid gaps even when controls serve different purposes.
2. At narrow width, the Venue filter area becomes substantially taller than the initial data view, delaying access to the table.
3. The Admin header wraps into a tall multi-row block at narrow width.
4. Drawers contain several card-like sections and broad vertical gaps, which can make evidence-heavy records longer to scan.
5. Page, section, group, and field spacing are not always clearly differentiated.

### Typography and density

1. Main Admin page titles are close to editorial/hero scale relative to the operational content beneath them.
2. Drawer titles are also large relative to form labels and evidence metadata.
3. Common control text is comparatively large for dense filter and action regions.
4. Narrow grid cells can wrap button labels into tall controls, producing CTA-like blocks for routine Admin actions.
5. Table metadata can become visually subordinate while controls and headings remain large, weakening scan efficiency.

### Tables, filters, and drawers

1. Wide tables require substantial horizontal scanning; some evidence/provenance content can become clipped or dense inside drawers.
2. Filters wrap responsively, but grouping and action placement do not always remain obvious after wrapping.
3. Venue list context is preserved by a drawer, which is a useful existing pattern to retain.
4. Works already uses tabs to separate accepted works and candidates; the selected semantics should remain part of the shared convention.
5. Infinite loading is described in the Venue list, so polish must preserve filter, selection, scroll, and row-position context during mutations.

## Priority recommendations

### High

- Establish the interaction/selection/data-state vocabulary and disabled-control policy.
- Normalize action hierarchy across lists, drawers, filters, and bulk actions.
- Make badge, button, tab, and toggle affordances consistently distinct.

### Medium

- Reduce operational title and control scale while preserving readable metadata.
- Define Page > Section > Group > Field > Inline spacing and apply it through shared Admin patterns.
- Improve narrow-width filter/header composition without hiding required operations.
- Make contained table/drawer overflow deliberate and readable.

### Preserve

- Existing stack and shared Admin architecture.
- Drawer-based list context.
- Semantic selected states already present in view tabs.
- Current Muuzee palette and design tokens unless a durable Admin semantic token is demonstrably needed.

## External research applied

The audit adapted durable ideas from the following public Skills: inspect the repository before changing architecture; treat hierarchy, complete interaction states, accessibility, and responsive rendering as part of completion; prefer restrained density; avoid card/shadow proliferation; and verify the rendered page rather than relying on compilation alone.

- Interface Design: https://github.com/dammyjay93/interface-design
- Frontend Production shadcn: https://github.com/wzx2002/codex-frontend-skill/blob/main/SKILL.md
- UI/UX Pro Max: https://github.com/nextlevelbuilder/ui-ux-pro-max-skill
- Frontend Design Codex (supplementary): https://github.com/KilimiaoSix/frontend-design-codex-skill/blob/main/SKILL.md

These sources were used as research inputs only. Muuzee does not adopt their frameworks, dependencies, branding, or generic product style.

## Admin Common Visual System v1 outcome

Implemented on 2026-09-07 as a shared Admin-only visual layer in `src/app/globals.css`.

- Control state: Primary actions use the dark filled control; Secondary actions use a bordered white control; Tertiary actions use a transparent control; Danger remains reserved for destructive actions. Disabled actions now have an explicit gray surface, border, and text color at full opacity instead of relying on opacity alone.
- Selection state: Work view tabs use a contained segmented-control surface. The selected tab has a white surface, border, and subtle elevation in addition to `aria-selected`.
- Data state: status badges use compact, low-radius passive labels so they no longer resemble actionable pill buttons.
- Typography: operational Page Titles are fixed at 24px, Section Headings at 17px, common body/control text at 14px/13px, and metadata at 12px or 11px.
- Spacing: the Admin layer uses a restrained 4/8/12/24/32 scale for inline, field, group, section, and page relationships.
- Forms and filters: controls share a 36px minimum height, filters use denser gaps and padding, and mobile filters retain a two-column layout where practical.
- Header and drawers: the desktop Admin header is 49px high; the mobile header uses a single horizontally scrollable navigation row. Drawer headers are 88px desktop / 84px mobile, with 22px / 20px titles and 42px detail tabs.
- Accessibility: keyboard focus is visible across links, buttons, form controls, and disclosure summaries. Disabled controls retain readable contrast and do not respond to hover/active transforms.

LOCAL verification covered all six Admin routes, Venue / Artist / Work drawers, and viewport widths of 1440, 1024, and 390 pixels. No document-level horizontal overflow or Runtime Error overlay was observed. The existing contained table overflow remains intentional.
