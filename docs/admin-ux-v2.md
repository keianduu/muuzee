# Muuzee Master Admin UX v2

Status: Draft. LOCAL / STG Adminの探索中UX / Information Architectureを記録する。Order 325 Phase Aの実画面をHuman Reviewした結果により更新してよい。

## Source of Truth responsibility

このDocumentはAdminのInformation Architecture、Navigation behavior、Drawer階層、URL state、focus / Escape / Browser Back、各Workflowを所有する。色、Typography、Spacing、Radius、Shadow、Icon、Control / Tab / Status / Drawerのvisual languageはNotion `09 Admin Style Guide`と、そのimplementation-facing referenceである`docs/admin-style-guide.md`をCanonical Source of Truthとする。Phase Aに記録されたvisual値がCanonical Guideと競合する場合は、Phase B以降はAdmin Style Guideを優先する。

## Admin Shell / Navigation (Order 325 Phase A)

Desktopは約288pxの左固定SidebarとquietなMain Content Surfaceを共通Shellにする。Sidebarはlight neutral、現在地はquietなsurface差と強めのtext weightで示し、未選択はquiet textとする。Navigationへstrong marker、装飾的なCard、強いShadowを加えない。主要Labelは`Dashboard / Exhibitions / Venue / Artist / Works / Users / データ取り込み`を基準にし、Entity名は単数形の`Venue / Artist / Works`で統一する。UsersはOrder 329まで`準備中`の非操作表示とする。

`Imports`と`Sources`の既存Routeは維持し、Sidebarでは`データ取り込み`Groupの`取り込み実行`と`外部Source設定`として見せる。内容統合と全面的なAction label変更はOrder 327の責務であり、Order 325では既存Route・API・操作を変更しない。Action labelは名詞だけでなく、何が起こるか分かる動詞表現を優先する。

760px以下はSidebarを上部の横スクロールNavigationへ切り替える。これはNavigation itemを省略するためではなく、Main ContentとDrawerを安全に全幅表示するためのfallbackである。Page全体の横overflowは作らず、Navigation内部だけ横スクロールを許可する。

## Japanese labels

Detail Fieldは日本語名をPrimary、実際のDB columnまたはstable form keyをSecondaryの別行で表示する。`Publication Status（公開状態）`や`Name（名称）`のような併記形式は使わない。Action Button / Menuは日本語の動詞表現とし、技術Entity名・Source名・CSV / API等の略称は必要に応じて維持する。共通Field / Status表現は`src/lib/admin/master-labels.ts`にまとめ、画面ごとの独自訳や文字列splitを増やさない。

## List + Stacked Detail Drawer

Venue / Artist / Work一覧の行全体を選択すると、右側からDetail Drawerを開く。Checkbox等の操作は行選択を発火しない。Drawer内部のみScrollし、背景はScrimとScroll lockで誤操作を防ぐ。Close Button、Escape、focus trap、dialog aria属性を持つ。

以前はDesktop 40〜55%の単一Drawerだけを前提としていた。Order 325 Phase Aでは、一覧の文脈をより多く残しながら関連情報を確認できるよう、第一Drawerと第二Drawerを横に積める構造へ探索的に変更した。第一Drawerは`clamp(460px, 36vw, 600px)`、第二Drawerは`clamp(420px, 32vw, 520px)`を基準にし、1100px以下では最上位Drawerを全画面表示する。固定30%を仕様化せず、Human Reviewで情報密度とMain Tableの残量を調整する。

Phase Aの代表workflowは`Venue list → Venue Drawer → Image Candidate Drawer`。第二Drawerを閉じても第一Drawerを維持し、第一Drawerを閉じると子Panelも同時にclearする。Escapeは最上位だけを閉じ、Tab focusは最上位Drawer内に留める。第二Drawerを閉じた後は第一DrawerのCloseへfocusを戻す。各Drawerは独立してScrollする。Phase DではDesktopの第一Drawerを右端に固定し、第二Drawerをその左側へ開く。1100px以下は最上位Drawerの全幅fallbackを使う。

## URL deep link and compatibility

選択状態は`/admin/{entity}?selected={id}`で保持する。Venueの第二階層は`panel=image / wikidata-fields / official-fields / coordinates`を使い、画像候補は`candidate={id}`、公式取得結果は`run={import-run-id}`を追加する。例は`/admin/venues?selected={venue-id}&panel=image&candidate={candidate-id}`。再読み込みと直接共有で同じ階層を復元する。Close時は対象階層のQueryだけを削除し、Search / Filterは保持する。一覧からOpenした場合はBrowser Backで一覧へ、第二DrawerをOpenした場合はBrowser Backで第一Drawerへ一段ずつ戻る。従来の`/admin/{entity}/[id]`は削除せず、List + `selected`へRedirectする。Keyword、Publication、Image、Completeness、Source、Venue Type / Active / Coordinates / Wikidata MatchのFilterを維持する。ArtistはTier All / A / B / C / A+B、Publication All / Published / Unpublished、Image、Nationality missing、Core Quality、Sourceを併用できる。

## Priority Tier and Data Quality

Venue一覧は実効Tier Badgeを表示し、A→B→C→D→E→未分類で並ぶ。Tier Filterは`?tier=A` / `?tier=A-C`として保存し、Drawer開閉後も維持する。上部Dashboardで各Tierの件数・平均Completeness・Draft Target達成/未達、A〜Cの不足FieldとImage状態を表示する。Data Quality QueueはA→B→C、Completeness低い順。

## Infinite Scroll

初回50件、以後50件ずつAPIから追加取得する。VenueのServer側順序は`Tier rank, Completeness ASC, name ASC, id ASC`、Artist / Workは`title/name ASC, id ASC`。Client側でもID重複を除外する。上部にFilter後のTotalと全件数、現在の表示数を示し、下端にLoading / 完了 / Error + Retryを表示する。Filter変更時は一覧とpageをresetする。

## Status / Edit / Data IA

- `状態`: 取得過程ではなく、現在利用できる情報を示す。Master共通はPublication、画像の可用性、外部データ有無、Requirementsを表示し、Venueだけ位置情報を追加する。Completeness percentage、独立したRights、不足Field text、API照合、crawl診断は表示しない。
- `編集`: Masterの実データ、Tag、Relation、画像Upload / Candidate判断、座標Candidate採否。
- `データ`: Humanが外部候補を判断するsurface。Venueは`Wikidata照合 / 外部データから情報を取得 / 項目の出典 / 位置情報候補`だけを主表示し、raw source record、provenance history、検索trace、crawl status dashboardはDB / auditへ残す。

Human-facing画像状態は`未取得 / 画像なし / 候補あり / 利用不可 / 利用可能`の5状態とする。approved Media AssetがあればPrimary指定にかかわらず`利用可能`、active non-rejected Candidateまたは`needs_review` Assetは`候補あり`、rejected-only evidenceは`利用不可`、完了した探索のno-result evidenceがあれば`画像なし`、判断可能な探索証拠がなければ`未取得`とする。raw `image_search_status`はDB / auditへ残し、通常DetailのDataには表示しない。

`外部データ`は`source_records`が1件以上なら`あり`、0件なら`なし`とし、providerや件数はDataへ置く。Venueの`位置情報`はcurrent latitude/longitudeがあればSource種別を問わず`確認済み`、currentなしでusable candidateがあれば`候補あり`、それ以外は`取得不可`とする。ExhibitionはVenue relationを参照するため位置情報Statusを持たない。

Publication-requiredはVenue=`name`、Artist=`name`、Works=`Title + Artist Relation + Holding Venue Relation`、Exhibition=`Title + Venue + Start or End date + Primary image + approved rights`であり、Completeness item全体を公開必須として扱わない。ArtistのTierは運用情報として残せるが、別のQuality cardでCompleteness、画像、Requirementsを重複表示しない。

Drawer Open時にだけDetail APIを呼び、一覧取得時に全DetailやDiagnosticを取得しない。

Exhibitionも`/admin/exhibitions?selected={id}`をCanonicalなDetail stateとし、`q / status / image / schedule`を保持したまま右Drawerを開く。一覧からのOpenはpush semantics、Closeは`selected`だけを除去し、Browser Back / Escape / focus trap / focus return / background scroll lock / deep-link reloadはMaster Drawerと同じ契約に従う。従来の`/admin/exhibitions/[id]`はbookmark互換のため残し、List + `selected`へRedirectする。

Order 325.5 Phase Aでは、Detailの共通責務を`Drawer shell / 状態・編集・データtabs / Edit sub-tabs / Image Manager / Candidate Picker / immediate media state`として分離する。Entity固有責務は各Editorへ残し、Venueの住所・座標・公式サイト取得、ArtistのField・外部Source診断・展覧会/作品Relation、WorksのTitle/Relation、ExhibitionのOccurrence/日付/公開条件を巨大なconfig-driven formへ統合しない。Artistの`編集`はVenueと同じEdit tab visualを使う`基本情報 / 画像登録 / 関連情報`とし、基本情報はArtist schemaのFieldだけを1-columnで表示する。Artistの複数画像候補はVenueと同じ`panel=image`第二Drawer、即時Media state、focus / Back / Escape契約を使う。Works / ExhibitionのHuman-facing IA展開はArtist Human Review後のPhase Bに留保する。

PublicationはMaster / Exhibitionとも共有Toggleによる2-state UIとする。ONは`published`、OFFは`draft`であり、新しい`ready`を生成しない。legacy `ready`は非公開として表示する。ExhibitionのON操作は既存公開条件を満たす場合だけ許可し、不足理由をToggle付近へ表示する。

Layer順は`Base < Sidebar < Popover / Tooltip < Drawer / Dialog`を共有tokenで固定する。Action menuはSidebarより前面、Drawerは通常Popoverより前面に表示し、狭幅ではPopoverをViewport内へ収める。

Order 340 handoff: Production初回migration前にcanonical codeが`ready`を書かないことを再確認し、DB constraint/typeからの除去要否とLOCAL / STG legacy値のnormalize要否を決める。Production initial dataへ`ready`を持ち込まない。

## Coordinate map

Venueの現行座標または座標CandidateからGoogle Maps URLを生成して新しいTabで開く。座標Candidateを優先して確認対象にする。Inline Mapは現時点で未実装。既存Production appにMap Libraryがなく、地図確認だけのためにDependencyと外部Tile利用条件を増やさないためである。

## Venue edit workflow (Order 325 Phase C)

Venueの`編集`は`基本情報 / 画像登録 / 関連情報`のsub-tabを持ち、URL queryの`venueEdit`で現在位置を保持する。基本情報は`名称 → 英語名 → 施設種別 → 国 → 国別住所 → 座標 → URL → 開館年 → 説明 → アクセス → 開館時間 → 休館日 → 開館補足`の1-column flowとする。関連情報は`所蔵作品 → 関連展覧会 → タグ`の順で既存relation操作を維持する。

Venueは国内・海外の両方を対象にする。curated country catalogはPrototypeで明示されている`JP / FR / US / GB / ES / NL`を初期範囲とし、DBにはISO-like codeを保存する。日本は`郵便番号 → 住所 → 都道府県 → 市区町村`、海外は`住所 → Region / State / Country / Autonomous Community / Province → City`を国別に表示する。未知codeとcatalog外の既存Subdivisionはfallback optionとして保持し、country切替で非表示になった既存DB値を暗黙に消去しない。

日本の郵便番号検索は`POST /api/admin/venues/postal-preview`をserver boundaryとし、日本郵便の公式API credentialとURL templateがserver environmentにある場合だけ利用する。郵便番号は全角、7桁、hyphen付き入力をnormalizeし、都道府県・市区町村・町域prefixを返す。詳細住所が既に入力済みなら上書きしない。credential未設定時は明確なunavailable responseを返し、client、Git、Notion、logへsecretを出さない。住所から座標を得る既存Geolonia Previewとは別操作であり、海外住所のautomatic geocodingは未実装のdependencyとして残す。座標を直接変更した場合はmanual、Geolonia Previewを未変更で採用した場合はgeoloniaをsourceとする。

所蔵作品は既存`collection_holdings`のvisibility semanticsを共有する。関連展覧会は`exhibition_occurrences`に独立したvisibilityを持たせ、relation freshnessを示す`relation_status`とは混同しない。非表示occurrenceはPublic projectionから除外し、公開中Exhibitionが唯一の公開occurrenceを失う削除はserverで拒否する。このPhysical migrationはOrder 340のProduction初回migration計画へ引き渡す。

画像は`登録画像 → 画像候補 → 画像登録`の順に置く。Venue / Artist / Works / Exhibition共通で、登録Media Assetが1件以上なら登録画像だけを表示して候補と登録Formを隠し、0件なら`No Image`、候補、登録Formを表示する。最後のAssetを削除した場合はDrawerを閉じず即時に0件状態へ戻す。0件状態からの手動登録はserverがPrimaryを自動決定し、HumanへPrimary checkboxを出さない。Upload / Delete / Candidate選択は返却Assetを局所stateへ先に反映し、その後のcanonical refreshを待たず登録画像と取得UIを切り替える。一覧は対象rowを現在位置で置換し、page 1 resetを行わない。新規Previewはlocal fileまたは有効なHTTPS URLを選択するまで表示せず、URL Preview失敗時は空の固定frameを残さずErrorへ置き換える。明示的な登録操作だけがprivate Storageへ保存し、server-side URL取得はHTTPS、redirect先、private/local address、MIME、20MB上限、timeoutを検証する。usable候補0件はEmpty、1件かつPrimaryなしは自動選択、2件以上はHumanが1件を選択する。複数候補からP18だけを自動優先しない。判断Actionは`この画像を設定`だけとし、選択時は候補画像を検証・Storage保存・Media Asset作成または再利用し、旧Primaryを解除して選択AssetだけをPrimaryにする。選択候補はaccepted、他のactive候補はrejected / inactiveへ収束させるが、各候補のrights statusは変更しない。Secondary Drawer openerはblack Primary + panel icon、Drawer内の採用Actionは通常のblack Primaryとする。Venueの第二Drawerでは成功後に第二Drawerを閉じ、第一Drawerの局所stateへ即時反映してTriggerへfocusを戻す。候補取り込みruntimeはVenue / Artist / Exhibitionに接続済みで、Worksは共通選択・永続化境界に対応する一方、候補を生成するingestionは未実装である。

Image Candidate UIのLOCAL QAには`npm run db:seed:admin-image-candidate-local`で決定的なsynthetic fixtureを作成し、`npm run db:cleanup:admin-image-candidate-local`で明示的に削除できる。scriptはLOCAL Supabase URL以外を拒否し、STG / Production dataへ適用しない。

## Venue data review workflow (Order 325 Phase D)

Venue DataのWikidata flowは`Entity候補取得 → QID採用 / 非採用 → Field preview → Human選択 → Apply → current provenance更新`である。候補取得とQID採用はMaster fieldを変更しない。Wikidata field applyは確定QIDをserverで再取得し、許可fieldとSource priorityを再検証する。`name_native`と`aliases`はHuman review対象に含めない。

Field reviewは取得Actionと同時に第二Drawerを開き、Loading / Success / Empty / Errorをそこで表示する。現在値、取得値、current Source、candidate Sourceと根拠URLを比較し、全対象Fieldを`取得済み / 取得なし / 変更なし / 保護`として示す。空のcurrentに値がある候補だけdefault ON、同値は変更なし、Manual / 高優先度Sourceは保護する。Wikidata候補がない場合はQIDや補完Actionを要求せず、手動または公式サイト入力へ案内する。Data本体の`項目の出典`はBasic form順のcurrent source summaryだけを表示し、history件数が増えてもField rowを重複させない。値があるのにprovenanceがないlegacy値は`不明`、空Fieldは`—`とする。

座標候補は`venue_coordinate_candidates`にSourceごとのjudgmentを保存し、Wikidata identityと独立して採用 / 非採用する。current座標がなくeligible候補が1件なら自動選択し、複数ならHuman判断まで自動選択しない。採用時はcurrent latitude / longitude、coordinate metadata、緯度・経度のprovenanceを更新し、選択候補をaccepted、同Venueの他候補を監査用rowを残したままrejectedへ収束させる。個別の非採用は対象候補だけを更新し、current座標、他候補、Wikidata identityを変更しない。Data内には全候補をinline表示し、`第二Drawerで確認`を置かない。Basicの座標領域だけが同じcomponentを使う`panel=coordinates`第二Drawerへ移動できる。採用成功後はVenue ID付きの`muuzee:venue-coordinate-selected`でマウント中Basic formの緯度・経度と座標Source / Precision hintだけを即時同期し、dirtyな他Fieldは保持する。その後に第二Drawerを閉じ、第一Drawerを再取得してTriggerへfocusを戻す。

個別Venueの公式サイト取得は既存LOCAL-only crawlerを`selected` modeで再利用する。Data tabのURLは未保存でも取得対象にできるが、crawl開始やpreviewではMasterの`official_url`を暗黙更新しない。第二Drawerを先に開き、crawl結果またはErrorをそこで表示する。Humanが選択したFieldだけ`official_website` provenanceとfield-level source URL付きで反映する。partial結果は取得済みFieldとwarningを同時に表示する。Batchの`Crawl → CSV → Preview → Confirm`は別workflowとして維持し、STG / Production向けcrawlerへ拡張しない。

Image Candidateは画像登録sub-tabと`panel=image`で取得経路、探索深度 / 確定QID、一致度、rights、license、source linkを候補単位で示す。Venue Dataから画像・座標search traceやfull threshold tableは除外する。

## Existing feature preservation

Manual Add、CSV Export / Import、API Import、Wikidata Full Sync、Publication、Bulk Publish、Delete Safety、Completeness、Provenance、Venue Enrichment、Coordinate / Image Candidate、Rights、Work Relationは既存APIと操作を維持する。
