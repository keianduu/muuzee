# Wikidata Venue Importer v1

## Purpose and scope

WikidataをVenue MasterのSource Aとして利用し、展覧会開催状況とは独立して、日本国内のMuseum / GalleryをMuuzeeへ作成・同期する。既存Venueから候補を探すVenue Enrichmentとは逆向きのImportである。

v1はJapanのみ。主対象はMaster discovery、名称、英語名、alias、分類、国、行政区、住所、郵便番号、座標、公式URL、opening / inception year、P18 image candidate。Opening Hoursは明示値がある場合だけ取得する。Closed Days、Access、Descriptionの完成はSource B/Cへ委ね、推測しない。

## Discovery logic and target classes

Wikidata Query ServiceでQIDを列挙し、Action API `wbgetentities`で50件ずつ詳細を取得する。

```text
WDQS discovery → QID list → Action API batch detail → Normalize
→ QID / checksum diff → Match existing or create Draft
```

| Role | QID | Reason |
| --- | --- | --- |
| Japan | Q17 | v1地域境界 |
| museum root | Q33506 | WikiProject Museumsでmuseum discoveryに使われるroot |
| art museum | Q207694 | museum subclass系統に含まれる代表的art museum class |
| art gallery root | Q1007870 | museum系統だけでは落ちるgalleryを安全に補完 |

Discoveryは`P31/P279*`とQ17で絞り、P576があるEntityを除外する。library、theater、historical building、general cultural centerはrootへ追加しない。件数指定Importは直前runのoffsetの続きから取得し、末尾に達したら0へ戻る。

## Field mapping

| Wikidata | Muuzee | Rule |
| --- | --- | --- |
| QID | `source_records.external_id` | Stable external ID。Muuzee PKはUUID |
| ja/en label | `name` / `name_en` | 日本語優先、なければ英語 |
| aliases | `aliases` | ja/en aliasを重複除去 |
| P31 + discovery root | `venue_type` | 共通mapperで変換 |
| P17 | `country_code` | v1はJP |
| P131 | `region` | labelを保存。cityは推測しない |
| P6375 | `address` | 明示値のみ |
| P281 | `postal_code` | 明示値のみ |
| P625 | coordinates | Newまたは空欄Existingだけ。source=wikidata |
| P856 | `official_url` | 空欄だけ補完 |
| P18 | image candidate | Commons metadata取得後もNeeds Review |
| P373 | raw payload | Commons category。canonical列は増やさない |
| P1619 / P571 | `inception_year` | official opening優先、なければinception |
| P3025 | `opening_hours_text` | string明示時のみ |

Raw claims、raw class、discovery rootは`source_records.raw_payload`へ保持する。

## Venue type mapping

- Q1007870 / art gallery root → `gallery`
- Q207694またはQ33506 / museum root → `museum`
- 確実に分類できない → `other`

Mappingは`src/lib/wikidata/venue-type-mapper.ts`へ集約する。

## External ID, matching, and creation

Wikidata sourceの`external_id = QID`を一意キーとし、raw + discovery classificationのchecksumを保存する。

- QID link済み + checksum同一 → Unchanged。Venue更新をskip
- QID link済み + checksum変更 → Changed。空欄だけ補完
- QID未登録 + confidence 0.85以上 → Existing VenueへLink
- QID未登録 + confidence 0.60以上0.85未満 → Duplicateを作らずNeeds Review
- 有力なExisting matchなし → New VenueをDraft作成

Admin詳細でName / Name EN / Address / Official URL / Coordinates / P18 / Confidence / Reasonsを比較し、Link、Create New、Ignoreを人が選ぶ。

## Field priority and provenance

既存値は自動上書きしない。ManualまたはApproved provenanceは値が空でも保護する。空欄へ保存した値は`venue_field_sources.source=wikidata`、`review_status=unreviewed`とする。異なるSource値は非current provenance候補として残す。

New VenueのWikidata座標は`coordinate_source=wikidata`で保存する。Existing Venueでは両座標が空のときだけ補完する。

## P18 image and rights

既存Commons clientで画像URL、thumbnail、Commons page、Reported License、Author、Credit、Usage Terms、License URLを取得する。候補は`rights_status=needs_review`、`review_status=unreviewed`から開始し、Primary / Approved / Publishedへ自動昇格しない。Reported Licenseの日本語展開は既存`interpretCommonsLicense`を再利用する。

## Full sync, change detection, and deletion safety

`API Import → Wikidata`から件数指定Importまたは全件同期を実行する。Full Syncは事前COUNTを成功条件にせず、museum rootとart gallery rootを別々にQID文字列順で巡回する。各rootで直前QIDをcursorとして次の100件を取得し、100件未満のpageを終端とする。root間の重複QIDは同じrun内で除外する。この方式は総件数不明のまま開始でき、大量OFFSETと集約Queryを避けられる。

各Discovery pageは取得直後に詳細取得・正規化・保存まで完了させてから次へ進む。Adminは最新の`import_runs.metrics`をpollingし、Processed / Fetched / New / Linked Existing / Updated / Unchanged / Needs Review / Image Candidate Added / Errors、page数、retry数、現在root / cursorを表示する。正確なpercentageや事前総件数は表示しない。

Full Syncは全QIDをscanし、New / Changed / Unchanged / Needs Reviewを集計する。同じQID、source record、image candidateはupsertされる。Sourceから見えなくなったVenueを自動Delete、Archive、Unpublishしない。

`import_runs.operation_type=wikidata_venue_import`へ標準件数と、linked / needs review / image candidate / completeness before-afterを`metrics`で保存する。途中失敗は`partial`または`failed`であり`completed`にしない。

## Rate-limit protection

- WDQS Full Sync: root別に1 page最大100 QID、page間1,000ms
- Entity API: 最大50 QID/batch、batch間500ms
- Discovery timeout: 45秒
- Discoveryは最大4回retryし、1.5秒から最大20秒まで指数backoff。retryのたびに`import_runs.metrics.retryCount`を更新する
- Entity batch失敗はErrorへ記録し、後続batchを継続
- Discoveryが最終的に失敗した場合、処理済みデータがあればrunは`partial`、なければ`failed`。`completed`とは記録しない
- Full Syncは明示操作のみ。Cronはv1対象外

## Local validation (2026-09-05)

| Run | Offset | Fetched | New | Linked | Updated | Unchanged | Review | Images | Errors |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 5 | 0 | 5 | 4 | 0 | 0 | 0 | 1 | 1 | 0 |
| 20 | 5 | 20 | 20 | 0 | 0 | 0 | 0 | 12 | 0 |
| 100 | 25 | 100 | 99 | 0 | 0 | 0 | 1 | 37 | 0 |
| Repeat 5 | 25 | 5 | 0 | 0 | 0 | 5 | 0 | 0 | 0 |

Venue totalは178→301、平均Completenessは17%→29%。QID source record 125件中123件がVenueへLinkされ、QID重複は0件。この表はFull Sync前の段階的検証記録であり、全件結果は下記へ追記する。

## Source A operational report

全件同期後の再現可能な診断は`supabase/snippets/wikidata_venue_source_a_report.sql`を使用する。Venue総数、type、全field coverage、現行6項目のCompleteness、P18 / Commons候補 / rights / approved image、reported license、Needs Review理由、Source-A-created Venueと既存VenueのPotential Duplicateを読み取り専用で出力する。Duplicateは自動Mergeしない。

### Full Sync result — 2026-09-05 LOCAL

| Metric | Result |
| --- | ---: |
| Discovered | 4,970 |
| Fetched / Processed | 4,963 |
| Discovery pages | 50 |
| New Venue | 4,679 |
| Linked Existing | 3 |
| Updated | 5 |
| Unchanged | 123 |
| Needs Review | 156 Venues / 178 candidate rows |
| Image Candidate Added in this run | 3,119 |
| Retry / Error | 0 / 0 |
| Elapsed | 51m 30s |

Venueは301→4,980（Published 1 / Draft 4,979）、現行Completenessは29%→38%。Discovery 4,970件と処理4,963件の差7件は、詳細取得後にVenueへ正規化できなかったEntityであり、API Errorではない。

Source-A-created Venueと既存Venueの間で、exact name / name_en / official domain / address / approximately 500m coordinatesを使った事後診断による新規重複pairは0件。Importerが作成を止めたNeeds Reviewは156 Venue・178候補あり、自動Mergeせず人が判断する。1 Venueへ複数QIDがlinkされた対象は3件（上石津郷土資料館、旭川市博物館、札幌大学埋蔵文化財展示室）で、Wikidata側identityの手動確認が必要。

P18は3,171 Venue source recordsあり、Commons candidate 3,171件を3,170 Venueへ保存した（1 Venueは複数QID由来）。全candidateがRights未確認で、Approved Imageは0。画像権利は自動承認しない。

Source Aの全件投入機構は、安定したJapan museum / gallery seed sourceとして一旦完了扱いにできる。ただしSource A単独で運営用Venue Masterが完成した意味ではない。Needs Reviewと複数QIDを解消し、Source Bで営業時間、休館日、アクセス、住所階層、説明、rights-cleared imageを補う必要がある。

## Known limitations

- P131一段のlabelをregionとして保持し、行政階層からcityを推測しない。
- Address / postal code / opening hoursはWikidata coverageに依存する。
- Safe rootのためmuseum / art gallery系統に分類されないArt Spaceは落ちる。
- Admin request内の長時間同期。大規模運用ではJob Queue / progress UIが必要。
- Sourceから消えたQIDの`not seen`表示は未実装。自動削除禁止は維持する。
