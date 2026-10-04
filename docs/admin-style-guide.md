# Muuzee Admin Style Guide

Status: Canonical v1.1 visual contract. Notion `09 Admin Style Guide` is the approved product/design source; this file is its implementation-facing reference for Codex and the Production Admin.

## Ownership

- This document owns shared Admin visual tokens, component appearance, control hierarchy, and responsive presentation.
- `docs/admin-ux-v2.md` owns Admin information architecture, navigation behavior, drawer state, URL state, focus, Escape, Back, and feature workflows.
- `src/app/globals.css` is the current implementation of these Admin visual rules.
- Public Muuzee UI remains governed by `prototype/design-guide.html`; Admin-specific values below do not change that public design system.

## Principles

- Quiet contrast: use surface, border, weight, and spacing before stronger color.
- Dense, not cramped: operational information stays visible while hierarchy remains scannable.
- Soft geometry: restrained radii and shadows distinguish layers without turning every section into a card.
- State semantics: actions, selections, and passive data statuses must remain visually distinct.

## Canonical tokens

### Color

| Token | Value | Role |
| --- | --- | --- |
| `--ink-950` | `#1D1D18` | Primary text and primary action |
| `--ink-800` | `#3E3E38` | Strong secondary text / focus |
| `--ink-600` | `#62625A` | Secondary text and inactive navigation |
| `--ink-500` | `#82827B` | Metadata and labels |
| `--ink-400` | `#ADACA8` | Disabled text |
| `--ink-300` | `#C8C7C1` | Control border |
| `--shell` | `#E5E4DF` | Admin shell background |
| `--sidebar` | `#F5F6F0` | Sidebar surface |
| `--surface` | `#F7F8F4` | Quiet grouped surface |
| `--surface-strong` | `#FBFBF8` | Main and elevated surface |
| `--surface-hover` | `#EEEEE8` | Hover / selected support surface |
| `--line` | `#DEDED8` | Standard divider |
| `--line-soft` | `#E9E9E4` | Subtle divider |
| `--success` | `#6D8368` | Positive status |
| `--warning` | `#9D8159` | Warning status |
| `--danger` | `#9A625C` | Destructive action / error |

### Typography

- UI Sans: `Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`.
- Display Serif: `Georgia, "Times New Roman", serif`; no external font dependency.
- Page title: 34px / 37px, serif, weight 400.
- Section heading: 20px / 25px, weight 650.
- Label and body: 14px / 20–21px.
- Control text: 13px when needed for dense operational controls.
- Metadata: 12px / 18px.

### Spacing, shape, and elevation

- Spacing scale: 4, 8, 12, 16, 20, 24, 32, 40, 48, 64px.
- Desktop content gutter: approximately 44px.
- Control radius: 8px; grouped/tab surface: 12px; card: 16px; pill: 999px.
- `shadow-1`: `0 1px 1px rgba(29,29,24,.04), 0 5px 14px rgba(29,29,24,.05)`; subtle card, selected tab, or light elevation only.
- `shadow-2`: `0 8px 28px rgba(29,29,24,.08)`; drawer, popover, or comparable floating layer only.

## Shell and navigation

- Desktop sidebar is approximately 288px and uses the sidebar surface.
- Desktop sidebar internal padding is compact: approximately 14px inline/top and 16px bottom. Brand uses 8px inline padding with 10–16px spacing before navigation.
- Navigation groups use approximately 16–20px separation, with 3–4px between rows. Group labels remain 12px quiet text without forced uppercase or strong tracking.
- Navigation rows are 34–36px high with 16px inline SVG icons and 10–12px horizontal padding.
- Inactive navigation uses `ink-600`; hover uses `surface-hover`.
- Active navigation uses a quiet `surface-hover` selection and stronger `ink-950` text weight. It uses neither elevation nor a required structural marker and must not use a solid black fill.
- `aria-current="page"` and visible keyboard focus remain required.
- At 760px and below, the existing horizontally scrollable navigation fallback is retained. Horizontal overflow must stay inside the navigation, not the document.

## Shared components

### Buttons

- Minimum height 36px, 8px radius, 14px horizontal padding.
- Primary is `ink-950` with white text.
- Secondary is a strong neutral surface with a line border.
- Tertiary is transparent until hover.
- Danger is reserved for destructive actions.
- Disabled is an explicit neutral surface/border/text state, never opacity alone.

### Search, filters, tabs, and pills

- Search is a 40px pill-shaped input where an existing keyword field is present.
- Form filters remain 36px standard fields with an 8px radius. Select controls use a consistent local chevron and reserve sufficient right padding.
- Toolbar/filter actions remain content-sized and align to the control baseline rather than stretching to an input column width.
- Context/view tabs use a contained neutral surface with a bordered/elevated active item.
- Detail tabs use the same contained selection language.
- Status chips are passive 24px pill labels and must not resemble action buttons.
- Detailの画像状態は`未取得 / 画像なし / 候補あり / 利用不可 / 利用可能`の5つを常にpassive chipとして並べ、currentだけをborder、surface、weight、`✓`で強調する。Primary有無、candidate件数、raw `image_search_status`はこのHuman-facing stateへ混ぜない。
- Requirement chipは充足済みをgreen + `✓`、公開必須の未充足をred、任意の未充足をneutral grayで示す。未充足chipへ`○`等の疑似状態iconを付けない。

### Cards and tables

- Cards use the quiet `surface`, subtle line, 16px radius, 16–18px padding, and only `shadow-1`.
- Tables retain deliberate contained horizontal scrolling when their columns require it.
- Table headers use quiet surface separation and metadata-scale type.

### Drawer

- Primary and secondary drawers retain the Order 325 stacked interaction and exploratory widths.
- Drawer surfaces use the warm neutral Admin palette, subtle lines, and `shadow-2` only at the floating boundary.
- Drawer tabs, controls, cards, and statuses reuse the shared styles above.
- URL state, Back behavior, top-most Escape close, focus trap, focus return, scroll lock, and narrow full-width fallback are behavioral contracts owned by `docs/admin-ux-v2.md`.
- Exhibition detail uses the same right-side drawer shell and interaction language as Venue / Artist / Works detail.

### Detail labels and actions

- Detail fields show a Japanese primary label and the actual DB column or stable form key as a 12px secondary line. The key remains lowercase `snake_case`; `English（日本語）` combined labels are not used.
- Human-facing action controls use Japanese verbs. Technical entity names and acronyms such as Venue, Artist, Works, CSV, API, ARTPR, Wikidata, and Supabase may remain in English.
- Publication is a shared two-state switch: ON is `公開中` (`published`), OFF is `非公開` (`draft`). `ready` is legacy-compatible data only and is not generated or shown as a distinct Product UI state.
- Publication cardと次のcardの間は16px空け、隣接して一体のcardに見せない。
- Record and media deletion use the shared quiet 36px trash icon button, with `削除` as both accessible name and title. Confirmation and server-side delete blockers remain mandatory.

### Venue edit composition

- Venueの`編集`は`基本情報 / 画像登録 / 関連情報`の三つのsub-tabに分ける。基本情報は1-column formを基準にし、field-levelの`未設定`表示、`name_native`、`aliases`、`is_active`をこのsurfaceへ置かない。
- Venue Typeは日本語Labelのradio group、Country / 都道府県 / Regionはcurated geo masterを参照する。初期catalogは`JP / FR / US / GB / ES / NL`とし、未知値は既存値を失わないfallback optionとして表示する。日本は郵便番号、住所、都道府県、市区町村を使い、海外は住所、国別Subdivision、Cityを使う。表示から外れる既存値は保存時にも保持する。
- 所蔵作品、関連展覧会、タグは`関連情報`へまとめ、所蔵作品 → 関連展覧会 → タグの順にquietなrelation listとして置く。追加Search、公開/非表示、削除は同じvisual hierarchyで扱い、Technical statusは必要な補助情報に留める。
- 画像登録は`登録画像 → 画像候補 → 画像登録`の順に並べる。登録画像がない場合は正方形の`No Image` placeholderを使い、新規Previewはfileまたは有効なURLが選択されるまで表示しない。URL取得失敗時は空の固定frameを残さずErrorを示し、入力やmetadata変更だけでは永続化しない。

### Layer order

- Shared layer tokens preserve `base < sidebar < popover / tooltip < drawer / dialog`.
- Action menus must be able to overlap the Sidebar without clipping. Drawers always remain above normal menus and tooltips.

## Icon language

- Use local inline SVG icons; do not add a remote icon dependency solely for Admin polish.
- Navigation icons are 16px. Standalone icons may be 18–20px.
- Use 1.6–1.8px strokes with round caps and joins.
- Icons support text labels and do not replace accessible names.

## Validation

- Check Dashboard, Exhibitions, Venue, Artist, Works, Imports, and Sources.
- Verify wide desktop, intermediate width, and exact 390px narrow fallback.
- Confirm no page-wide horizontal overflow, while contained table/navigation scrolling remains usable.
- Recheck hover, focus-visible, disabled, active/selected, status, drawer stack, Escape, Browser Back, and focus return.
- A successful build does not replace rendered browser verification.
