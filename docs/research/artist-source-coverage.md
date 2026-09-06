# Artist Structured Source Coverage

Date: 2026-09-06
Status: Draft / Research
Environment: LOCAL only

## Scope and policy

Wikidata → Wikipediaで不足するArtist Fieldについて、Getty ULANとArt Platform Japan「日本アーティスト事典（DAJ）」の実測Coverageを確認した。今回はWeb上の公式提供画面を読み取るCoverage Testだけであり、Importer、Full Sync、Master更新、Field Provenance登録は行っていない。

LOCAL / STG / Productionはいずれも、ExhibitionやWorkから必要になったArtistだけをTargeted Importする。Global Artist Full Sync、Cron、remote Supabase同期は、必要性と運用承認が得られるまで行わない。

## Current Muuzee baseline

| Source stage | Population | Nationality | Name EN | Aliases | Birth | Death | Birth Place |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Wikidata only | 60 | 41 (68.3%) | 60 (100%) | 35 (58.3%) | 50 (83.3%) | 30 (50.0%) | 44 (73.3%) |
| + Wikipedia Infobox | 60 | 48 (80.0%) | 60 (100%) | 35 (58.3%) | 50 (83.3%) | 30 (50.0%) | 44 (73.3%) |

WikipediaはNationality Missing 19名をDry Runし、明示的かつ単一のNationalityを7名で取得してLOCALへ適用した。Birth Placeや活動国から国籍を推測せず、本文やBiographyをDescriptionへコピーしていない。

## Getty ULAN

SampleはLOCAL Tier A+Bの34 Artist。英語名を使ってULAN検索し、候補が1件だけの場合に限って同一人物としてCoverageを計測した。

| Metric | Result |
| --- | ---: |
| Unique match | 24 / 34 (70.6%) |
| Multiple candidates | 2 / 34 (5.9%) |
| No unique match | 8 / 34 (23.5%) |
| Request errors | 0 |

Unique match 24件におけるField存在数：Preferred Name 24、Variant Names / Aliases 24、Nationality 24、Role 24、Birth 18、Death 14、Birth Place 13、Death Place 6、Authority ID 24。

ULANはAliases、Nationality、Role、Authority IDの補完候補として有望。ただし現在の公式案内では旧XML/Web Servicesは終了しており、OpenRefine reconciliation、SPARQL、Linked Open Data、download filesが案内されている。実装採否を決める前に、現行endpointの認証・利用条件・差分取得方法を別途設計する。

## APJ DAJ

SampleはTier A+Bのうち`nationality_country_code = JP`が明示済みの19 Artist。名前や出生地から日本国籍を推測せず、公式検索画面の`name` queryで日本語名完全一致が1件だけのものをMatchとした。

| Metric | Result |
| --- | ---: |
| Unique match | 16 / 19 (84.2%) |
| Multiple candidates | 0 |
| No match | 3 / 19 (15.8%) |
| Request errors | 0 |

Unique match 16件におけるField存在数：Japanese Name 16、English Name 16、Reading 16、Birth 16、Death 10、Birth Place 16、Field / activity 16、Biography Source 8、Artist ID 16。

未Matchは、はしもとみお、國松明日香、落合陽一。明示済みJPだけを母数にした保守的テストなので、Nationality Missingの日本Artistに対する潜在的な追加Coverageは別途評価が必要。

APJ DAJは日本ArtistのIdentity、Reading、英語名、Birth Place、活動領域の補完候補として特に有望。公開画面は検索結果をSSRで返し、内部GraphQL endpointも公開設定に現れるが、今回は公開Web画面だけを利用した。利用規約上、出典明記を伴う利用が案内される一方、データベース全体の複製や第三者権利を含む情報には制約があるため、正式Importer前に取得方法とField単位の権利確認を行う。

## Recommendation

次Sourceの優先検討順は次の通り。

1. 日本Artist: APJ DAJ。Match率が84.2%でReading・Birth Place・Fieldが強く、Muuzeeの識別補完に適する。
2. 国内外Artist: Getty ULAN。Match率70.6%でAliases・Nationality・Authority IDが強い。
3. いずれも正式採用前にstable ID matching、曖昧候補処理、API/LOD取得方式、利用条件、Source Priorityを設計する。

再実行Scriptは`scripts/test_artist_source_coverage.mjs`。結果は標準出力JSONで、Master DBを書き換えない。
