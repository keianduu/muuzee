# Muuzee Admin Control State Policy

## State families

Do not collapse interaction, selection, and data state into one visual vocabulary.

| Family | Values | Applies to | Required signals |
| --- | --- | --- | --- |
| Interaction | Default / Hover / Pressed / Focus Visible / Disabled | Buttons, links, fields, tabs, toggles | semantic control state plus visible change appropriate to the interaction |
| Selection | Selected / Unselected | Tabs, rows, filters, segmented choices | semantic selected state plus at least one non-color cue |
| Binary setting | On / Off | Switches and feature controls | checked state plus position/shape/text or another non-color cue |
| Data status | Active / Inactive | Entity or operational availability | status text plus restrained semantic styling |
| Publication | Published / Draft | Editorial release state | explicit text; never inferred only from color |
| Resolution | Resolved / Failed | Matching/sync/import outcome | explicit text and, when useful, icon or structural emphasis |

## Required interaction states

| State | Meaning | Visual requirement | Semantic requirement |
| --- | --- | --- | --- |
| Default | Available, not currently interacted with | Stable role hierarchy | Correct element type and accessible name |
| Hover | Pointer is over an available control | Subtle surface, border, underline, or emphasis change | Must not be the only way to reveal essential meaning |
| Pressed | Pointer/key activation is in progress | Immediate tactile change such as tone, inset, or small transform | Use native active behavior; do not imply a persistent selection |
| Focus Visible | Keyboard focus is on the control | High-contrast visible ring/outline with offset | Use `:focus-visible`; focus must not be clipped or removed |
| Disabled | Action is currently unavailable | Clearly unavailable but still identifiable; do not rely on low opacity alone | Native `disabled` when supported, otherwise `aria-disabled="true"` with blocked activation |

## Selection and toggle rules

- **Selected** is persistent choice state, not hover or press. Use `aria-selected`, `aria-current`, or checked semantics as appropriate.
- Selected tabs should use more than color alone: for example border/indicator plus weight or background.
- **Unselected** remains available. It must not look disabled.
- **On/Off** describes a setting or binary control, not whether a button can be clicked.
- Use a native checkbox, radio, or switch semantic before recreating one with generic elements.

## Disabled rules

- Disabled means the user cannot perform the action in the current state.
- If the reason is not obvious, provide adjacent explanatory text or an accessible description. Do not rely on a hover-only tooltip.
- Disabled must not be labeled Inactive. “Inactive” is a data/operation status.
- Preserve the control label and role; avoid reducing opacity until text or borders become unreadable.
- A loading action is not automatically disabled visually. Show progress and prevent duplicate activation while keeping its state understandable.

## Badge versus button

| Element | Purpose | Affordance |
| --- | --- | --- |
| Badge | Reports a status or category | Passive; no hover/pressed treatment and no pointer cursor |
| Button | Performs an action | Complete default/hover/pressed/focus-visible/disabled states |
| Toggle/Tab | Changes persistent view or selection | Selected state and semantic state attribute |
| Link | Navigates | Link semantics and recognizable navigation affordance |

Pill shape does not determine element type. Avoid giving passive badges the same border, fill, and hover cues as actionable controls.

## Data-status policy

- **Active / Inactive:** use only for entity availability, operating state, or a comparable domain status.
- **Published / Draft:** use only for editorial publication state.
- **Resolved / Failed:** use only for matching, synchronization, import, or processing outcome.
- Do not use “未設定” for a failed operation. Distinguish missing, not applicable, unresolved, and failed.
- Dangerous status colors do not automatically make a nearby action a Danger action.

## Review checklist

For each changed control, verify with pointer and keyboard:

1. Can the user identify whether it is actionable?
2. Can the user distinguish unavailable from merely unselected?
3. Can the user identify persistent selection without color alone?
4. Does keyboard focus remain visible?
5. Does the semantic state match the visible state?
6. Is passive status visually distinct from action affordance?
