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
- Field label → control uses 8px; control → supporting action or feedback uses 8–12px; section heading/action → first row uses 12–16px; card group → card group uses 16–24px; section → section uses 24–32px. Shared Admin containers own this rhythm so heading rows and child components do not add duplicate vertical margins.
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
- Success uses `--success` only for completed or safely confirmed outcomes.
- Warning uses a muted `--warning` treatment for warning, caution, and status feedback. A normal action that opens a secondary Drawer is not a warning.
- Secondary Drawer openers use the black Primary treatment with the shared 16px panel-open icon. The icon is reserved for actions that open another panel and is not added to Save, Register, Delete, source links, or other ordinary actions.
- Danger uses `--danger` and is reserved for destructive, critical, or irreversible actions.
- Disabled is an explicit neutral surface/border/text state, never opacity alone.

### Search, filters, tabs, and pills

- Search is a 40px pill-shaped input where an existing keyword field is present.
- Form filters remain 36px standard fields with an 8px radius. Select controls use a consistent local chevron and reserve sufficient right padding.
- Toolbar/filter actions remain content-sized and align to the control baseline rather than stretching to an input column width.
- Context/view tabs use a contained neutral surface with a bordered/elevated active item.
- Detail tabs use the same contained selection language.
- Edit sub-tabs own only their control surface and never own the spacing below themselves. The parent edit surface owns a single 20px gap from sub-tabs to the active panel; child margin and parent gap must not stack at the same boundary.
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
- 画像登録は`登録画像 → 画像候補 → 画像登録`の順に並べる。登録Media Assetが1件以上なら登録画像だけを表示し、画像候補と登録Formを隠す。0件なら正方形の`No Image` placeholder、候補、登録Formを表示する。最後のAsset削除時もDrawerを閉じず即時に0件状態へ戻す。新規Previewはfileまたは有効なURLが選択されるまで表示せず、URL取得失敗時は空の固定frameを残さずErrorを示す。
- 0件状態からの手動登録はserverが自動的にPrimaryへ設定し、HumanへPrimary checkboxを出さない。Upload / Delete / Candidate選択は返却Assetを局所stateへ即時反映し、一覧は対象rowだけを同じ位置で置換する。
- 画像候補はVenue / Artist / Works / Exhibition共通で、usable候補が0件ならEmpty、1件かつPrimaryなしなら自動選択、2件以上ならHumanが単一選択する。複数候補からP18だけを自動優先しない。選択Actionは`この画像を設定`へ一本化し、選択候補をPrimary、旧Primaryを解除、他のactive候補を非採用/inactiveにする。Rights statusはこの操作で変更しない。現時点で実候補取り込みがあるのはVenue / Artist / Exhibitionで、Worksは共通永続化境界に対応するが候補取り込み元は未実装である。

### Detail data review composition

- 外部データ取得はBatch / Import / Targeted Resolutionが所有する。通常Detailは取得Consoleではなく、現在値と出典、実際に紐づくSource、既に取得済みの未解決候補を検査するsurfaceである。Wikidata / Wikipedia / APJ DAJ / Getty ULAN / 公式サイトのroutine取得・再取得ActionをDetailへ置かない。
- Data Reviewの共有visual primitiveはsection spacing、current provenance、linked source list、review queue、feedback、empty stateを所有し、Venue / ArtistのadapterはFieldと候補だけを渡す。表示順は`項目の出典 → 外部データ → 要確認（未解決候補がある場合のみ）`とする。
- `状態 > 外部データ`は`あり / なし`ではなく、実際に紐づくdistinct source名をcompactなpassive chipとして表示する。ManualとCSVは通常のExternal Source summaryへ含めず、source URLがあるchipは根拠ページへのquiet linkにできる。
- `データ > 外部データ`はlinked `source_records`だけを表示し、未取得Providerのchecklistを作らない。Source labelはWikidata / Wikipedia / APJ DAJ / Getty ULAN / 公式サイト / Wikimedia Commons / 公式画像 / Trusted APIを共有し、未知Sourceは`data_sources.name`を優先する。
- `項目の出典`はBasic form順にcurrent provenanceを一項目一行で示す。値がありprovenanceがなければ推測せず`不明`、値自体が空なら`—`とする。Manual保存は変更Fieldだけを`手動`へ更新し、未変更Fieldのcurrent sourceを維持する。Geolonia / 日本郵便Previewを未変更で保存したFieldは、そのprovider hintを維持する。`source_url`があるSourceは実際の根拠ページへLinkする。
- `要確認`は既に取得済みのunresolved identity / coordinate candidateがある場合だけ表示する。座標候補はSource、緯度・経度、必要な一致度・QID・精度、Google Maps linkと`採用 / 非採用`をcompactに示し、選択behaviorを維持する。候補がない場合に検索CTAを表示しない。
- Image Candidate cardは取得経路、意味のある探索深度・一致度、rights、license、source linkを候補単位で示す。確定QID由来は偽のscoreとして見せず`確定QID`と表現し、full threshold traceを表示しない。

### Detail containment

- Detail panel、edit surface、card、relation section/list/row、Tag selector/listはDrawer content幅を上限とし、`min-width: 0`と安全なtext wrappingを保つ。通常のRelation名は一件一行で表示し、複数名を`/`で連結した一文へしない。
- DetailのTag操作は既存Tag Catalogからの付与・解除だけを行う。`種別 / 既存タグ / 付与`を同じshared selectorで扱い、付与済みTagは候補から除外する。Tagの新規作成、type設計、rename、merge、deleteは別のTag管理機能が所有し、Detailへ自由入力や作成fallbackを置かない。390pxではselectorを一列へstackし、FieldとButtonはDrawer幅を押し広げない。
- TagはEditorial metadataであり、Master一覧のkeyword Search / Filter taxonomyとは別責務とする。Detail Tag操作を理由にMaster検索条件を暗黙に変更しない。
- 横Scrollは列幅が必要な`.table-wrap`等の意図的なcontainerだけが所有する。Drawer全体を`overflow-x: hidden`で切り捨てず、長いRelation名、Source URL、tag、form controlを内容幅内で折り返す。

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
