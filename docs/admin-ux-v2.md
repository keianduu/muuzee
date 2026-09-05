# Muuzee Master Admin UX v2

Status: Draft. Local production Adminの検証中UX / Information Architectureを記録する。

## Japanese labels

Admin固有・技術用語は英語を残し、日本語補足を併記する。例: `Publication Status（公開状態）`、`Coordinate Candidate（座標候補）`、`Completeness（情報充足率）`。共通Field / Status表現は`src/lib/admin/master-labels.ts`にまとめ、画面ごとの独自訳を増やさない。

## List + Detail Drawer

Venue / Artist / Work一覧の行全体を選択すると、右側からDetail Drawerを開く。Checkbox等の操作は行選択を発火しない。Desktopは幅40〜55%を目安にし、狭いViewportではFull Screen Sheetにする。Drawer内部のみScrollし、背景はScrimとScroll lockで誤操作を防ぐ。Close Button、Escape、focus trap、dialog aria属性を持つ。

## URL deep link and compatibility

選択状態は`/admin/{entity}?selected={id}`で保持する。再読み込みと直接共有で同じDrawerを復元する。Close時は`selected`だけを削除し、Search / Filterは保持する。一覧からOpenした場合はBrowser Backで直前の一覧URLへ戻る。従来の`/admin/{entity}/[id]`は削除せず、List + `selected`へRedirectする。Keyword、Publication、Image、Completeness、Source、Venue Type / Active / Coordinates / Wikidata MatchのFilterを維持する。

## Infinite Scroll

初回50件、以後50件ずつAPIから追加取得する。全MasterをBrowserへ一括取得しない。Server側は`title/name ASC, id ASC`のstable sortとoffset rangeを維持し、Client側でもID重複を除外する。上部にFilter後のTotalと全件数、現在の表示数を示し、下端にLoading / 完了 / Error + Retryを表示する。Filter変更時は一覧とpageをresetする。

## Status / Edit / Data IA

- `状態`: Publication、Completeness、画像、Rights、Source、不足Field。VenueはCoordinate / API Matchも表示する。
- `編集`: Masterの実データ、Tag、Relation、画像Upload / Candidate判断、座標Candidate採否。
- `データ`: Field Provenance、External Source、Wikidata Candidate、Match Confidence / Threshold / Reason、Search Diagnostics、Rawに近い補足情報。

Drawer Open時にだけDetail APIを呼び、一覧取得時に全DetailやDiagnosticを取得しない。

## Coordinate map

Venueの現行座標または座標CandidateからGoogle Maps URLを生成して新しいTabで開く。座標Candidateを優先して確認対象にする。Inline Mapは現時点で未実装。既存Production appにMap Libraryがなく、地図確認だけのためにDependencyと外部Tile利用条件を増やさないためである。

## Existing feature preservation

Manual Add、CSV Export / Import、API Import、Wikidata Full Sync、Publication、Bulk Publish、Delete Safety、Completeness、Provenance、Venue Enrichment、Coordinate / Image Candidate、Rights、Work Relationは既存APIと操作を維持する。
