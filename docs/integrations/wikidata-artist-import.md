# Wikidata Artist Importer v1

Status: Draft. Artist MasterのSource Aとして使うLOCAL実装と検証結果を記録する。

## Purpose and boundary

Artist Masterは、展覧会と作品を作家へ結び、Favoriteや将来の発見体験に使うCanonical identityである。長い作家略歴を自動生成する機能ではない。Source AはWikidataとし、Importerが作るレコードは常にDraftにする。Global Full Sync、定期実行、STG / Production同期はv1の対象外。

## Discovery

対象は、Wikidata上でOccupation (`P106`) がVisual artist (`Q3391743`) またはその下位クラスであるItemである。

```sparql
?item wdt:P106/wdt:P279* wd:Q3391743.
```

国籍による制限は行わない。一般的なArtist (`Q483501`) 全体を起点にせず、作曲家・俳優等の混入を抑える。Count modeは検証用の有限取得、Full SyncはQID cursorと100件pageで全件を走査する。Full SyncはAdminから明示操作した場合だけ実行し、LOCALでは今回実行していない。

## Canonical mapping

- `name`, `name_en`, `name_native`, `aliases`
- `birth_date` / `birth_year`, `death_date` / `death_year`
- `nationality_country_code`, `birth_country_code`, `birth_place`
- `official_url`
- Occupation (`P106`), Field of work (`P101`), Movement (`P135`) はraw classificationとしてSource recordへ保存
- Image (`P18`), Commons category (`P373`), Japanese / English Wikipedia sitelink

複数国籍はWikidata QID配列をraw payloadへ保持し、単一国籍に確定できる場合だけCanonicalなISO country codeへ反映する。分類値からTagを自動生成しない。事実として取得できない地域・国籍・分類は推測しない。

## Identity, priority, and provenance

`source_records(data_source_id, external_id)`の`external_id`にQIDを使い、checksumが同一なら再取込をskipする。既存Artistは完全一致する名前・英語名・Aliasを候補にし、生年一致でconfidenceを補強する。複数候補が同点の場合だけ`artist_external_match_candidates`へ保存し、人が選択する。

Field priorityは既存Master Policyを再利用する。

```text
Manual > Official Website > Trusted API > Wikidata
```

Manualや高優先Sourceの値は上書きしない。適用した値と採用しなかった値の双方を`artist_field_sources` / raw source recordで追跡できる。

## Image discovery and rights

画像候補は次の順で探索し、人物・肖像候補を最大3件保存する。

1. Wikidata P18
2. Wikipedia article lead image (`pageimages`)
3. Wikimedia Commons category

作品のみ、ポスター、書籍表紙、署名、ロゴ、地図、図表と判断できるFile titleは除外する。人物候補は`portrait_photo > artist_at_work > self_portrait > portrait_artwork > other`として保守的に分類する。分類は適合性の証明ではなく、人による確認の補助情報である。Source URL、作者、Credit、Reported license、License URL、利用条件と探索経路を保存する。外部Licenseが存在してもMuuzeeのRightsを自動でApprovedにはせず、原則`needs_review`とする。PrimaryがなくActive Candidateが1件だけの場合はPrimaryへ自動設定できるが、Rights状態は保持する。複数候補はAdminで人が選択する。

QIDが確定済みでWikidata checksumが同一の場合も画像探索だけは再実行する。これにより、以前の`no image`結果やWikimedia側の追加画像を固定化しない。CandidateはSource record + provider + Commons file titleで冪等に保存する。

## Admin and completeness

Artist一覧はTier、Name、Image Status、Name EN、Nationality、Core Quality、Publicationを表示する。TierはA / B / C / A+B、PublicationはAll / Published / Unpublishedを含み、Nationality missing、Image、Completeness、Sourceと併用できる。Detail DrawerはStatus / Edit / Dataを維持し、Artist Core QualityはName / Name EN / Nationality / Primary Imageの4軸。DataにはQID、raw classification、Wikipedia、画像探索診断とGetty / APJがCoverage Testのみであることを表示する。

Completenessの主要指標はName / Nationality / Primary Image。補助指標はName EN / Aliases / Birth or Death / Classificationである。Descriptionや推測的なStyle summaryはSource Aの完了条件に含めない。

## LOCAL validation (2026-09-06)

Count modeを5件、その後offsetを進めて20件で実行した。全件同期は実行していない。

| Metric | 5件 | 追加20件 |
| --- | ---: | ---: |
| Name | 100% | 100% |
| Name EN | 100% | 100% |
| Nationality | 80% | 85% |
| P18 | 40% | 15% |
| Image Candidate | 40% | 15% |
| Primary Image | 20% | 0% |
| Aliases | 40% | 40% |
| Birth | 100% | 50% |
| Death | 60% | 25% |
| Birth place | 100% | 40% |
| Occupation | 100% | 100% |
| Field of work | 0% | 0% |
| Movement | 0% | 0% |
| Wikipedia sitelink | 20% | 20% |
| Average completeness | 63% | 54% |
| Name + Nationality + Primary complete | 1/5 | 0/20 |

同じ20件を再実行し、New 0 / Updated 0 / Unchanged 20 / Candidate added 0を確認した。つまりQID + checksumのIdempotencyは成立している。SampleはQID順の有限sliceなので、著名作家・日本作家・時代区分の代表性を保証するCoverage調査ではない。画像・Field of work・MovementのCoverageが低いため、Source AだけをArtist情報の完成条件にはしない。

25件全体の保存済みCandidateはP18由来5 Artist、Commons Category由来4 Artist、Wikipedia Article由来0 Artistだった。CommonsはP18を持つArtistへ候補を追加したが、今回のSampleでは「P18なし」のArtist Coverage改善は0件だった。Wikipedia fallbackも0件であり、探索経路は実装済みだが改善効果は未確認である。Candidateは12件、Muuzee Rightsの自動Approvedは0件。

## Production follow-up

本番導入前に、remote環境で取得量・SPARQL負荷・Import duration・retry・error率を測定する。Full Syncは運用承認後に実行する。Exhibition Artist matchingはSource表記を監査テーブルに残し、構造化Fieldを優先し、構造化Fieldがない場合は既存Artistの明示的なタイトル完全一致だけを扱う。曖昧候補は自動Relationにせず、画面表示時の再Matchも行わない。

Wikipedia Artist EnrichmentはWikidata QIDのsitelinkからInfoboxを取得し、明示的な単一NationalityだけをSource Priorityに従って不足Fieldへ適用する。Birth Placeからの国籍推測とWikipedia本文のDescription転記は禁止。Getty ULAN / APJ DAJの結果は[`docs/research/artist-source-coverage.md`](../research/artist-source-coverage.md)、品質運用は[`docs/master-data/artist-data-quality-operations.md`](../master-data/artist-data-quality-operations.md)を参照。

展覧会起点のPriority / Image Coverage調査は[`../research/artist-priority-image-coverage.md`](../research/artist-priority-image-coverage.md)を参照する。APIは検証用に`names`（安全な一意完全一致のみ）または既知の`qids`によるTargeted Importを受け付ける。名前が曖昧な場合は自動選択しない。
