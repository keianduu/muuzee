# Muuzee Project Instructions

## Project Context

Before starting project-related work, read:

`docs/project-context.md`

Use the Notion Project URL defined there to access the project specifications through the Notion MCP when the task requires approved product specifications, decisions, or project context.

The local project directory is `muuzee`.
The product name is `Muuzee`, and the repository name is `muuzee`.

---

## Required Inspection Order

After reading this file and `docs/project-context.md`, inspect the **current implementation** in this order before making project changes:

1. `prototype/design-guide.html`
2. `prototype/assets/css/muuzee-global.css`
3. `prototype/assets/js/muuzee-global.js`
4. Relevant shared `prototype/assets/css/muuzee-*.css` / `prototype/assets/js/muuzee-*.js` modules already used by the feature
5. The relevant existing page and its page-specific CSS / JavaScript
6. The relevant Muuzee specification, evidence, and Decisions in Notion **when the task depends on approved intent, or when a meaningful prototype change needs to be logged**

For Mode B and Mode C, the relevant Notion specification and Decisions are mandatory before implementation.

For Mode A, do not make Notion lookup a blocker for a tiny copy edit, minor CSS tuning, or an obvious bug fix that does not depend on an approved specification and does not need a Design & Implementation Log entry.

Do not skip directly to a page-specific file when an existing global rule or shared implementation may already cover the requested behavior.

Do not assume selectors, function names, DOM structure, or shared-module behavior from a previous conversation or an older commit. Inspect the current files first.

## Implementation Ownership

- HTML owns page structure, semantic content, and the composition of shared and page-specific modules.
- `prototype/assets/css/muuzee-global.css` owns rules shared by every page.
- `prototype/assets/js/muuzee-global.js` owns behavior shared by every page.
- Page-specific CSS and JavaScript own only behavior and presentation unique to that page.
- Reusable components and behaviors belong in shared `muuzee-*.css` / `muuzee-*.js` modules rather than copied implementations in individual pages.
- Do not fork or duplicate a common component merely to customize one page. Extend the shared component deliberately or keep the difference page-specific at the smallest valid boundary.
- Global Header, Footer, Hamburger Navigation, shared Save controls, shared Save / Seen actions, shared Map UI, and shared title-right CTAs must not be reimplemented independently per page when an existing shared implementation covers the behavior.
- Avoid title-specific, item-specific, or data-specific visual hacks. Prefer reusable classes, data attributes, IDs, image-ratio logic, and shared renderers.
- Do not nest an interactive control such as a `<button>` inside a clickable `<a>`. Use sibling controls or a semantic wrapper so navigation and actions remain independently clickable.
- When changing a Global Design Rule, update `prototype/design-guide.html` in the same change so the documented rule and shared implementation remain aligned.

## Design Guide Compliance

`prototype/design-guide.html` is the implementation reference for Prototype Global Design Rules.

Before writing or changing visual CSS:

1. Check the applicable typography, color, spacing, radius, icon, motion, and component rules in `prototype/design-guide.html`.
2. Reuse existing tokens, CSS custom properties, and shared components before introducing a new literal value.
3. Treat Primary `14px`, Secondary `12px`, and Tertiary `10px` as the default body-scale typography. Use heading sizes only as defined by the current Design Guide.
4. Do not introduce ad-hoc typography such as `9px`, `11px`, `13px`, `15px`, `17px`, or `18px` merely to make a layout fit. If a new size is genuinely required, treat that as a design-rule decision and update the Design Guide in the same change after approval.
5. A page-specific override must not silently break the shared component's alignment, spacing, typography, or state styling.
6. If `scripts/audit_design_guide_fonts.py` exists, run `python3 scripts/audit_design_guide_fonts.py --check-new` before completion. If it does not exist, manually inspect every changed `font-size` declaration against the Design Guide.

The user may explicitly request a page-specific exception. Keep that exception as narrow as possible and do not generalize it into a Global Rule unless explicitly approved.

## Current Shared UI Conventions

The exact implementation must always be verified in the current files, but the following shared patterns should be reused when present:

- Section-title right-side CTAs such as `すべて見る →`, `詳細検索 →`, `保存を見る →`, and `一覧を見る →` use the same shared CTA visual rather than page-specific variants. The current shared class is `.muuzee-section-cta`.
- Card Save controls use the shared Save-control implementation and saved-state visual. Do not add a second page-specific Save behavior to the same item.
- Save / Seen actions use the shared personal-action implementation and shared state model rather than separate page-local storage semantics.
- Home Map and Map page should reuse the shared Map pin / popup / tooltip behavior rather than diverging implementations.
- Header / Hamburger behavior belongs to Global CSS / JS.
- MyPage sections may have page-specific composition, but reusable controls inside them should still use the corresponding shared component.

When a shared class or module named above no longer exists in the current repository, follow the current implementation instead of recreating an obsolete one.


---

## Core Operating Principle

Use three distinct layers:

1. **Notion = approved product intent and decisions**
2. **`prototype/` = exploratory UI/UX workspace**
3. **`src/` = production implementation**

Do not promote exploratory prototype changes into approved Notion specifications.

Meaningful prototype changes that affect future design or implementation decisions must still be recorded in the Muuzee Design & Implementation Log as `Draft`.

Do not treat prototype implementation details as approved specifications unless the user explicitly approves them.

---

## Source of Truth

### Notion is the source of truth for approved service intent

Use Notion for:

- Product and business strategy
- Approved product requirements and service operations
- Approved UX and experience specifications
- Marketing and go-to-market planning
- Brand and design-system specifications
- Research, evidence, hypotheses, and assumptions
- Roadmap and outcomes
- Tasks
- Decisions
- Release information

### Local files are the source of truth for implementation state

Use local files for:

- Source code
- Prototypes
- Assets
- Tests
- Development configuration

Within the prototype, `prototype/design-guide.html` is the source of truth for the **current prototype Global Design Rules**. It may still be exploratory and does not by itself promote a rule into an approved product specification.

### External-source AI transformation

- AI is never the content source. Preserve the actual source type and field-level source URL; CSV is only transport.
- For Venue Source B, Codex may structure only text and metadata captured by the Official Website Crawler. Do not add web search, third-party data, general knowledge, or guesses.
- Preserve existing values. Fill blanks by default; record conflicts or ambiguity instead of overwriting.
- Source priority is `Manual > Official Website > Trusted API > Wikidata`.
- Mark AI-transformed fields with `generated_by_ai=true` in provenance while keeping `source=official_website`.
- LOCAL runs use only the sample size needed for a decision. Do not run full AI enrichment, production crawling, or scheduled synchronization without explicit approval.

### Prototype status

`prototype/` is intentionally experimental.

A prototype may contain:

- unapproved UI directions
- temporary copy
- placeholder data
- temporary interactions
- exploratory layout choices
- incomplete states

Do not infer that something is a product requirement only because it exists in `prototype/`.

---

## Working Modes

Always determine which mode the current task belongs to.

### Mode A — Prototype Discovery

Use this mode when the user is:

- exploring UI ideas
- adjusting layout, typography, imagery, motion, or interaction
- comparing design directions
- iterating responsive behavior
- building or revising a visual prototype
- asking to “try”, “see”, “test”, or “make an image / prototype”

Rules:

1. Work primarily inside `prototype/`.
2. Read `docs/project-context.md`.
3. Follow the Required Inspection Order and inspect the actual current implementation before changing it.
4. Preserve existing Global Rules and shared components unless the user is intentionally exploring a change to them.
5. Record meaningful UX, component, global-rule, data, navigation, state, integration, architecture, or feature-specification changes in the Muuzee Design & Implementation Log as `Draft`.
6. Do **not** create Requirement IDs for exploratory UI.
7. Make the smallest reasonable prototype change.
8. Validate desktop and mobile behavior; use real-device validation when the change involves fixed headers, drawers, overlays, safe areas, horizontal scrolling, touch interaction, or viewport-dependent behavior.
9. Run applicable Design Guide / syntax / shared-component checks before completion.
10. Summarize what changed.
11. Do not log simple copy edits, minor CSS tuning, or obvious bug fixes that do not affect future design decisions.
12. Commit meaningful checkpoints to Git when requested or when the user asks to publish the latest prototype.

Prototype exploration should remain fast.

### Mode B — Approved Specification Change

Use this mode when the user explicitly approves a direction or says it should become part of the service specification.

Examples:

- “これで行きましょう”
- “採用で”
- “仕様にしてください”
- “Notionにも反映してください”
- “これを正式なデザインルールにしてください”

Rules:

1. Follow the Required Inspection Order in this file.
2. Confirm what is being promoted from prototype to approved intent.
3. Update the relevant Notion page.
4. Add or update a `Decisions` entry when the decision is meaningful.
5. Update `docs/` only when Codex needs durable implementation context that should not live only in Notion.
6. Keep the prototype aligned with the approved direction.
7. Commit the related local changes to Git when requested.

### Mode C — Production Implementation

Use this mode only after the user explicitly asks to implement the real service or move approved behavior into production code.

Rules:

1. Read `docs/project-context.md`.
2. Follow the Required Inspection Order in this file, including the relevant Notion specifications and Decisions.
3. Confirm which prototype direction is approved for production use.
4. Implement production code under `src/`.
5. Treat `prototype/` as a visual and UX reference, not as production architecture.
6. Do not directly evolve prototype HTML into production architecture unless explicitly instructed.
7. Validate implementation against the approved specification.
8. Add tests where appropriate.
9. Report remaining differences between prototype, specification, and production implementation.

---

## Recommended Local Structure

```text
muuzee/
├── AGENTS.md
├── README.md
│
├── docs/
│   ├── project-context.md
│   ├── architecture.md      # create when production architecture starts
│   └── decisions/           # optional technical notes only
│
├── prototype/
│   ├── index.html           # HOME / default prototype entry
│   ├── exhibition.html
│   ├── exhibitions.html
│   ├── museum.html
│   ├── museums.html
│   ├── artist.html
│   ├── artists.html
│   ├── map.html
│   ├── saved.html
│   ├── seen.html
│   ├── favorites.html
│   ├── my-art.html
│   ├── design-guide.html
│   └── assets/
│       ├── css/
│       ├── js/
│       └── images/
│
├── scripts/
│   └── ...                  # repository checks / maintenance scripts when needed
│
└── src/
    └── ...                  # production implementation; can remain empty for now
```

Keep the structure simple until complexity is actually needed.

Do not create a new framework, package structure, or architecture only for future possibilities.

---

## Prototype File Rules

### Canonical filenames

Use stable filenames such as:

- `prototype/index.html`
- `prototype/exhibition.html`
- `prototype/museum.html`

Do not create:

- `home_v2.html`
- `home_v7_final.html`
- `home_latest2.html`

Use Git history for versioning instead.

### Assets

Prototype reusable assets belong under `prototype/assets/`.

Prefer the existing responsibility split:

```text
prototype/assets/css/
prototype/assets/js/
prototype/assets/images/
```

Shared CSS / JS should stay in the shared modules under those directories. Page-specific CSS / JS should contain only page-specific implementation.

Reusable images should be stored under `prototype/assets/images/` rather than duplicated across pages when practical.

Temporary external image URLs may be used while exploring, but reusable prototype assets should be localized when practical so GitHub Pages and device validation do not depend unnecessarily on third-party availability.

Temporary one-off assets may remain local to a prototype only while actively exploring.

## Safe Editing and Validation

Before changing code, inspect the current file structure and the exact target selectors / functions. Do not write a transformation based only on an earlier conversation, old screenshot, or assumed function name.

For scripted or automated edits:

1. Pull or inspect the current target revision first.
2. Perform pre-flight checks for every required anchor before writing when practical.
3. Prefer semantic or structural anchors over brittle full-block string matches.
4. Validate the transformed result before commit.
5. If a script can partially modify files before failing, restore only the files touched by that failed attempt before retrying.
6. Do not silently overwrite unrelated local changes.

Validation requirements:

- Run JavaScript syntax validation such as `node --check` for changed JavaScript when Node is available.
- Run relevant repository checks, including the Design Guide font audit when present.
- When a shared component changes, verify the main pages that consume it, not only the page where the bug was reported.
- Validate desktop and mobile layouts.
- Check for unintended page-wide horizontal scrolling. Intentional rails / tabs may scroll horizontally; the page itself should not.
- For fixed / sticky UI, drawers, overlays, maps, popups, and headers, verify stacking order and mobile safe-area behavior.
- For touch actions, confirm that Save / Seen / menu controls do not trigger the surrounding card navigation.
- When a CSS or JavaScript asset changes, update the existing `?v=` cache-busting query used by affected prototype pages so GitHub Pages and real-device checks load the new asset.

A successful build or syntax check does not replace visual validation.


---

## Git Workflow

Git should be used from the prototype phase onward.

Repository:

`https://github.com/keianduu/muuzee`

Local working directory:

`/Users/kei.ando/Documents/my-project/muuzee`

### Simple workflow

Use `main` as the primary branch while the project is small.

Typical flow:

```text
UI discussion / exploration
        ↓
Required Inspection Order
        ↓
prototype/ update
        ↓
Design Guide / syntax / shared-component checks
        ↓
desktop + mobile browser validation
        ↓
git diff
        ↓
commit
        ↓
push
        ↓
GitHub Pages / real-device preview
```

Prefer small meaningful commits.

Example commit messages:

```text
prototype: refine home hero
prototype: add featured artist portraits
prototype: add museum map
design: approve Muuzee home IA
spec: sync approved ArtWall behavior
feat: implement exhibition detail
```

Do not save versions by duplicating HTML files.

### GitHub Pages

During prototype development, publish the prototype for browser / mobile review.

Preferred preview path:

`https://keianduu.github.io/muuzee/prototype/`

If a root `index.html` is used, it may redirect to `prototype/`.

Do not treat GitHub Pages deployment as a production release unless explicitly stated.

---

## Promotion Workflow: Prototype → Specification

A prototype does not automatically become the specification.

Promote a design only when the user explicitly approves it.

When approved:

```text
prototype exploration
        ↓
user approval
        ↓
Notion UX / Brand / Requirement update
        ↓
Decision entry if meaningful
        ↓
Git commit
```

Examples of items worth recording in the Design & Implementation Log, and promoting to the formal specification when approved:

- Global Design Rules or Design Guide token changes
- shared component behavior such as global section CTAs, Save / Seen actions, Header / Hamburger, or Map UI
- Home information architecture
- navigation model
- brand copy
- major interaction behavior
- responsive behavior that affects UX
- component rules
- design tokens
- product capability decisions

Examples that normally do **not** need Notion updates:

- 52vh → 55vh
- 46px → 54px during exploration
- small margin adjustments
- temporary image substitutions
- minor border-radius tuning
- intermediate map styling experiments

Git preserves these implementation changes.

---

## Notion Information Architecture

The project uses the following top-level Notion structure:

1. `00 Inbox`
2. `01 Product Strategy`
3. `02 Product Requirements`
4. `03 UX & Experience`
5. `04 Marketing & GTM`
6. `05 Brand & Design System`
7. `06 Research & Evidence`
8. `07 Release Notes`
9. `Tasks`
10. `Decisions`

`Muuzee Design & Implementation Log` is maintained under `07 Release Notes` so implementation history remains available without adding another top-level project section.

Business, Growth, and Roadmap information belongs in `01 Product Strategy` rather than separate top-level pages.

Data, Platform, Legal, and Operations specifications belong in `02 Product Requirements` rather than separate top-level pages.

---

## Information Classification

Classify approved or durable information as follows:

- Unsorted notes, raw ideas, source material, research inputs, and material awaiting review by Codex -> `00 Inbox`
- Vision, problems, target users, value proposition, positioning, business model, monetization, pricing, revenue targets, growth loops, product KPIs, strategy, and roadmap outcomes -> `01 Product Strategy`
- Capability candidates, approved functional and non-functional requirements, data model, APIs, architecture, frontend/backend boundaries, auth, storage, analytics, legal constraints, service operations, and admin/CMS specifications -> `02 Product Requirements`
- Experience concept, user journey, information architecture, navigation, user flows, screens, interaction behavior, UI states, responsive behavior, and accessibility behavior -> `03 UX & Experience`
- Target audience, JTBD, acquisition, GTM, launch, channels, SEO, SNS, content, referral, partnership, inbound, campaigns, and marketing KPIs -> `04 Marketing & GTM`
- Brand purpose, personality, emotional value, visual direction, typography, color, layout, illustration, icons, motion, design principles, tokens, components, UI patterns, voice, accessibility standards, and quality standards -> `05 Brand & Design System`
- Market, competitor, and user research; PMF evidence; data; assumptions; open questions; and validation results -> `06 Research & Evidence`
- Shipped changes and release history -> `07 Release Notes`
- Concrete, executable work with a clear completion condition -> `Tasks`
- Important product, business, UX, technical, marketing, brand, design, or operational decisions -> `Decisions`

Preserve important raw source material in `00 Inbox` or `06 Research & Evidence` even after synthesizing it elsewhere.

---

## Evidence and Uncertainty

Always distinguish:

- **Fact**: supported by an attributable source or direct observation
- **Hypothesis**: a testable prediction or explanation
- **Assumption**: an unverified premise currently being used

Never present a hypothesis or assumption as fact.

Do not infer or finalize undecided brand or design specifications.

During Prototype Discovery, speculative directions are allowed, but they remain exploratory until explicitly approved.

---

## Capability vs Requirement

Do not turn an idea into a Requirement automatically.

- Put ideas, possible features, and capabilities under the `Capability Map` in `02 Product Requirements` only when they are ready to be recorded as durable product candidates.
- Assign a Requirement ID such as `REQ-001` only after implementation is explicitly decided and the scope and acceptance criteria are clear.
- Tasks are for executable work, not for storing feature ideas or unresolved product concepts.
- When a capability becomes a Requirement, preserve its supporting evidence and link relevant Decisions.

Prototype existence alone is not sufficient reason to create a Requirement.

---

## Master Data Source Policy

For canonical Master fields, use the default priority `Manual > Official Website > Trusted API > Wikidata`.

CSV is a transport rather than a trust level. A CSV produced from a known source must declare that source (for example, Source B exports use `source_type = official_website`). An undeclared generic CSV must not automatically displace an attributable source.

- Save directly stated values from a reliable source at the explicit import confirmation boundary; do not add a separate field-by-field accept/reject step.
- Require human judgment only when equally credible candidates cannot be resolved uniquely or when an explicit higher-priority override is requested.
- Never let enrichment overwrite Manual provenance automatically.
- Preserve field provenance, source URL, value snapshot, timestamp, AI-generation flag, and current/history state even when field-level review is unnecessary.
- Use content-wide Publish / Unpublish as the final release control.
- Official Website Source B must remain `Crawl → CSV Download → CSV Preview → Confirm → DB`; the crawler must never update Venue Master directly.
- Source B must stay on the official domain, honor robots.txt, and use bounded pages, response size, timeout, retry, delay, and concurrency.
- Description source text is evidence, not Muuzee copy. AI-assisted description text must be explicitly marked and must not be presented as a source quotation.

---

## Before Work

For prototype, approved specification, and production work:

1. Read `docs/project-context.md`.
2. Read `prototype/design-guide.html`.
3. Read `prototype/assets/css/muuzee-global.css`.
4. Read `prototype/assets/js/muuzee-global.js`.
5. Inspect the relevant shared `muuzee-*.css` / `muuzee-*.js` modules.
6. Inspect the relevant existing page and its page-specific CSS / JavaScript.
7. Determine whether the task is Prototype Discovery, an Approved Specification Change, or Production Implementation.
8. Read the relevant Notion specification, evidence, and Decisions when approved intent is needed. This is mandatory for Mode B and Mode C.
9. For Mode A, consult Notion when an approved specification may constrain the change or when a meaningful prototype change will be recorded in the Design & Implementation Log.
10. Compare approved intent with the current implementation and report meaningful conflicts before making an ambiguous product decision.
11. Identify the validation required for the change before editing: typography audit, JavaScript syntax, shared-component regression, desktop/mobile, or real-device behavior.

The depth of review should be proportional to the change, but the ownership boundaries and local inspection order above remain the default.

A tiny copy edit, minor spacing adjustment, or obvious local bug fix should not require an unnecessary Notion research pass when it does not depend on approved intent. Do not make assumptions when an approved specification does exist.


---

## Specification Conflicts

If the Notion specification and current implementation conflict:

1. Treat Notion as authoritative for **approved product and service intent**.
2. Treat local files as authoritative for **current implementation state**.
3. A prototype may intentionally differ from Notion during exploration.
4. Do not silently promote a prototype difference into the specification.
5. Report conflicts before making ambiguous product decisions.

---

## Notion Changes

Never change Notion outside the scope authorized by the user. Preserve the Project relations and filtered linked views for `Tasks` and `Decisions`.

### Muuzee Design & Implementation Log

Use the `Muuzee Design & Implementation Log` database under `07 Release Notes` when a code or project-structure change affects any of the following:

- UX / UI structure
- component design
- Global Design Rules
- data structure
- URL / SEO design
- navigation
- state management
- APIs or external service integrations
- Save, Visit, ArtWall, or other feature specifications
- architecture or directory structure
- a technical decision that will influence future implementation

Each entry must include:

- Date
- Area / Feature
- What changed
- Why
- Main files
- Design / implementation decision
- Impact
- Status

Use these statuses:

- `Draft`: exploratory or provisional, including changes still being tested in `prototype/`
- `Approved`: use only when the user explicitly says the direction is adopted, such as “採用”, “これで行く”, or “仕様にする”
- `Deprecated`: retained for history but no longer current

Do not create a log entry for simple wording changes, tiny CSS adjustments, or obvious bug fixes that do not affect future design decisions.

The Design & Implementation Log records implementation-relevant history; it does not automatically make a change an approved Requirement or Decision. For an important approved specification, also update the appropriate formal Notion page and add or update a `Decisions` entry when appropriate.

---

## Implementation Workflow

### Prototype

1. Follow the Required Inspection Order.
2. Confirm whether an existing shared component or Global Rule already covers the request.
3. Make the smallest reasonable change.
4. Preserve existing visual conventions unless intentionally exploring a new direction.
5. Validate Design Guide compliance for changed UI, including typography.
6. Validate JavaScript / markup behavior where relevant.
7. Validate desktop and mobile; use real-device validation for viewport, fixed-layer, overlay, map, or touch-sensitive changes.
8. If shared CSS / JS changed, update the affected asset cache-busting version and check representative consuming pages.
9. Summarize changed files and any remaining prototype-only assumptions.
10. Commit meaningful checkpoints only when requested.

### Production

1. Follow the Required Inspection Order.
2. Inspect the production files after identifying the approved prototype behavior and relevant Notion specification.
3. Make the smallest reasonable production change.
4. Preserve existing conventions and shared-component ownership.
5. Validate the result against the approved specification and design rules.
6. Add or update tests where appropriate.
7. Summarize changed files.
8. Report remaining differences from the approved specification.

### Required completion report

After code and any required Notion updates, report:

1. Changed files
2. Main changes
3. Design Guide / shared-component validation performed
4. What was recorded in Notion
5. Draft / Approved status
6. Points to verify, including desktop / mobile / real-device items when relevant
7. Terminal commands needed to reflect the change in Git

Do not commit or push unless the user explicitly requests it. Stage only files that belong to the current task.


---

## Directory and Repository Identity

- Local directory: `/Users/kei.ando/Documents/my-project/muuzee`
- GitHub repository: `https://github.com/keianduu/muuzee`
- Primary branch: `main`

Do not introduce absolute references to the retired pre-rename project path. Prefer repository-relative paths in project files whenever possible.

---

## Project Boundaries

This AGENTS.md applies only to the `muuzee` project.

Do not use specifications, research, Tasks, or Decisions from other projects under `my-project`.

Do not modify files outside this project unless the user explicitly requests it.

<!-- muuzee-simple-implementation:start -->
## Simple Implementation Principle

Muuzeeの実装では、要件を満たす範囲で**最もシンプルで保守しやすい実装を優先する**。

- まず、既存のEvent / State / Shared Component / DOM構造で直接解決できないか確認する。
- 直接対応できる値や状態がある場合、推測・近似判定・間接的な監視処理を先に選ばない。
- 不要な `MutationObserver`、重複State、変換Layer、個別Adapter、推測ロジック、同じ責務を持つ複数実装を安易に追加しない。
- 共通Componentや既存ロジックを再利用できる場合は、新しい独自実装より再利用を優先する。
- シンプルな実装では要件を満たせない、または明確なUX / 技術上の問題がある場合のみ、必要な範囲で複雑化する。
- 「複雑な方が柔軟そう」「将来使えそう」という理由だけで、現時点で不要な抽象化や仕組みを追加しない。
- Prototypeで一時的な補助処理が必要な場合も、本番設計へ移行しやすい最小限の構造に留める。
- 実装前に、同じ役割の直近実装・既存Shared Component・Design Guideを確認し、それを基準に最小差分で修正する。

実装は原則として、以下の順序で進める。

`方針検討 → 調査 → 方針FIX → 実装 → 確認 → 完成`

各工程で不要な複雑化が入っていないか確認し、完成前に不要な処理・重複ロジック・一時的な回避策を整理する。
<!-- muuzee-simple-implementation:end -->
