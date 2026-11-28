# Wikidata Artist Acquisition

Status: Draft. Artist MasterのCurrent MVP acquisition contractと旧検証履歴を記録する。

## Current contract (Order 343 Phase B, 2026-11-28)

MVP初回取得は、737,777件のWikidata Visual Artist occupation tree全量Discoveryを行わない。美術館の展覧会参加記録を起点に、出展者Role、異なる展覧会2件以上、再現可能なranking、exact QID Identityを満たす最大1,000人のversioned Seed Manifestを作り、Manifestから`artist_discovery_inventory`へ投入する。Wikidataは選定Sourceではなく、選定後のIdentity確認とCanonical基本情報取得に使う。

Current Source of Truth:

- Selection / ranking: `scripts/lib/artist-seed-manifest.mjs`
- Reproducible generator: `scripts/build-artist-seed-manifest.mjs`
- Manifest: `data/artist-acquisition/mvp-artist-seed-manifest.v1.json`
- Manifest persistence / mixed settlement: `supabase/migrations/202611280002_artist_seed_manifest.sql`
- Target-guarded persistence: `scripts/apply-artist-seed-manifest.mjs`
- Bounded consumer / hosted route: `src/lib/wikidata/artist-discovery-inventory.ts`, `src/app/api/admin/artists/import/wikidata/route.ts`

### Selection sources and evidence boundary

v1は少数の信頼できるSourceに限定する。

- MoMA Exhibition History: official GitHub datasetの固定commit `5e1ce97416613068832255bdc4ddccc0fec7c508`、CC0、`ExhibitionRole=Artist`のみ。
- Art Platform Japan: MoMA条件を満たす日本人候補について、APJ Artist authorityのWikidata QIDがexact一致した場合だけboundedに展覧会Evidenceを追加。APJ全DBは複製しない。
- Wikidata Entity API: 展覧会Evidenceで選定した後のQID label / occupation / field-of-work補足だけ。

Art Commons / Japan Searchは現行MapperにArtist participant relationがなく、所蔵Worksを展覧会参加の代用にしないためv1には含めない。欧州Open Data候補も調査したが、Artist participantを一貫して取得できないSourceは採用しない。同一Source内の巡回展はtour rootで重複排除し、Sourceを跨ぐ自動同一展判定は行わずEvidenceを保存する。

### Manifest v1 result

Committed Manifestは1,000人、checksum `8db8f383d02fab2386fe489b6da0bbd68605e2a28ed67afa74bc5820a6b80317`。全件QID確認済み、Identity Review 0、各Artistは異なる展覧会Evidenceを2件以上持つ。MoMA由来で北米展示接点1,000人、APJ augmentationで日本展示接点27人、欧州展示接点15人。活動/国籍cohortでは欧州431人、日本30人、主要NationalitiesはAmerican 512 / French 128 / German 74 / British 61 / Italian 40 / Japanese 30。代表上位は横尾忠則、池田満寿夫、棟方志功、菅井汲、靉嘔、篠原有司男、河原温、北大路魯山人、Pablo Picasso、Henri Matisse。

このCoverage値はSource由来のFactであり、世界全体のArtist分布推定ではない。地域CoverageはManifest全体として確保し、各Artistが3地域すべてで展示したという意味ではない。欧州館Evidenceはv1 Sourceの制約で15人に限られるため、追加SourceはArtist participantが明示された公式Open Dataだけを別versionで検討する。

### Runtime and safety contract

- Manifestはscope / version / checksum / count / ranked evidenceをDBへ保存する。
- Manifest generationは無関係なInventoryをinactivateしない。
- exact QID/sourceだけを自動Identity authorityとし、name / alias collisionはReviewへ隔離する。
- validとterminal-invalidを同一transactionでsettleし、1件のlabel欠落でbatch全体を無限retryしない。
- provider omission / unknown responseはtransientとしてbatchをreleaseし、fail closedする。
- cross-entity Source ownershipは最初のwrite前に検証する。
- hosted実行はfeature flagとSupabase project refのexact一致が必要。claim / provider fetchのbatch上限は50。STG Nanoでidentity collision量に左右されずstatement timeoutを避けるため、DB settlementは5件ずつのatomic chunkに分け、未settle claimだけをrelease / resumeする。
- reference cacheは500 entityに上限を設け、Artist本体はbatch後にcacheから除外する。
- CanonicalはDraft。画像hintはSource payloadへ保存するだけで、画像探索・Rights承認・Publishは別process。

### Rollout boundary

LOCAL migration / Manifest persistence / batch 20・50の検証後、exact STG `steibqgeoqcsfsafaqcv`だけへmigrationと最大150 Artist canaryを行う。Production `lqinmolonctddovltujy`へのmigration / mutationはPhase B対象外。STG canaryは専用generationで識別し、Venueを変更しない。

LOCAL実測では20件batchが約24.1秒、50件batchが約37.7秒で、いずれもReview / invalid 0、Draft Canonical作成とsource / provenance / Inventory settlementが完了した。50件batchは1件あたり約0.75秒で、1,000件はprovider待ち・retry余裕を含めて約13〜25分を初期計画範囲とする。Manifest再適用後もprocessed 70 / pending 930を維持し、無関係なInventoryの無効化や重複Manifest生成はなかった。Production値はSTG canary実測で再補正し、Phase BではProductionへ適用しない。

## Historical contract (Order 343 Phase A, superseded by Phase B)

Phase Aは737,777件のGlobal scopeを実測し、永続Inventory / lease / atomic settlementを構築した履歴である。Global Discovery方針と全量時間推定はPhase B Human Decisionにより廃止されたが、安全基盤はManifest consumerへ再利用する。

Source of Truth:

- Schema / atomic settlement: `supabase/migrations/202611280001_artist_discovery_inventory.sql`
- Bounded LOCAL generator: `scripts/generate-artist-discovery-inventory.mjs`
- Consumer: `src/lib/wikidata/artist-discovery-inventory.ts`
- Transactional validation: `supabase/snippets/artist_discovery_inventory_validation.sql`
- Benchmark: `scripts/benchmark-artist-acquisition-foundation.mjs`

### Discovery scope evidence

2026-11-28のWDQS実測では、現在の`P106/P279* Q3391743`条件は **737,777件**、COUNT応答は約16.0秒。Occupation別上位は画家247,098、映画監督103,064、写真家97,175、美術家68,517、彫刻家66,933、イラストレーター48,789。複数Occupationを持つItemがあるため合計は全体件数と一致しない。映画監督等も含む広いontologyだが、Phase Aで無断に対象条件を絞らない。

ORDER BYなしの100件bounded sampleは、日本語ラベル67/100、英語ラベル94/100、国籍statement 96/100、日本国籍27/100。これは無作為標本ではなく、全体比率に一般化しない。日本人と海外Artistの両方が対象であることは確認できた。

`ORDER BY STR(?item)`のQID cursor pageは35秒上限内に完了しない試行があった。Production inventory generationをこのWDQS pageだけに依存させず、公式Wikidata dumpのstreaming / partitioned extractionまたは同等のresumable workerをrollout前に確定する。

### Identity and atomic settlement

`source_records(data_source_id, external_id)`のexact QID一致だけが自動linkのIdentity authorityである。`artist_search_keys`は全Artist読み込みを排除するindexed collision searchであり、name / name_en / alias一致は自動linkの証拠には使わない。

- exact QID/source link: 既存CanonicalのIdentityを維持
- indexed name / alias collision: `review`へ隔離、Sourceはunlinkedのまま
- 既存QIDを持つCanonicalへの別QID auto-link: 禁止
- 生没年矛盾: Review evidenceとして保存
- collisionなし: Draft Canonical / Source / Provenance / Inventoryを同一DB transactionでsettle
- unknown schema / ownership mismatch / partial failure: 全batch rollback

Review発生は後続Inventoryを停止しない。実際のownership mismatchやatomic apply failureはfail closedでretryへ戻す。

### Image discovery separation

P18 / Commons category / Wikipedia sitelinkはSource payloadの`imageDiscoveryHints`へ保持する。Canonical構築中は画像APIやStorageを呼ばず、batch resultは`imageDiscoveryExecuted=false`を返す。画像候補取得は後続のresumable processとし、Order 343の画像Acceptanceは削除しない。Rights自動承認とPublishは行わない。

### Architecture comparison and recommendation

| Option | Throughput / timeout | Retry / operations | Phase A assessment |
| --- | --- | --- | --- |
| A. Venue同等Hosted consumer | 5件batchは安全だが737k件にはoverheadが大きい | lease / resume可能 | 全量の第一候補にしない |
| B. 最適化Hosted consumer | 50件、reference cache、2 DB RPC / batch | lease / backoff / checkpoint | persisted Inventory consumeの第一候補 |
| C. 認証済みCLI resumable worker | dump / partitionと長時間workerに適合 | target verificationが必須 | Inventory generationで有力 |

Phase A推奨は **CでDiscovery Inventoryを安定生成し、Bでbounded consumeするhybrid**。Production実行方式はrollout前reviewに残す。Phase A generatorは`--local --apply --max-pages`を必須とし、remote targetを受け付けない。

### LOCAL benchmark and estimate

Deterministic synthetic dataset（existing 5,000 / incoming 1,000）で、旧全件走査は513.3 records/sec、batch p50 39.144 ms / p95 41.341 ms。Indexed resolverのindex初期化は6.921 msで、identity CPUは全batch sizeでボトルネックではなく、RSS差分29.45 MiB、synthetic review rate 6.7%、retry/failure 0%だった。DB / provider request数は実装topologyからのmodel値。sub-millisecond区間は実行環境のnoiseを受けるため、batch選定ではCPU値単独ではなくprovider burst、DB round trip、memory、rollback範囲を優先する。

| Batch | DB round trips / record | Provider requests / record (modeled) | CPU batch p95 |
| ---: | ---: | ---: | ---: |
| 5 | 0.400 | 0.600 | 0.009 ms |
| 20 | 0.100 | 0.150 | 0.013 ms |
| 50 | 0.040 | 0.100 | 3.124 ms |
| 100 | 0.020 | 0.080 | 0.036 ms |

Batch 100はprovider burst、memory、failure時rollback範囲が大きいため、**Phase A推奨batch sizeは50**。理論上は約14,756 batches、29,512 DB RPCs、reference cacheなしの保守的provider modelは約73,780 requests。

100 QIDのbounded provider sampleはQID query + 50件ずつのentity fetchで約21秒（約4.8 records/sec、reference fetch・DB apply未含）。全量の初期見積もりは約43時間が下限で、retry / references / DB applyを含む計画範囲は **43〜140時間**。STG実測でrollout前に補正する。

### Rollout plan

1. Phase A migration / consumer / LOCAL generatorをHuman review。
2. main統合後もSTG / Production migrationは別承認。
3. STGで小規模Inventoryとbatch 20/50/100を再計測。
4. Official dump / partitioned generatorのgeneration completenessとtarget verificationを確定。
5. Production Inventory完了証跡後にbounded consumerをresume可能に実行。
6. Canonical構築後に画像候補を別processで取得。

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
