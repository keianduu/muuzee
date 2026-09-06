# Artist Structured Source Coverage

Date: 2026-09-06
Status: Draft / Research
Environment: LOCAL only

## Scope and policy

Wikidata → Wikipediaで不足するArtist Fieldについて、Getty ULANとArt Platform Japan「日本アーティスト事典（DAJ）」の実測Coverageを確認した。初回Coverage Testに続き、2026-09-06にTier A不足対象だけのTargeted EnrichmentをLOCALへ適用した。Full Syncは行っていない。

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

ULANはAliases、Nationality、Role、Authority IDの補完候補として有望。現在の公式案内どおり、旧XML Web ServiceではなくGetty reconciliation endpointとLinked Open DataをTargeted Lookupに使用する。複数Nationality descriptorはRaw Source Recordに保持し、canonical country codeは一意な場合だけ保存する。

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

APJ DAJは日本ArtistのIdentity、Reading、英語名、Birth Place、活動領域の補完候補として特に有望。Targeted Enrichmentは公開Artistページだけを参照し、APJ IDをExternal IDとして保存する。APJ収録やBirth PlaceからNationalityを推測せず、画面に国籍が明記されない場合は国籍値を作らない。

## Tier A targeted result

実DBでNationality Missingだった8件は、いわさきちひろ、エットレ・ソットサス、カイ・フランク、やなせたかし、一原有徳、向井潤吉、平山郁夫、平櫛田中。

| Artist | APJ | Getty | Explicit nationality | Master result |
| --- | --- | --- | --- | --- |
| いわさきちひろ | A1123 exact | no exact | none | blank retained |
| エットレ・ソットサス | none | 500019835 exact | Austrian / Italian | raw retained; canonical blank |
| カイ・フランク | none | 500103402 exact | Finnish | FI applied |
| やなせたかし | A2798 exact | no exact | none | blank retained |
| 一原有徳 | none | 500468906 exact | Japanese | JP applied |
| 向井潤吉 | A1956 exact | 500525357 exact | Japanese | JP applied |
| 平山郁夫 | A1822 exact | 500319544 exact | Japanese | JP applied |
| 平櫛田中 | A1815 exact | 500337156 exact | Japanese | JP applied |

再実行時はNationality、Candidate、Primaryの追加0件で、冪等性をLOCAL確認済み。

## Recommendation

次Sourceの優先検討順は次の通り。

1. 日本Artist: APJ DAJをIdentity / Authority照合に使う。
2. 国内外Artist: Getty ULANを明示NationalityとAuthority IDの補完に使う。
3. いずれもExhibition / Workから必要になったArtistだけを処理し、曖昧候補は自動適用しない。

Coverage再実行Scriptは`scripts/test_artist_source_coverage.mjs`。Targeted EnrichmentはAdminまたは`/api/admin/artists/targeted-enrichment`でDry Runを先に実行する。
