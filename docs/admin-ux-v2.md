# Muuzee Master Admin UX v2

Status: Draft. LOCAL / STG Adminの探索中UX / Information Architectureを記録する。Order 325 Phase Aの実画面をHuman Reviewした結果により更新してよい。

## Source of Truth responsibility

このDocumentはAdminのInformation Architecture、Navigation behavior、Drawer階層、URL state、focus / Escape / Browser Back、各Workflowを所有する。色、Typography、Spacing、Radius、Shadow、Icon、Control / Tab / Status / Drawerのvisual languageはNotion `09 Admin Style Guide`と、そのimplementation-facing referenceである`docs/admin-style-guide.md`をCanonical Source of Truthとする。Phase Aに記録されたvisual値がCanonical Guideと競合する場合は、Phase B以降はAdmin Style Guideを優先する。

## Admin Shell / Navigation (Order 325 Phase A)

Desktopは約288pxの左固定SidebarとquietなMain Content Surfaceを共通Shellにする。Sidebarはlight neutral、現在地はblack fillではなくsurface差・font weight・structural markerで示し、未選択はquiet textとする。装飾的なCardや強いShadowをNavigationへ加えない。主要Labelは`Dashboard / Exhibitions / Venue / Artist / Works / Users / データ取り込み`を基準にし、Entity名は単数形の`Venue / Artist / Works`で統一する。UsersはOrder 329まで`準備中`の非操作表示とする。

`Imports`と`Sources`の既存Routeは維持し、Sidebarでは`データ取り込み`Groupの`取り込み実行`と`外部Source設定`として見せる。内容統合と全面的なAction label変更はOrder 327の責務であり、Order 325では既存Route・API・操作を変更しない。Action labelは名詞だけでなく、何が起こるか分かる動詞表現を優先する。

760px以下はSidebarを上部の横スクロールNavigationへ切り替える。これはNavigation itemを省略するためではなく、Main ContentとDrawerを安全に全幅表示するためのfallbackである。Page全体の横overflowは作らず、Navigation内部だけ横スクロールを許可する。

## Japanese labels

Admin固有・技術用語は英語を残し、日本語補足を併記する。例: `Publication Status（公開状態）`、`Coordinate Candidate（座標候補）`、`Completeness（情報充足率）`。共通Field / Status表現は`src/lib/admin/master-labels.ts`にまとめ、画面ごとの独自訳を増やさない。

## List + Stacked Detail Drawer

Venue / Artist / Work一覧の行全体を選択すると、右側からDetail Drawerを開く。Checkbox等の操作は行選択を発火しない。Drawer内部のみScrollし、背景はScrimとScroll lockで誤操作を防ぐ。Close Button、Escape、focus trap、dialog aria属性を持つ。

以前はDesktop 40〜55%の単一Drawerだけを前提としていた。Order 325 Phase Aでは、一覧の文脈をより多く残しながら関連情報を確認できるよう、第一Drawerと第二Drawerを横に積める構造へ探索的に変更した。第一Drawerは`clamp(460px, 36vw, 600px)`、第二Drawerは`clamp(420px, 32vw, 520px)`を基準にし、1100px以下では最上位Drawerを全画面表示する。固定30%を仕様化せず、Human Reviewで情報密度とMain Tableの残量を調整する。

Phase Aの代表workflowは`Venue list → Venue Drawer → Image Candidate Drawer`。第二Drawerを閉じても第一Drawerを維持し、第一Drawerを閉じると子Panelも同時にclearする。Escapeは最上位だけを閉じ、Tab focusは最上位Drawer内に留める。第二Drawerを閉じた後は第一DrawerのCloseへfocusを戻す。各Drawerは独立してScrollする。

## URL deep link and compatibility

選択状態は`/admin/{entity}?selected={id}`で保持する。第二階層は`panel=image`、個別候補は`candidate={id}`を追加する。例は`/admin/venues?selected={venue-id}&panel=image&candidate={candidate-id}`。再読み込みと直接共有で同じ階層を復元する。Close時は対象階層のQueryだけを削除し、Search / Filterは保持する。一覧からOpenした場合はBrowser Backで一覧へ、第二DrawerをOpenした場合はBrowser Backで第一Drawerへ一段ずつ戻る。従来の`/admin/{entity}/[id]`は削除せず、List + `selected`へRedirectする。Keyword、Publication、Image、Completeness、Source、Venue Type / Active / Coordinates / Wikidata MatchのFilterを維持する。ArtistはTier All / A / B / C / A+B、Publication All / Published / Unpublished、Image、Nationality missing、Core Quality、Sourceを併用できる。DataタブにはWikidata QID / raw classification、Wikipedia、画像探索経路・Reported licenseを表示し、Getty / APJはCoverage Testだけであることを明示する。

## Priority Tier and Data Quality

Venue一覧は実効Tier Badgeを表示し、A→B→C→D→E→未分類で並ぶ。Tier Filterは`?tier=A` / `?tier=A-C`として保存し、Drawer開閉後も維持する。上部Dashboardで各Tierの件数・平均Completeness・Draft Target達成/未達、A〜Cの不足FieldとImage状態を表示する。Data Quality QueueはA→B→C、Completeness低い順。

## Infinite Scroll

初回50件、以後50件ずつAPIから追加取得する。VenueのServer側順序は`Tier rank, Completeness ASC, name ASC, id ASC`、Artist / Workは`title/name ASC, id ASC`。Client側でもID重複を除外する。上部にFilter後のTotalと全件数、現在の表示数を示し、下端にLoading / 完了 / Error + Retryを表示する。Filter変更時は一覧とpageをresetする。

## Status / Edit / Data IA

- `状態`: Publication、Completeness、画像、Rights、Source、不足Field。VenueはCoordinate / API Matchも表示する。
- `編集`: Masterの実データ、Tag、Relation、画像Upload / Candidate判断、座標Candidate採否。
- `データ`: Field Provenance、External Source、Wikidata Candidate、Match Confidence / Threshold / Reason、Search Diagnostics、Rawに近い補足情報。

Drawer Open時にだけDetail APIを呼び、一覧取得時に全DetailやDiagnosticを取得しない。

## Coordinate map

Venueの現行座標または座標CandidateからGoogle Maps URLを生成して新しいTabで開く。座標Candidateを優先して確認対象にする。Inline Mapは現時点で未実装。既存Production appにMap Libraryがなく、地図確認だけのためにDependencyと外部Tile利用条件を増やさないためである。

## Existing feature preservation

Manual Add、CSV Export / Import、API Import、Wikidata Full Sync、Publication、Bulk Publish、Delete Safety、Completeness、Provenance、Venue Enrichment、Coordinate / Image Candidate、Rights、Work Relationは既存APIと操作を維持する。
