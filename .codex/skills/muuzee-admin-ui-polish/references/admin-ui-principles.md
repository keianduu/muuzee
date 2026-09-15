# Muuzee Admin UI Principles

## Product character

Muuzee Admin is an operational editorial and Master Data tool. It should feel quiet, compact, clear, reliable, and consistent. Optimize for repeated scanning and safe decisions, not visual novelty, decorative density, or a generic SaaS appearance.

The public-product principle “Art first. UI stays quiet.” still applies, but Admin prioritizes operational clarity over editorial drama.

## Audit before polish

Always inspect the rendered interface before editing. Review the target route and a comparable route so a local improvement does not create a new convention.

Exercise, when present:

- primary, secondary, tertiary, and dangerous actions;
- enabled, disabled, hover, pressed, and keyboard-focus states;
- filters, tabs, selections, checkboxes, toggles, and bulk actions;
- table rows, long labels, missing values, status badges, and row detail navigation;
- drawers, their tabs, edit forms, close behavior, internal scroll, and error feedback;
- loading, empty, error, partial, and success states;
- desktop, intermediate, and narrow/mobile layouts;
- pagination or infinite loading, including whether context and row position are preserved.

Record observations as facts from the current rendered build. Separate them from proposed remedies.

## Action hierarchy

Use one dominant action only when the current context truly has a single safest next step.

- **Primary:** the main forward action for the current task. Avoid multiple equally strong primary buttons in one group.
- **Secondary:** an important alternative or supporting action. It must still look interactive.
- **Tertiary / Ghost:** navigation, disclosure, low-emphasis utilities, or reversible minor actions.
- **Danger:** a destructive or difficult-to-recover action. Do not use danger styling for ordinary cancellation or non-destructive removal from a view.

Keep hierarchy stable across Venues, Artists, Works, Exhibitions, Imports, and Dashboard. Do not promote an action merely because it is newly implemented.

## State language

Keep three state families separate:

1. **Interaction state:** Default, Hover, Pressed, Focus Visible, Disabled.
2. **Selection state:** Selected/Unselected and On/Off.
3. **Data status:** Active/Inactive, Published/Draft, Resolved/Failed.

The same words and visual treatments must not drift between these families. See `control-state-policy.md` for the required matrix.

## Spacing and section boundaries

Apply the hierarchy:

`Page > Section > Group > Field > Inline > control internal`

The gap between sections must be greater than the gap between controls inside a group. Related labels and values should be closer to one another than to the next field.

Separate sections with the minimum sufficient signal:

1. spacing;
2. a heading or label;
3. a restrained border;
4. a subtle background change;
5. a card only when the region is an independent object or task surface.

Avoid repeated cards, large radii, and shadows when hierarchy can be established with spacing and rules. Keep filter blocks and action bars compact enough that the table remains visible near the top of operational pages.

## Typography

Admin typography should support scanning rather than presentation. As a starting range, not an absolute rule:

- Page title: about 20–24px.
- Section heading: about 14–18px.
- Body and controls: about 13–15px.
- Metadata and auxiliary labels: about 12–13px.

Use current Muuzee fonts and tokens first. Large display typography belongs to public/editorial surfaces, not routine Admin screens. Avoid solving density by making metadata illegibly small; adjust hierarchy, spacing, and column design together.

## Tables and filters

- Tables are scan and compare tools. Preserve column alignment, predictable row height, and visible headers.
- Keep the entity name and the most decision-relevant state visually dominant.
- Use placeholders consistently for missing data; do not let “未設定”, zero, empty, and failed mean the same thing.
- Prevent row actions from triggering surrounding row navigation.
- Allow contained horizontal scrolling for genuinely wide data, while preventing page-wide overflow.
- Keep filters grouped by purpose and label every control. On narrow screens, use intentional stacking or compact disclosure instead of accidental wrapping.
- Preserve filter, tab, selection, and scroll context after row mutations whenever technically feasible.
- Make bulk actions clearly dependent on selection and explain why unavailable actions are disabled when the reason is not obvious.

## Drawers and forms

- A drawer should preserve list context while supporting one focused task.
- Keep its title compact, close action obvious, tabs semantically selected, and body independently scrollable.
- Group forms by meaning, not merely by fitting fields into columns.
- Labels, help, validation, and save state must remain connected to their controls.
- Avoid placing raw diagnostics above the human-readable summary. Put technical evidence in a clearly labeled detail area.
- Ensure long provenance, URLs, IDs, and source evidence wrap or scroll within their own region.

## Responsive behavior

- Validate wide desktop, intermediate width, and narrow/mobile, even if Admin is primarily desktop.
- Do not let navigation wrapping consume most of the initial viewport.
- Avoid controls growing to large multi-line pills because a grid cell became narrow.
- Preserve usable touch targets without turning every control into a large mobile CTA.
- Drawers should become full width only when necessary and must respect viewport height and safe areas.

## Accessibility baseline

- Use buttons for actions, links for navigation, tabs with selected semantics, and native disabled behavior where applicable.
- Every input needs a programmatic label; icon-only controls need an accessible name.
- Use `:focus-visible` with a clearly visible outline or ring that is not clipped.
- Pair status color with text, icon, border, shape, weight, or another non-color signal.
- Keep disabled controls legible enough to identify while unmistakably unavailable.
- Preserve keyboard navigation order and visible focus in drawers and scroll regions.

## Definition of polished

Polish is complete only when the rendered interface has been checked, interaction and data states remain semantically distinct, shared conventions are reused, responsive behavior is intentional, and no functional information was removed to improve appearance.

External UI Skills informed the audit discipline, interaction completeness, restrained density, and repository-first approach. Their frameworks and component libraries are not Muuzee requirements; this reference adapts only durable principles to the current stack.
