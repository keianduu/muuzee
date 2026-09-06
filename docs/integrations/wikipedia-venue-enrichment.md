# Wikipedia Venue Enrichment

Status: Draft. LOCAL実装。STG / Production / Cronは未実装。

## Role

Wikipedia / MediaWiki APIは、確定済みWikidata QIDからsitelinkを解決し、Venueの不足住所を補うFallback Sourceとして使用する。Venue名検索は行わず、`jawiki`を優先し、`enwiki`は日本語住所として安全に適用できる場合だけ候補にする。Wikipedia本文をDescriptionへコピーしない。

取得順は `Wikidata → Wikipedia → Official Website → AI / Manual`。これは取得順であり、AddressのCanonical Source Priorityは `Manual > Official Website > Trusted API > Wikipedia > Wikidata` とする。

## Extraction and automatic application

- 対象は実効Tier A〜C、住所欠損、確定QIDありのVenue。
- 公式MediaWiki Action APIの`wbgetentities`および`action=query`を使う。
- Infobox / Templateの`所在地`、`住所`、`location`、`address`等の明示Fieldだけを抽出する。
- 自由文から所在地を推測しない。空白、改行、ref、基本的なTemplate markupだけを除去する。
- 明確な住所が1件でCanonical Addressが空ならHuman Reviewなしで適用する。
- 値が同一ならidempotentに変更しない。既存値と異なる場合はConflictとして返し、自動上書きしない。
- Manual / Official Website由来の住所は保護する。

## Provenance

適用時は`data_sources.key=wikipedia`の`source_records`へQID、Wikipedia language、title、page ID、URL、raw extracted valueを保存する。記事全文は保存しない。`venue_field_sources`には`field_name=address`、`source=wikipedia`、記事URL、source record、value snapshot、`generated_by_ai=false`、`review_status=applied`、`is_current=true`を保存する。

郵便番号は自然に明示取得でき、既存値が空の場合のみ保存できるが、MVPの必須Fieldではない。Venue CompletenessはName、Address、Coordinates、Description、Primary Image、Opening Hoursの6項目で評価する。

## Admin and LOCAL operation

`/admin/venues`の「Wikipedia住所補完」からA、A+B、A〜C、またはCheckbox選択Venueへ実行できる。Dry Runと最大200件のLOCAL上限を持ち、Requested / Processed / Wikipedia Found / Address Found / Address Added / No Article / Address Not Found / Conflict / Errorを表示する。

初期LOCAL検証は5件、次に20件で行った。残り対象は後述の全件Dry Runと安全判定を経てLOCALへ適用した。STG / Production / Cronは別途承認対象とする。

## LOCAL verification — 2026-09-06

5件、続いて20件を実処理した。合計25件中、Wikipedia記事24件、明示住所24件を取得し、24件をVenue Masterへ適用した。No Articleは1件、Address Not Found、Conflict、Errorはいずれも0件だった。適用済み1件を明示再取得すると`unchanged`になり、current provenanceは1件のままで、冪等性を確認した。

A〜Cの住所欠損は109件から85件へ減少した。全173件に対する住所Coverageは37.0%（64 / 173）から50.9%（88 / 173）、Venue Completeness平均は55.4%から57.7%へ改善した。Tier別の住所CoverageはA 37.0%（17 / 46）→89.1%（41 / 46）、B 21.1%（4 / 19）のまま、C 39.8%（43 / 108）のまま。初回サンプルの並び順により実適用はAへ集中したため、今後のバッチ選択はA、B、Cをround-robinで抽出するよう修正済み。

郵便番号は参考値としてA 29 / 46、B 11 / 19、C 52 / 108で、今回の住所適用では増加しなかった。Coordinates、Official URL、Description、Opening Hours、Closed Days、Access、Image Candidate、Primary Imageの値は住所処理では変更していない。現在値は順にAが40 / 42 / 41 / 0 / 0 / 0 / 41 / 30、Bが13 / 13 / 13 / 0 / 0 / 0 / 9 / 9、Cが77 / 79 / 78 / 0 / 0 / 0 / 37 / 37。

初期25件時点で、住所欠損を理由にOfficial Website Crawlerへ回る対象は24件減った。住所欠損85件のうち確定QIDを持つ残り50件は、後述の安全対策後にLOCAL処理した。

## Remaining A–C LOCAL batch — 2026-09-06

残りの住所欠損かつ確定QIDあり50件を対象に、全件Dry Runを先行した。初回Dry RunでWikipedia Template断片、先頭区切り文字、複数拠点Entityの単一住所化リスクを検出したため、Template除去と安全判定を強化して再実行した。再Dry RunはArticle Found 47、Address Found 44、No Article 3、Address Not Found 3、Conflict 0、Error 0。安全と判定した44件だけをLOCALへ適用した。

- Applied: 44 / 50
- No Article: 南アルプス市立美術館、大阪芸術大学博物館、静岡市美術館
- Explicit address unavailable: フジヤマミュージアム、笠間日動美術館
- Automatic application excluded: 東京藝術大学大学美術館（Entityが取手・上野の複数拠点を明示）
- Idempotency: 適用済み3件を再処理し、3件とも`unchanged`。Provenance追加なし
- Current Wikipedia address provenance: 68 Venue / 68 current rows

A〜Cの住所Coverageは50.9%（88 / 173）から76.3%（132 / 173）へ改善した。Tier別はA 91.3%（42 / 46）、B 68.4%（13 / 19）、C 71.3%（77 / 108）。全体Completeness平均は61.9%、中央値67%。住所欠損は41件で、そのうちOfficial URLがありOfficial Website Crawlerで住所を調査できるものは47件から6件へ減った。残る35件は先にOfficial URL調査またはManual対応が必要。Opening Hours / Closed Days / Accessは全173件で不足しているため、Official Website Crawlerのdistinct対象総数は134件のまま。

この実行はLOCALのみ。STG / Production / Cronは未実施であり、Wikipediaで取得できなかった値を推測補完していない。
