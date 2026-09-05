# Venue Wikidata Coverage Test

## Full Sync follow-up — 2026-09-05 LOCAL

COUNT Queryを事前条件から外し、museum / art gallery root別のQID cursor paginationでJapan Full Syncを完了した。50 Discovery pages、4,970 discovered、4,963 processed、Retry 0、API Error 0、所要51分30秒。Venueは301から4,980へ増え、New 4,679 / Existing Link 3 / Updated 5 / Unchanged 123 / Needs Review 156だった。

### Venue type after Source A

| Type | Count |
| --- | ---: |
| museum | 4,716 |
| gallery | 86 |
| art_space | 0 |
| commercial_space | 0 |
| other | 178 |

`other` 178件は主にSource A以前の既存Venue。Wikidata Discovery rootを根拠にSource A itemをmuseum / galleryへ分類しており、根拠のないart_space / commercial_space推定はしていない。

### Venue Master field coverage after Source A

| Field | Filled | Missing | Coverage |
| --- | ---: | ---: | ---: |
| name | 4,980 | 0 | 100.0% |
| name_en | 4,307 | 673 | 86.5% |
| aliases | 2,704 | 2,276 | 54.3% |
| venue_type | 4,980 | 0 | 100.0% |
| country_code | 4,804 | 176 | 96.5% |
| region | 4,511 | 469 | 90.6% |
| prefecture | 0 | 4,980 | 0.0% |
| city | 0 | 4,980 | 0.0% |
| address | 2,435 | 2,545 | 48.9% |
| postal_code | 1,516 | 3,464 | 30.4% |
| coordinates | 3,963 | 1,017 | 79.6% |
| official_url | 3,980 | 1,000 | 79.9% |
| inception_year | 2,775 | 2,205 | 55.7% |
| opening_hours | 0 | 4,980 | 0.0% |
| closed_days | 0 | 4,980 | 0.0% |
| access | 0 | 4,980 | 0.0% |
| description | 0 | 4,980 | 0.0% |

Source AでlinkされたVenueの`country_code`はDiscovery条件を根拠にJP。既存Venueの欠損176件は推測で補っていない。P131 labelは`region`へ保存し、prefecture / cityへ推測分割していない。

### Image and completeness

- P18: 3,171
- Wikimedia candidate saved: 3,171 records / 3,170 Venues
- Rights unconfirmed: 3,171 records
- Approved image: 0
- Venue without Source A image candidate: 1,810
- Current six-field Average Completeness: 29% → 38%

### Duplicate and review result

- Source-A-created Venueと既存Venueの事後Potential Duplicate: 0 pair
- 作成前に止めたNeeds Review: 156 Venue / 178 candidate rows
- 1 Venueに複数QIDがlinkされた要確認対象: 3 Venue
- 主なReview根拠: normalized name exact、museum/gallery description、Japan location signal。official domain mismatchを含む候補は3件

### Source A decision and Source B requirements

Wikidata Source AのDiscovery / Import /差分同期機構は一旦完了扱いにできる。Master全体の完成ではなく、Review queueとSource Bが前提。

1. Priority 1: opening hours、closed days、access、prefecture / cityを含む検証済み住所・postal code
2. Priority 2: rights-cleared primary image、venue description
3. Priority 3: missing coordinates、official URL、English name / aliases、inception year

Source Bは今回選定・実装しない。候補は公式Venue site、自治体・公的データ、利用条件が明確な画像Sourceを優先する。

## 1. Test date

- 2026-09-05T02:20:58.484Z
- Local database venue count: 178
- Evaluated rows: 178
- Stages: 5 smoke → 20 sample → 178 full

## 2. Purpose and safety

This is a read-only coverage measurement for evaluating Wikidata as Venue Master Source A. The script only selected local `venues` rows and called Wikidata read APIs. It did not write to the database, Storage, candidate tables, staging, or production.

## 3. Methodology

- Search terms: local `name`, `name_en`, and aliases.
- Matching evidence: normalized names, aliases, official-domain agreement, local address/prefecture/city signals when present, country/type signals, name similarity, and Wikidata search rank.
- Top three candidates were retained in the CSV.
- **Strict** uses the current Muuzee formal threshold (0.85).
- **Possible** preserves plausible candidates below the formal threshold for human review; it does not adopt an entity.
- Field coverage uses the best candidate only. Missing fields remain null; nothing is inferred.
- Opening schedule is marked available only when Wikidata has P3025 (open days) and/or its P8626/P8627 time qualifiers. This is not assumed to be a complete visitor-hours string.
- Opening year uses P1619 when present, otherwise P571 inception.

## 4. Match coverage

| Class | Count | Rate |
| --- | --- | --- |
| High confidence / Strict | 2 | 1.1% |
| Possible / human review | 153 | 86.0% |
| No candidate | 23 | 12.9% |
| Entity exists (Strict + Possible) | 155 | 87.1% |

## 5. Field coverage

| Field | Strict only | Strict + Possible |
| --- | --- | --- |
| Japanese name | 2 / 2 (100.0%) | 155 / 155 (100.0%) |
| English name | 2 / 2 (100.0%) | 155 / 155 (100.0%) |
| Aliases | 2 / 2 (100.0%) | 112 / 155 (72.3%) |
| Entity type | 2 / 2 (100.0%) | 155 / 155 (100.0%) |
| Country | 2 / 2 (100.0%) | 155 / 155 (100.0%) |
| Administrative area | 2 / 2 (100.0%) | 155 / 155 (100.0%) |
| Street address | 1 / 2 (50.0%) | 77 / 155 (49.7%) |
| Postal code | 2 / 2 (100.0%) | 108 / 155 (69.7%) |
| Coordinates | 2 / 2 (100.0%) | 151 / 155 (97.4%) |
| Official URL | 2 / 2 (100.0%) | 154 / 155 (99.4%) |
| P18 image | 2 / 2 (100.0%) | 142 / 155 (91.6%) |
| Commons category | 2 / 2 (100.0%) | 136 / 155 (87.7%) |
| Opening schedule | 0 / 2 (0.0%) | 11 / 155 (7.1%) |
| Inception / opening year | 2 / 2 (100.0%) | 142 / 155 (91.6%) |

## 6. Coordinate coverage

- Strict: 2 / 2 (100.0%)
- Strict + Possible: 151 / 155 (97.4%)

## 7. P18 coverage

- Strict: 2 / 2 (100.0%)
- Strict + Possible: 142 / 155 (91.6%)
- Images were not downloaded and rights were not evaluated.

## 8. Official URL coverage

- Strict + Possible: 154 / 155 (99.4%)

## 9. English name coverage

- Strict + Possible: 155 / 155 (100.0%)

## 10. Venue type coverage

| Local type | Total | Strict | Possible | None | Entity coverage |
| --- | --- | --- | --- | --- | --- |
| other | 178 | 2 | 153 | 23 | 155 / 178 (87.1%) |

The local source currently classifies all or most imported venues as `other`; this limits type-specific conclusions and no Wikidata type was copied back into Muuzee.

## 11. Geographic coverage

| Local geography | Total | Strict | Possible | None | Entity coverage |
| --- | --- | --- | --- | --- | --- |
| Unknown | 178 | 2 | 153 | 23 | 155 / 178 (87.1%) |

Geography uses only local country/address fields. Unknown rows were not guessed from a Wikidata candidate.

## 12. Main failure reasons

| Reason | Count |
| --- | --- |
| no exact normalized name or alias match | 14 |
| candidate confidence below relaxed threshold | 12 |
| Wikidata search returned no entity | 9 |
| candidate lacks a cultural-venue type signal | 8 |

## 13. Wikidata entity found but current strict matcher rejects it

Possible candidates below 0.85: 153. Examples (up to 30):

- NTTインターコミュニケーション・センター [ICC] → [Q3788869](https://www.wikidata.org/wiki/Q3788869) / Muuzee 0.20, analysis 0.79 / entity description identifies a museum or gallery; Japan location signal; name similarity 0.91; Wikidata search rank 1
- TOTOギャラリー・間 → [Q55526821](https://www.wikidata.org/wiki/Q55526821) / Muuzee 0.70, analysis 0.70 / normalized name exact match; Japan location signal; entity type/description is a cultural venue; Wikidata search rank 1
- アーティゾン美術館 → [Q913808](https://www.wikidata.org/wiki/Q913808) / Muuzee 0.80, analysis 0.80 / normalized name exact match; entity description identifies a museum or gallery; Japan location signal; Wikidata search rank 1
- いわき市立美術館 → [Q11260168](https://www.wikidata.org/wiki/Q11260168) / Muuzee 0.80, analysis 0.80 / normalized name exact match; entity description identifies a museum or gallery; Japan location signal; Wikidata search rank 1
- おぶせミュージアム・中島千波館 → [Q105334745](https://www.wikidata.org/wiki/Q105334745) / Muuzee 0.80, analysis 0.80 / normalized name exact match; entity description identifies a museum or gallery; Japan location signal; Wikidata search rank 1
- サンリツ服部美術館 → [Q11306065](https://www.wikidata.org/wiki/Q11306065) / Muuzee 0.80, analysis 0.80 / normalized name exact match; entity description identifies a museum or gallery; Japan location signal; Wikidata search rank 1
- しもだて美術館 → [Q139498029](https://www.wikidata.org/wiki/Q139498029) / Muuzee 0.80, analysis 0.80 / normalized name exact match; entity description identifies a museum or gallery; Japan location signal; Wikidata search rank 1
- セゾン現代美術館 → [Q11314323](https://www.wikidata.org/wiki/Q11314323) / Muuzee 0.80, analysis 0.80 / normalized name exact match; entity description identifies a museum or gallery; Japan location signal; Wikidata search rank 1
- ちひろ美術館・東京 → [Q11271822](https://www.wikidata.org/wiki/Q11271822) / Muuzee 0.80, analysis 0.80 / normalized name exact match; entity description identifies a museum or gallery; Japan location signal; Wikidata search rank 1
- パラミタミュージアム → [Q17221655](https://www.wikidata.org/wiki/Q17221655) / Muuzee 0.80, analysis 0.80 / normalized name exact match; entity description identifies a museum or gallery; Japan location signal; Wikidata search rank 1
- ひろしま美術館 → [Q63828](https://www.wikidata.org/wiki/Q63828) / Muuzee 0.80, analysis 0.80 / normalized name exact match; entity description identifies a museum or gallery; Japan location signal; Wikidata search rank 1
- フジヤマミュージアム → [Q109324144](https://www.wikidata.org/wiki/Q109324144) / Muuzee 0.80, analysis 0.80 / normalized name exact match; entity description identifies a museum or gallery; Japan location signal; Wikidata search rank 1
- ボーダレス・アートミュージアムNO-MA → [Q11338923](https://www.wikidata.org/wiki/Q11338923) / Muuzee 0.80, analysis 0.80 / normalized name exact match; entity description identifies a museum or gallery; Japan location signal; Wikidata search rank 1
- メナード美術館 → [Q1920251](https://www.wikidata.org/wiki/Q1920251) / Muuzee 0.80, analysis 0.80 / normalized name exact match; entity description identifies a museum or gallery; Japan location signal; Wikidata search rank 1
- 三溪園 → [Q4249885](https://www.wikidata.org/wiki/Q4249885) / Muuzee 0.70, analysis 0.70 / normalized name exact match; Japan location signal; Wikidata search rank 1
- 三菱一号館美術館 → [Q3815458](https://www.wikidata.org/wiki/Q3815458) / Muuzee 0.80, analysis 0.80 / normalized name exact match; entity description identifies a museum or gallery; Japan location signal; Wikidata search rank 1
- 三重県立美術館 → [Q11357837](https://www.wikidata.org/wiki/Q11357837) / Muuzee 0.80, analysis 0.80 / normalized name exact match; entity description identifies a museum or gallery; Japan location signal; Wikidata search rank 1
- 上野の森美術館 → [Q11360245](https://www.wikidata.org/wiki/Q11360245) / Muuzee 0.80, analysis 0.80 / normalized name exact match; entity description identifies a museum or gallery; Japan location signal; Wikidata search rank 1
- 世田谷文学館 → [Q11362100](https://www.wikidata.org/wiki/Q11362100) / Muuzee 0.80, analysis 0.80 / normalized name exact match; entity description identifies a museum or gallery; Japan location signal; Wikidata search rank 1
- 世田谷美術館 → [Q3892314](https://www.wikidata.org/wiki/Q3892314) / Muuzee 0.80, analysis 0.80 / normalized name exact match; entity description identifies a museum or gallery; Japan location signal; Wikidata search rank 1
- 丹波市立植野記念美術館 → [Q11368569](https://www.wikidata.org/wiki/Q11368569) / Muuzee 0.80, analysis 0.80 / normalized name exact match; entity description identifies a museum or gallery; Japan location signal; Wikidata search rank 1
- 九州国立博物館 → [Q148543](https://www.wikidata.org/wiki/Q148543) / Muuzee 0.80, analysis 0.80 / normalized name exact match; entity description identifies a museum or gallery; Japan location signal; Wikidata search rank 1
- 京都国立博物館 → [Q147286](https://www.wikidata.org/wiki/Q147286) / Muuzee 0.80, analysis 0.80 / normalized name exact match; entity description identifies a museum or gallery; Japan location signal; Wikidata search rank 1
- 京都国立近代美術館 → [Q1055628](https://www.wikidata.org/wiki/Q1055628) / Muuzee 0.80, analysis 0.80 / normalized name exact match; entity description identifies a museum or gallery; Japan location signal; Wikidata search rank 1
- 京都市京セラ美術館 → [Q3330657](https://www.wikidata.org/wiki/Q3330657) / Muuzee 0.80, analysis 0.80 / normalized name exact match; entity description identifies a museum or gallery; Japan location signal; Wikidata search rank 1
- 京都文化博物館 → [Q11375592](https://www.wikidata.org/wiki/Q11375592) / Muuzee 0.80, analysis 0.80 / normalized name exact match; entity description identifies a museum or gallery; Japan location signal; Wikidata search rank 1
- 佐久市立近代美術館 → [Q78314906](https://www.wikidata.org/wiki/Q78314906) / Muuzee 0.80, analysis 0.80 / normalized name exact match; entity description identifies a museum or gallery; Japan location signal; Wikidata search rank 1
- 佐倉市立美術館 → [Q11382975](https://www.wikidata.org/wiki/Q11382975) / Muuzee 0.80, analysis 0.80 / normalized name exact match; entity description identifies a museum or gallery; Japan location signal; Wikidata search rank 1
- 佐川美術館 → [Q7399081](https://www.wikidata.org/wiki/Q7399081) / Muuzee 0.80, analysis 0.80 / normalized name exact match; entity description identifies a museum or gallery; Japan location signal; Wikidata search rank 1
- 佐野市立吉澤記念美術館 → [Q11385006](https://www.wikidata.org/wiki/Q11385006) / Muuzee 0.80, analysis 0.80 / normalized name exact match; entity description identifies a museum or gallery; Japan location signal; Wikidata search rank 1

## 14. No plausible Wikidata entity found

- Museum+205 (0923162c-e72b-4c3d-b04d-e170340e3fe4)
- Oギャラリー eyes (45cfa797-1607-4a6c-9dce-846cf3fd7032)
- SCAI PIRAMIDE (c28141ea-9310-463a-bd80-5c09c6524bae)
- SCAI THE BATHHOUSE (b02c1d55-fc46-4d8e-9fb9-d84c2da81f78)
- ケンジタキギャラリー 名古屋 (b148d834-44e5-434e-af19-564e2c56fb39)
- タカ・イシイギャラリー 京橋 (8815fed5-1a0e-427c-85bb-9872de3523a3)
- ラッズギャラリー (cd7bd985-e578-487e-b057-455cb8a1a0df)
- 不知火美術館・図書館 (6dee9251-c8db-42f4-8c58-d3fde406cc4e)
- 世田谷美術館分館 向井潤吉アトリエ館 (1cd9c83b-2896-4d7f-a9e5-ca156208dadf)
- 世田谷美術館分館 宮本三郎記念美術館 (d840e0d2-4954-4add-84b0-baa641661190)
- 世田谷美術館分館 淸川泰次記念ギャラリー (6cc432c1-533b-4113-aed5-b4054a5cd067)
- 北鎌倉 葉祥明美術館 (2a5bc0f0-8eff-4745-8fb0-2ade73bfcdf2)
- 土門拳写真美術館 (5c0c1eb7-e203-4b37-a8cf-afe88e771c49)
- 大阪市立美術館天王寺ギャラリー (9aaf2b3f-9963-4463-b4cc-c81a123ee523)
- 小山登美夫ギャラリー京橋 (6c6ee18e-c3e2-4af2-abc5-df111b9c4e45)
- 常陽藝文センター (1dc37b4b-e8ca-4144-912a-bb5d5147baf9)
- 徳川美術館・蓬左文庫 (27808a1f-903f-4d13-8ad4-bb0be8d275bf)
- 株式会社名古屋画廊 (23ae3094-c4b6-4171-b869-b560faed4f3e)
- 武蔵野美術大学 美術館 (564dbbd2-953a-4ca1-bb7e-c98cb9e6a9b6)
- 水戸芸術館現代美術センター (d9511af8-025b-4c15-8856-6d7bed84d1d7)
- 泉屋博古館東京 (de089c56-ab4d-4adc-a8d6-aeff077dcd4d)
- 藍画廊 (5fd354fe-4b75-4529-aa1e-0fb7e0b589b2)
- 黄金崎クリスタルパーク ガラスミュージアム (79a58e0a-99f5-4829-a7e1-fe323c67e634)

## 15. Venues missing coordinates

- Museum+205 → no candidate
- Oギャラリー eyes → no candidate
- SCAI PIRAMIDE → no plausible candidate
- SCAI THE BATHHOUSE → no plausible candidate
- ケンジタキギャラリー 名古屋 → no candidate
- タカ・イシイギャラリー 京橋 → no candidate
- フジヤマミュージアム → [Q109324144](https://www.wikidata.org/wiki/Q109324144)
- ラッズギャラリー → no plausible candidate
- 不知火美術館・図書館 → no plausible candidate
- 世田谷美術館分館 向井潤吉アトリエ館 → no plausible candidate
- 世田谷美術館分館 宮本三郎記念美術館 → no plausible candidate
- 世田谷美術館分館 淸川泰次記念ギャラリー → no plausible candidate
- 北鎌倉 葉祥明美術館 → no plausible candidate
- 南アルプス市立美術館 → [Q123367795](https://www.wikidata.org/wiki/Q123367795)
- 土門拳写真美術館 → no plausible candidate
- 大阪市立美術館天王寺ギャラリー → no plausible candidate
- 小山登美夫ギャラリー京橋 → no plausible candidate
- 常陽藝文センター → no candidate
- 徳川美術館・蓬左文庫 → no plausible candidate
- 株式会社名古屋画廊 → no candidate
- 武蔵野市立吉祥寺美術館 → [Q124943865](https://www.wikidata.org/wiki/Q124943865)
- 武蔵野美術大学 美術館 → no plausible candidate
- 水戸芸術館現代美術センター → no plausible candidate
- 泉屋博古館東京 → no candidate
- 藍画廊 → no candidate
- 静岡市美術館 → [Q121503263](https://www.wikidata.org/wiki/Q121503263)
- 黄金崎クリスタルパーク ガラスミュージアム → no candidate

## 16. Venues missing P18

- Museum+205 → no candidate
- Oギャラリー eyes → no candidate
- SCAI PIRAMIDE → no plausible candidate
- SCAI THE BATHHOUSE → no plausible candidate
- おぶせミュージアム・中島千波館 → [Q105334745](https://www.wikidata.org/wiki/Q105334745)
- ケンジタキギャラリー 名古屋 → no candidate
- しもだて美術館 → [Q139498029](https://www.wikidata.org/wiki/Q139498029)
- タカ・イシイギャラリー 京橋 → no candidate
- フジヤマミュージアム → [Q109324144](https://www.wikidata.org/wiki/Q109324144)
- ラッズギャラリー → no plausible candidate
- 不知火美術館・図書館 → no plausible candidate
- 世田谷美術館分館 向井潤吉アトリエ館 → no plausible candidate
- 世田谷美術館分館 宮本三郎記念美術館 → no plausible candidate
- 世田谷美術館分館 淸川泰次記念ギャラリー → no plausible candidate
- 何必館・京都現代美術館 → [Q136472115](https://www.wikidata.org/wiki/Q136472115)
- 勝央美術文学館 → [Q132613645](https://www.wikidata.org/wiki/Q132613645)
- 北鎌倉 葉祥明美術館 → no plausible candidate
- 南アルプス市立美術館 → [Q123367795](https://www.wikidata.org/wiki/Q123367795)
- 土門拳写真美術館 → no plausible candidate
- 大阪市立美術館天王寺ギャラリー → no plausible candidate
- 大阪芸術大学博物館 → [Q123508358](https://www.wikidata.org/wiki/Q123508358)
- 小山登美夫ギャラリー京橋 → no plausible candidate
- 常陽藝文センター → no candidate
- 徳川美術館・蓬左文庫 → no plausible candidate
- 新潟市會津八一記念館 → [Q139807407](https://www.wikidata.org/wiki/Q139807407)
- 木田金次郎美術館 → [Q132541511](https://www.wikidata.org/wiki/Q132541511)
- 株式会社名古屋画廊 → no candidate
- 武蔵野市立吉祥寺美術館 → [Q124943865](https://www.wikidata.org/wiki/Q124943865)
- 武蔵野美術大学 美術館 → no plausible candidate
- 水戸芸術館現代美術センター → no plausible candidate
- 泉屋博古館東京 → no candidate
- 笠岡市立竹喬美術館 → [Q121362673](https://www.wikidata.org/wiki/Q121362673)
- 萬鉄五郎記念美術館 → [Q139766401](https://www.wikidata.org/wiki/Q139766401)
- 藍画廊 → no candidate
- 高崎市タワー美術館 → [Q123368034](https://www.wikidata.org/wiki/Q123368034)
- 黄金崎クリスタルパーク ガラスミュージアム → no candidate

## 17. Source A evaluation

**Source Aとして利用可能（人手確認前提）.** Item coverage is 155 / 178 (87.1%). Only 2 / 178 (1.1%) meet the current formal auto-match threshold, so Wikidata is strong for finding identity-and-reference candidates but is not sufficient as an unattended automatic master source. Field completeness is also materially lower for sparse properties.

## 18. Fields to complement with Source B

Priority should follow the observed Strict + Possible gaps:

- Opening schedule: missing 144 / 155
- Street address: missing 78 / 155
- Postal code: missing 47 / 155
- Aliases: missing 43 / 155
- Commons category: missing 19 / 155
- P18 image: missing 13 / 155
- Inception / opening year: missing 13 / 155
- Coordinates: missing 4 / 155
- Official URL: missing 1 / 155
- Japanese name: missing 0 / 155
- English name: missing 0 / 155
- Entity type: missing 0 / 155
- Country: missing 0 / 155
- Administrative area: missing 0 / 155

Likely complements are official venue websites, trusted public/municipal datasets, and a geocoding source. Any imported fact still needs provenance and human review appropriate to its use.

## 19. P18 candidates

- 岡山県立博物館: [Okayama prefectural museum01n3872.jpg](https://commons.wikimedia.org/wiki/File:Okayama_prefectural_museum01n3872.jpg) / [Q3247162](https://www.wikidata.org/wiki/Q3247162) / confidence 1.00
- 戸栗美術館: [Toguri Museum of Art 2010.jpg](https://commons.wikimedia.org/wiki/File:Toguri_Museum_of_Art_2010.jpg) / [Q11496415](https://www.wikidata.org/wiki/Q11496415) / confidence 1.00
- NTTインターコミュニケーション・センター [ICC]: [NTT ICC entrance.jpg](https://commons.wikimedia.org/wiki/File:NTT_ICC_entrance.jpg) / [Q3788869](https://www.wikidata.org/wiki/Q3788869) / confidence 0.79
- TOTOギャラリー・間: [TOTOギャラリー・間.jpg](https://commons.wikimedia.org/wiki/File:TOTO%E3%82%AE%E3%83%A3%E3%83%A9%E3%83%AA%E3%83%BC%E3%83%BB%E9%96%93.jpg) / [Q55526821](https://www.wikidata.org/wiki/Q55526821) / confidence 0.70
- アーティゾン美術館: [Bridgestone Museum.jpg](https://commons.wikimedia.org/wiki/File:Bridgestone_Museum.jpg) / [Q913808](https://www.wikidata.org/wiki/Q913808) / confidence 0.80
- いわき市立美術館: [Iwaki City Art Museum.jpg](https://commons.wikimedia.org/wiki/File:Iwaki_City_Art_Museum.jpg) / [Q11260168](https://www.wikidata.org/wiki/Q11260168) / confidence 0.80
- サンリツ服部美術館: [160603 Sunritz Hattori Museum of Art Suwa Nagano pref Japan01n.jpg](https://commons.wikimedia.org/wiki/File:160603_Sunritz_Hattori_Museum_of_Art_Suwa_Nagano_pref_Japan01n.jpg) / [Q11306065](https://www.wikidata.org/wiki/Q11306065) / confidence 0.80
- セゾン現代美術館: [220930 Sezon Museum of Modern Art Karuizawa Nagano pref Japan04s3.jpg](https://commons.wikimedia.org/wiki/File:220930_Sezon_Museum_of_Modern_Art_Karuizawa_Nagano_pref_Japan04s3.jpg) / [Q11314323](https://www.wikidata.org/wiki/Q11314323) / confidence 0.80
- ちひろ美術館・東京: [Chihiro museum tokyo entrance 2009.JPG](https://commons.wikimedia.org/wiki/File:Chihiro_museum_tokyo_entrance_2009.JPG) / [Q11271822](https://www.wikidata.org/wiki/Q11271822) / confidence 0.80
- パラミタミュージアム: [Paramita museum.jpg](https://commons.wikimedia.org/wiki/File:Paramita_museum.jpg) / [Q17221655](https://www.wikidata.org/wiki/Q17221655) / confidence 0.80
- ひろしま美術館: [Hiroshima Museum of Art.jpg](https://commons.wikimedia.org/wiki/File:Hiroshima_Museum_of_Art.jpg) / [Q63828](https://www.wikidata.org/wiki/Q63828) / confidence 0.80
- ボーダレス・アートミュージアムNO-MA: [Borderless Art Museum NO-MA 1.jpg](https://commons.wikimedia.org/wiki/File:Borderless_Art_Museum_NO-MA_1.jpg) / [Q11338923](https://www.wikidata.org/wiki/Q11338923) / confidence 0.80
- メナード美術館: [Menardartmuseum000.jpg](https://commons.wikimedia.org/wiki/File:Menardartmuseum000.jpg) / [Q1920251](https://www.wikidata.org/wiki/Q1920251) / confidence 0.80
- 三溪園: [Sankeien Rinshukaku and Teisha Bridge.jpg](https://commons.wikimedia.org/wiki/File:Sankeien_Rinshukaku_and_Teisha_Bridge.jpg) / [Q4249885](https://www.wikidata.org/wiki/Q4249885) / confidence 0.70
- 三菱一号館美術館: [Mitsubishi Ichigokan Museum.JPG](https://commons.wikimedia.org/wiki/File:Mitsubishi_Ichigokan_Museum.JPG) / [Q3815458](https://www.wikidata.org/wiki/Q3815458) / confidence 0.80
- 三重県立美術館: [140405 Mie Prefectural Art Museum Tsu Japan02s3.jpg](https://commons.wikimedia.org/wiki/File:140405_Mie_Prefectural_Art_Museum_Tsu_Japan02s3.jpg) / [Q11357837](https://www.wikidata.org/wiki/Q11357837) / confidence 0.80
- 上野の森美術館: [Ueno Royal Museum.JPG](https://commons.wikimedia.org/wiki/File:Ueno_Royal_Museum.JPG) / [Q11360245](https://www.wikidata.org/wiki/Q11360245) / confidence 0.80
- 世田谷文学館: [Setagaya bungakukan.JPG](https://commons.wikimedia.org/wiki/File:Setagaya_bungakukan.JPG) / [Q11362100](https://www.wikidata.org/wiki/Q11362100) / confidence 0.80
- 世田谷美術館: [Setagaya Art Museum.jpg](https://commons.wikimedia.org/wiki/File:Setagaya_Art_Museum.jpg) / [Q3892314](https://www.wikidata.org/wiki/Q3892314) / confidence 0.80
- 丹波市立植野記念美術館: [230502 Tamba Municipal Ueno Memorial Art Museum Tamba Hyogo pref Japan02s5.jpg](https://commons.wikimedia.org/wiki/File:230502_Tamba_Municipal_Ueno_Memorial_Art_Museum_Tamba_Hyogo_pref_Japan02s5.jpg) / [Q11368569](https://www.wikidata.org/wiki/Q11368569) / confidence 0.80
- 九州国立博物館: [Kyushu National Museum 九州国立博物館 01.jpg](https://commons.wikimedia.org/wiki/File:Kyushu_National_Museum_%E4%B9%9D%E5%B7%9E%E5%9B%BD%E7%AB%8B%E5%8D%9A%E7%89%A9%E9%A4%A8_01.jpg) / [Q148543](https://www.wikidata.org/wiki/Q148543) / confidence 0.80
- 京都国立博物館: [260214 Kyoto National Museum Kyoto Japan04bs4.jpg](https://commons.wikimedia.org/wiki/File:260214_Kyoto_National_Museum_Kyoto_Japan04bs4.jpg) / [Q147286](https://www.wikidata.org/wiki/Q147286) / confidence 0.80
- 京都国立近代美術館: [National Museum of Modern Art Kyoto 2010.jpg](https://commons.wikimedia.org/wiki/File:National_Museum_of_Modern_Art_Kyoto_2010.jpg) / [Q1055628](https://www.wikidata.org/wiki/Q1055628) / confidence 0.80
- 京都市京セラ美術館: [Kyoto Municipal Museum of Art 1933 ⅱ.jpg](https://commons.wikimedia.org/wiki/File:Kyoto_Municipal_Museum_of_Art_1933_%E2%85%B1.jpg) / [Q3330657](https://www.wikidata.org/wiki/Q3330657) / confidence 0.80
- 京都文化博物館: [Museum of Kyoto 20101204-002.jpg](https://commons.wikimedia.org/wiki/File:Museum_of_Kyoto_20101204-002.jpg) / [Q11375592](https://www.wikidata.org/wiki/Q11375592) / confidence 0.80
- 佐久市立近代美術館: [Saku Municipal Museum of Modern Art.jpg](https://commons.wikimedia.org/wiki/File:Saku_Municipal_Museum_of_Modern_Art.jpg) / [Q78314906](https://www.wikidata.org/wiki/Q78314906) / confidence 0.80
- 佐倉市立美術館: [Sakura City Museum of Art 2010.jpg](https://commons.wikimedia.org/wiki/File:Sakura_City_Museum_of_Art_2010.jpg) / [Q11382975](https://www.wikidata.org/wiki/Q11382975) / confidence 0.80
- 佐川美術館: [Sagawa art museum01s3200.jpg](https://commons.wikimedia.org/wiki/File:Sagawa_art_museum01s3200.jpg) / [Q7399081](https://www.wikidata.org/wiki/Q7399081) / confidence 0.80
- 佐野市立吉澤記念美術館: [Yoshizawa Memorial Museum of Art, Sano.JPG](https://commons.wikimedia.org/wiki/File:Yoshizawa_Memorial_Museum_of_Art%2C_Sano.JPG) / [Q11385006](https://www.wikidata.org/wiki/Q11385006) / confidence 0.80
- 佐野美術館: [Sano Art Museum.jpg](https://commons.wikimedia.org/wiki/File:Sano_Art_Museum.jpg) / [Q11385099](https://www.wikidata.org/wiki/Q11385099) / confidence 0.80
- 八戸市美術館: [Hachinohe Art Museum 2023.jpg](https://commons.wikimedia.org/wiki/File:Hachinohe_Art_Museum_2023.jpg) / [Q11391188](https://www.wikidata.org/wiki/Q11391188) / confidence 0.80
- 公益財団法人 平山郁夫シルクロード美術館: [平山郁夫シルクロード美術館20220618-P1380431.jpg](https://commons.wikimedia.org/wiki/File:%E5%B9%B3%E5%B1%B1%E9%83%81%E5%A4%AB%E3%82%B7%E3%83%AB%E3%82%AF%E3%83%AD%E3%83%BC%E3%83%89%E7%BE%8E%E8%A1%93%E9%A4%A820220618-P1380431.jpg) / [Q112090672](https://www.wikidata.org/wiki/Q112090672) / confidence 0.80
- 公益財団法人 河鍋暁斎記念美術館: [Kyosai 20070210.jpg](https://commons.wikimedia.org/wiki/File:Kyosai_20070210.jpg) / [Q11554289](https://www.wikidata.org/wiki/Q11554289) / confidence 0.80
- 兵庫陶芸美術館: [140510The Museum of Ceramic Art, Hyogo Sasayama Hyogo pref Japan01bs5.jpg](https://commons.wikimedia.org/wiki/File:140510The_Museum_of_Ceramic_Art%2C_Hyogo_Sasayama_Hyogo_pref_Japan01bs5.jpg) / [Q11393672](https://www.wikidata.org/wiki/Q11393672) / confidence 0.80
- 刈谷市美術館: [140112 Kariya City Art Museum Kariya Aich pref Japan01s3.jpg](https://commons.wikimedia.org/wiki/File:140112_Kariya_City_Art_Museum_Kariya_Aich_pref_Japan01s3.jpg) / [Q11396288](https://www.wikidata.org/wiki/Q11396288) / confidence 0.80
- 北海道立帯広美術館: [131012 Hokkaido Obihiro Museum of Art01s3.jpg](https://commons.wikimedia.org/wiki/File:131012_Hokkaido_Obihiro_Museum_of_Art01s3.jpg) / [Q11402964](https://www.wikidata.org/wiki/Q11402964) / confidence 0.80
- 北海道立近代美術館: [北海道立近代美術館.JPG](https://commons.wikimedia.org/wiki/File:%E5%8C%97%E6%B5%B7%E9%81%93%E7%AB%8B%E8%BF%91%E4%BB%A3%E7%BE%8E%E8%A1%93%E9%A4%A8.JPG) / [Q11402992](https://www.wikidata.org/wiki/Q11402992) / confidence 0.80
- 北海道立釧路芸術館: [Kushiro Art Museum Hokkaido Japan01s5.jpg](https://commons.wikimedia.org/wiki/File:Kushiro_Art_Museum_Hokkaido_Japan01s5.jpg) / [Q11402997](https://www.wikidata.org/wiki/Q11402997) / confidence 0.80
- 十和田市現代美術館: [Towada art center.JPG](https://commons.wikimedia.org/wiki/File:Towada_art_center.JPG) / [Q11404944](https://www.wikidata.org/wiki/Q11404944) / confidence 0.80
- 千葉市美術館: [KyuuKawasakiGinkouChibashiten.jpg](https://commons.wikimedia.org/wiki/File:KyuuKawasakiGinkouChibashiten.jpg) / [Q11406050](https://www.wikidata.org/wiki/Q11406050) / confidence 0.80
- 千葉県立美術館: [Chiba Prefectural Museum of Art 2010.jpg](https://commons.wikimedia.org/wiki/File:Chiba_Prefectural_Museum_of_Art_2010.jpg) / [Q11406332](https://www.wikidata.org/wiki/Q11406332) / confidence 0.80
- 原美術館ARC: [Haramuseumarc.JPG](https://commons.wikimedia.org/wiki/File:Haramuseumarc.JPG) / [Q60400398](https://www.wikidata.org/wiki/Q60400398) / confidence 0.80
- 台東区立朝倉彫塑館: [ASAKURA Museum of Sculpture 20051002.jpg](https://commons.wikimedia.org/wiki/File:ASAKURA_Museum_of_Sculpture_20051002.jpg) / [Q11517304](https://www.wikidata.org/wiki/Q11517304) / confidence 0.80
- 名古屋市美術館: [Nagoya City Art Museum01-r.jpg](https://commons.wikimedia.org/wiki/File:Nagoya_City_Art_Museum01-r.jpg) / [Q469573](https://www.wikidata.org/wiki/Q469573) / confidence 0.80
- 和歌山県立近代美術館: [121013 The museum of modern art, wakayama01s3.jpg](https://commons.wikimedia.org/wiki/File:121013_The_museum_of_modern_art%2C_wakayama01s3.jpg) / [Q11417477](https://www.wikidata.org/wiki/Q11417477) / confidence 0.80
- 国立工芸館: [National Crafts Museum in Kanazawa 20201116-001.jpg](https://commons.wikimedia.org/wiki/File:National_Crafts_Museum_in_Kanazawa_20201116-001.jpg) / [Q101001030](https://www.wikidata.org/wiki/Q101001030) / confidence 0.80
- 国立新美術館: [2018 National Art Center, Tokyo 2.jpg](https://commons.wikimedia.org/wiki/File:2018_National_Art_Center%2C_Tokyo_2.jpg) / [Q1362638](https://www.wikidata.org/wiki/Q1362638) / confidence 0.80
- 国立科学博物館: [NMNC01s3200.jpg](https://commons.wikimedia.org/wiki/File:NMNC01s3200.jpg) / [Q74940](https://www.wikidata.org/wiki/Q74940) / confidence 0.80
- 国立西洋美術館: [National museum of western art05s3200.jpg](https://commons.wikimedia.org/wiki/File:National_museum_of_western_art05s3200.jpg) / [Q1362629](https://www.wikidata.org/wiki/Q1362629) / confidence 0.80
- 埼玉県立近代美術館: [Museum of Modern Art Saitama 2010.jpg](https://commons.wikimedia.org/wiki/File:Museum_of_Modern_Art_Saitama_2010.jpg) / [Q11426772](https://www.wikidata.org/wiki/Q11426772) / confidence 0.80
- 大和文華館: [Yamato Bunkakan01s4592.jpg](https://commons.wikimedia.org/wiki/File:Yamato_Bunkakan01s4592.jpg) / [Q3329639](https://www.wikidata.org/wiki/Q3329639) / confidence 0.80
- 大阪中之島美術館: [Nakanoshima Museum of Art Osaka.jpg](https://commons.wikimedia.org/wiki/File:Nakanoshima_Museum_of_Art_Osaka.jpg) / [Q50375431](https://www.wikidata.org/wiki/Q50375431) / confidence 0.80
- 天理大学附属 天理参考館: [Tenri sanko-kan01s3200.jpg](https://commons.wikimedia.org/wiki/File:Tenri_sanko-kan01s3200.jpg) / [Q17229261](https://www.wikidata.org/wiki/Q17229261) / confidence 0.80
- 奈義町現代美術館: [Nagi MOCA.jpg](https://commons.wikimedia.org/wiki/File:Nagi_MOCA.jpg) / [Q15933226](https://www.wikidata.org/wiki/Q15933226) / confidence 0.80
- 奈良国立博物館: [140927 Nara National Museum Nara Japan03bs5.jpg](https://commons.wikimedia.org/wiki/File:140927_Nara_National_Museum_Nara_Japan03bs5.jpg) / [Q147312](https://www.wikidata.org/wiki/Q147312) / confidence 0.80
- 宇都宮美術館: [Utsunomiya museum.jpg](https://commons.wikimedia.org/wiki/File:Utsunomiya_museum.jpg) / [Q11449808](https://www.wikidata.org/wiki/Q11449808) / confidence 0.80
- 安曇野ちひろ美術館: [150922 Chihiro Art Museum Azumino Japan01s3.jpg](https://commons.wikimedia.org/wiki/File:150922_Chihiro_Art_Museum_Azumino_Japan01s3.jpg) / [Q11450770](https://www.wikidata.org/wiki/Q11450770) / confidence 0.80
- 宮崎県立美術館: [Miyazaki Prefectural Art Museum.jpg](https://commons.wikimedia.org/wiki/File:Miyazaki_Prefectural_Art_Museum.jpg) / [Q3298536](https://www.wikidata.org/wiki/Q3298536) / confidence 0.80
- 富山市佐藤記念美術館: [Sato Memorial Art Museum Toyama02st3200.jpg](https://commons.wikimedia.org/wiki/File:Sato_Memorial_Art_Museum_Toyama02st3200.jpg) / [Q11384443](https://www.wikidata.org/wiki/Q11384443) / confidence 0.80
- 富山市郷土博物館: [Toyama Municipal Folk Museum (mock keep tower of the Toyama Castle) 20180503.jpg](https://commons.wikimedia.org/wiki/File:Toyama_Municipal_Folk_Museum_(mock_keep_tower_of_the_Toyama_Castle)_20180503.jpg) / [Q11456417](https://www.wikidata.org/wiki/Q11456417) / confidence 0.80
- 富山県水墨美術館: [富山水墨美術館.jpg](https://commons.wikimedia.org/wiki/File:%E5%AF%8C%E5%B1%B1%E6%B0%B4%E5%A2%A8%E7%BE%8E%E8%A1%93%E9%A4%A8.jpg) / [Q11456481](https://www.wikidata.org/wiki/Q11456481) / confidence 0.80
- 富山県美術館: [Toyama Prefectural Museum of Art and Design seen from Fugan Unga Kansui Park 20180504.jpg](https://commons.wikimedia.org/wiki/File:Toyama_Prefectural_Museum_of_Art_and_Design_seen_from_Fugan_Unga_Kansui_Park_20180504.jpg) / [Q28689689](https://www.wikidata.org/wiki/Q28689689) / confidence 0.80
- 富弘美術館: [Tomihiro Art Museum 1.jpg](https://commons.wikimedia.org/wiki/File:Tomihiro_Art_Museum_1.jpg) / [Q11279084](https://www.wikidata.org/wiki/Q11279084) / confidence 0.80
- 小平市平櫛田中彫刻美術館: [Kodaira Hirakushi Denchu Art Museum front.jpg](https://commons.wikimedia.org/wiki/File:Kodaira_Hirakushi_Denchu_Art_Museum_front.jpg) / [Q11460717](https://www.wikidata.org/wiki/Q11460717) / confidence 0.80
- 尾道市立美術館: [Onomichi City Museum of Art.jpg](https://commons.wikimedia.org/wiki/File:Onomichi_City_Museum_of_Art.jpg) / [Q11465485](https://www.wikidata.org/wiki/Q11465485) / confidence 0.80
- 山口県立萩美術館・浦上記念館: [Hagi Uragami Mus.JPG](https://commons.wikimedia.org/wiki/File:Hagi_Uragami_Mus.JPG) / [Q11467091](https://www.wikidata.org/wiki/Q11467091) / confidence 0.80
- 山口蓬春記念館: [Research survey Hoshun Yamaguchi Memorial Hall 1953 1.jpg](https://commons.wikimedia.org/wiki/File:Research_survey_Hoshun_Yamaguchi_Memorial_Hall_1953_1.jpg) / [Q125763321](https://www.wikidata.org/wiki/Q125763321) / confidence 0.80
- 岐阜県現代陶芸美術館: [Museum of modern ceramic art gifu.jpg](https://commons.wikimedia.org/wiki/File:Museum_of_modern_ceramic_art_gifu.jpg) / [Q11471469](https://www.wikidata.org/wiki/Q11471469) / confidence 0.80
- 岡山県立美術館: [250505 Okayama Prefectural Museum of Art Okayama Japan01s3.jpg](https://commons.wikimedia.org/wiki/File:250505_Okayama_Prefectural_Museum_of_Art_Okayama_Japan01s3.jpg) / [Q4677150](https://www.wikidata.org/wiki/Q4677150) / confidence 0.80
- 岡崎市美術博物館(マインドスケープ・ミュージアム): [Okazaki Mindscape museum.JPG](https://commons.wikimedia.org/wiki/File:Okazaki_Mindscape_museum.JPG) / [Q11472922](https://www.wikidata.org/wiki/Q11472922) / confidence 0.73
- 岩手県立美術館: [Iwate Museum of Art.jpg](https://commons.wikimedia.org/wiki/File:Iwate_Museum_of_Art.jpg) / [Q3298581](https://www.wikidata.org/wiki/Q3298581) / confidence 0.80
- 島根県立石見美術館(島根県芸術文化センター「グラントワ」): [Grand Toit.jpg](https://commons.wikimedia.org/wiki/File:Grand_Toit.jpg) / [Q132396562](https://www.wikidata.org/wiki/Q132396562) / confidence 0.61
- 島根県立美術館: [Shimane Art Museum16s3.jpg](https://commons.wikimedia.org/wiki/File:Shimane_Art_Museum16s3.jpg) / [Q2655425](https://www.wikidata.org/wiki/Q2655425) / confidence 0.80
- 川崎市岡本太郎美術館: [Taro Okamoto Museum5.jpg](https://commons.wikimedia.org/wiki/File:Taro_Okamoto_Museum5.jpg) / [Q7686506](https://www.wikidata.org/wiki/Q7686506) / confidence 0.80
- 川崎市市民ミュージアム: [Kawasaki City Museum.jpg](https://commons.wikimedia.org/wiki/File:Kawasaki_City_Museum.jpg) / [Q11478412](https://www.wikidata.org/wiki/Q11478412) / confidence 0.80
- 市立小樽美術館: [Otaru City Museum Branch01s5.jpg](https://commons.wikimedia.org/wiki/File:Otaru_City_Museum_Branch01s5.jpg) / [Q11462169](https://www.wikidata.org/wiki/Q11462169) / confidence 0.80
- 平塚市美術館: [Hiratsuka MOA.JPG](https://commons.wikimedia.org/wiki/File:Hiratsuka_MOA.JPG) / [Q24807748](https://www.wikidata.org/wiki/Q24807748) / confidence 0.80
- 広島市現代美術館: [Hiroshima City Museum of Contemporary Art.jpg](https://commons.wikimedia.org/wiki/File:Hiroshima_City_Museum_of_Contemporary_Art.jpg) / [Q93425](https://www.wikidata.org/wiki/Q93425) / confidence 0.80
- 広島県立美術館: [Hiroshima Prefectural Art Museum 01.jpg](https://commons.wikimedia.org/wiki/File:Hiroshima_Prefectural_Art_Museum_01.jpg) / [Q3330773](https://www.wikidata.org/wiki/Q3330773) / confidence 0.80
- 府中市美術館: [Fuchu.no.mori.kouen 02.jpg](https://commons.wikimedia.org/wiki/File:Fuchu.no.mori.kouen_02.jpg) / [Q11486046](https://www.wikidata.org/wiki/Q11486046) / confidence 0.80
- 愛知県美術館: [Aichi Arts Center exterior ac.jpg](https://commons.wikimedia.org/wiki/File:Aichi_Arts_Center_exterior_ac.jpg) / [Q11256823](https://www.wikidata.org/wiki/Q11256823) / confidence 0.80
- 掛川市二の丸美術館: [Ninomaru Museum of Art.JPG](https://commons.wikimedia.org/wiki/File:Ninomaru_Museum_of_Art.JPG) / [Q104636664](https://www.wikidata.org/wiki/Q104636664) / confidence 0.80
- 敦井美術館: [Niigata,Hokuriku Building.JPG](https://commons.wikimedia.org/wiki/File:Niigata%2CHokuriku_Building.JPG) / [Q11499516](https://www.wikidata.org/wiki/Q11499516) / confidence 0.80
- 新潟県立万代島美術館: [Toki-Messe-01.jpg](https://commons.wikimedia.org/wiki/File:Toki-Messe-01.jpg) / [Q11503023](https://www.wikidata.org/wiki/Q11503023) / confidence 0.80
- 日本橋三越本店: [Mitsukoshi Nihonbashi main store 5.jpg](https://commons.wikimedia.org/wiki/File:Mitsukoshi_Nihonbashi_main_store_5.jpg) / [Q108899516](https://www.wikidata.org/wiki/Q108899516) / confidence 0.70
- 日本民藝館: [Nihon mingeikan meguro 2009.JPG](https://commons.wikimedia.org/wiki/File:Nihon_mingeikan_meguro_2009.JPG) / [Q3789149](https://www.wikidata.org/wiki/Q3789149) / confidence 0.80
- 日立市郷土博物館: [Hitachi City Folk Museum.jpg](https://commons.wikimedia.org/wiki/File:Hitachi_City_Folk_Museum.jpg) / [Q11510056](https://www.wikidata.org/wiki/Q11510056) / confidence 0.80
- 本郷新記念 札幌彫刻美術館: [Hongo Shin Memorial Museum of Sculpture, Sapporo - Main Hall.jpg](https://commons.wikimedia.org/wiki/File:Hongo_Shin_Memorial_Museum_of_Sculpture%2C_Sapporo_-_Main_Hall.jpg) / [Q68620047](https://www.wikidata.org/wiki/Q68620047) / confidence 0.80
- 札幌三越: [Sapporo Mitsukoshi Building 02.jpg](https://commons.wikimedia.org/wiki/File:Sapporo_Mitsukoshi_Building_02.jpg) / [Q11521139](https://www.wikidata.org/wiki/Q11521139) / confidence 0.70
- 札幌芸術の森美術館: [Sapporo art museum.jpg](https://commons.wikimedia.org/wiki/File:Sapporo_art_museum.jpg) / [Q11249478](https://www.wikidata.org/wiki/Q11249478) / confidence 0.80
- 東京国立博物館: [Tokyo National Museum, Honkan 2010.jpg](https://commons.wikimedia.org/wiki/File:Tokyo_National_Museum%2C_Honkan_2010.jpg) / [Q653433](https://www.wikidata.org/wiki/Q653433) / confidence 0.80
- 東京国立近代美術館: [National Museum of Modern Art Tokyo.jpg](https://commons.wikimedia.org/wiki/File:National_Museum_of_Modern_Art_Tokyo.jpg) / [Q1359908](https://www.wikidata.org/wiki/Q1359908) / confidence 0.80
- 東京藝術大学大学美術館: [University Art Museum, Tokyo University of the Arts 2009.jpg](https://commons.wikimedia.org/wiki/File:University_Art_Museum%2C_Tokyo_University_of_the_Arts_2009.jpg) / [Q11525123](https://www.wikidata.org/wiki/Q11525123) / confidence 0.80
- 東京都写真美術館: [Tokyo Metropolitan Museum of Photography entrance 2011 January.jpg](https://commons.wikimedia.org/wiki/File:Tokyo_Metropolitan_Museum_of_Photography_entrance_2011_January.jpg) / [Q862884](https://www.wikidata.org/wiki/Q862884) / confidence 0.80
- 東京都庭園美術館: [Tokyo Metropolitan Teien Art Museum.jpg](https://commons.wikimedia.org/wiki/File:Tokyo_Metropolitan_Teien_Art_Museum.jpg) / [Q743773](https://www.wikidata.org/wiki/Q743773) / confidence 0.80
- 東京都美術館: [Tokyo metropolitan art museum01 1920.jpg](https://commons.wikimedia.org/wiki/File:Tokyo_metropolitan_art_museum01_1920.jpg) / [Q864957](https://www.wikidata.org/wiki/Q864957) / confidence 0.80
- 松岡美術館: [Matsuoka Museum.jpg](https://commons.wikimedia.org/wiki/File:Matsuoka_Museum.jpg) / [Q11530056](https://www.wikidata.org/wiki/Q11530056) / confidence 0.80
- 板橋区立美術館: [Itabashi ku ritsu Bijutsukan Gaikan 20200321.jpg](https://commons.wikimedia.org/wiki/File:Itabashi_ku_ritsu_Bijutsukan_Gaikan_20200321.jpg) / [Q11532663](https://www.wikidata.org/wiki/Q11532663) / confidence 0.80
- 栃木県立美術館: [Tochigi Prefectural Museum of Fine Arts 2020 1.jpg](https://commons.wikimedia.org/wiki/File:Tochigi_Prefectural_Museum_of_Fine_Arts_2020_1.jpg) / [Q2655386](https://www.wikidata.org/wiki/Q2655386) / confidence 0.80
- 森美術館: [Mori Art Museum Entrance 2013.jpg](https://commons.wikimedia.org/wiki/File:Mori_Art_Museum_Entrance_2013.jpg) / [Q4410434](https://www.wikidata.org/wiki/Q4410434) / confidence 0.80
- 横浜美術館: [Yokohama Museum of Art 2009.jpg](https://commons.wikimedia.org/wiki/File:Yokohama_Museum_of_Art_2009.jpg) / [Q861588](https://www.wikidata.org/wiki/Q861588) / confidence 0.80
- 横須賀美術館: [Yokosuka Museum of Art 2009.jpg](https://commons.wikimedia.org/wiki/File:Yokosuka_Museum_of_Art_2009.jpg) / [Q11543551](https://www.wikidata.org/wiki/Q11543551) / confidence 0.80
- 江戸東京博物館: [Edo-Tokyo Museum.jpg](https://commons.wikimedia.org/wiki/File:Edo-Tokyo_Museum.jpg) / [Q1191042](https://www.wikidata.org/wiki/Q1191042) / confidence 0.80
- 池田20世紀美術館: [Research survey Ikeda Museum of 20th Century Art 1975 1.png](https://commons.wikimedia.org/wiki/File:Research_survey_Ikeda_Museum_of_20th_Century_Art_1975_1.png) / [Q11551651](https://www.wikidata.org/wiki/Q11551651) / confidence 0.80
- 河口湖美術館: [170504 Kawaguchiko Museum of Art Fujikawaguchiko Yamanashi pref Japan02s3.jpg](https://commons.wikimedia.org/wiki/File:170504_Kawaguchiko_Museum_of_Art_Fujikawaguchiko_Yamanashi_pref_Japan02s3.jpg) / [Q3329567](https://www.wikidata.org/wiki/Q3329567) / confidence 0.80
- 泉屋博古館: [SenokuHakkoKan.jpg](https://commons.wikimedia.org/wiki/File:SenokuHakkoKan.jpg) / [Q3478488](https://www.wikidata.org/wiki/Q3478488) / confidence 0.80
- 浜松市美術館: [Hamamatsu city museum.jpg](https://commons.wikimedia.org/wiki/File:Hamamatsu_city_museum.jpg) / [Q11557851](https://www.wikidata.org/wiki/Q11557851) / confidence 0.80
- 浜田市世界こども美術館: [Hamada children' museum of art.jpg](https://commons.wikimedia.org/wiki/File:Hamada_children'_museum_of_art.jpg) / [Q11557958](https://www.wikidata.org/wiki/Q11557958) / confidence 0.80
- 渋谷区立松濤美術館: [Shoto Museum of Art 2010.jpg](https://commons.wikimedia.org/wiki/File:Shoto_Museum_of_Art_2010.jpg) / [Q11561694](https://www.wikidata.org/wiki/Q11561694) / confidence 0.80
- 熊本県伝統工芸館: [Kumamoto Prefectural Traditional Crafts Center.jpg](https://commons.wikimedia.org/wiki/File:Kumamoto_Prefectural_Traditional_Crafts_Center.jpg) / [Q17228347](https://www.wikidata.org/wiki/Q17228347) / confidence 0.80
- 町立湯河原美術館: [Yugawara Art Museum.JPG](https://commons.wikimedia.org/wiki/File:Yugawara_Art_Museum.JPG) / [Q61058198](https://www.wikidata.org/wiki/Q61058198) / confidence 0.80
- 石川県能登島ガラス美術館: [Ishikawa Prefecture Notojima Glass Art Museum.jpg](https://commons.wikimedia.org/wiki/File:Ishikawa_Prefecture_Notojima_Glass_Art_Museum.jpg) / [Q11586039](https://www.wikidata.org/wiki/Q11586039) / confidence 0.80
- 神奈川県立近代美術館 葉山: [The Museum of Modern Art, Kamakura 2009.jpg](https://commons.wikimedia.org/wiki/File:The_Museum_of_Modern_Art%2C_Kamakura_2009.jpg) / [Q11589187](https://www.wikidata.org/wiki/Q11589187) / confidence 0.80
- 神奈川県立近代美術館 鎌倉別館: [The Museum of Modern Art, Kamakura 2009.jpg](https://commons.wikimedia.org/wiki/File:The_Museum_of_Modern_Art%2C_Kamakura_2009.jpg) / [Q11589187](https://www.wikidata.org/wiki/Q11589187) / confidence 0.79
- 神戸市立小磯記念美術館: [Kobe city koiso memorial museum of art02s3200.jpg](https://commons.wikimedia.org/wiki/File:Kobe_city_koiso_memorial_museum_of_art02s3200.jpg) / [Q11589991](https://www.wikidata.org/wiki/Q11589991) / confidence 0.80
- 福島県立美術館: [Fukushima Prefectural Museum of Art 202605.jpg](https://commons.wikimedia.org/wiki/File:Fukushima_Prefectural_Museum_of_Art_202605.jpg) / [Q5507735](https://www.wikidata.org/wiki/Q5507735) / confidence 0.80
- 稲沢市荻須記念美術館: [Ogisu bijutsukan.jpg](https://commons.wikimedia.org/wiki/File:Ogisu_bijutsukan.jpg) / [Q11596708](https://www.wikidata.org/wiki/Q11596708) / confidence 0.80
- 笠間日動美術館: [Kasama Nichido Museum Main Building.jpg](https://commons.wikimedia.org/wiki/File:Kasama_Nichido_Museum_Main_Building.jpg) / [Q11599987](https://www.wikidata.org/wiki/Q11599987) / confidence 0.80
- 米子市美術館: [Yonago City Museum of Art02nt3200.jpg](https://commons.wikimedia.org/wiki/File:Yonago_City_Museum_of_Art02nt3200.jpg) / [Q6355904](https://www.wikidata.org/wiki/Q6355904) / confidence 0.80
- 練馬区立美術館: [Nerima art museum.JPG](https://commons.wikimedia.org/wiki/File:Nerima_art_museum.JPG) / [Q11608069](https://www.wikidata.org/wiki/Q11608069) / confidence 0.80
- 美濃加茂市民ミュージアム: [Minokamo culture forest.jpg](https://commons.wikimedia.org/wiki/File:Minokamo_culture_forest.jpg) / [Q48749054](https://www.wikidata.org/wiki/Q48749054) / confidence 0.80
- 群馬県立近代美術館: [The Museum of Modern Art, Gunma.JPG](https://commons.wikimedia.org/wiki/File:The_Museum_of_Modern_Art%2C_Gunma.JPG) / [Q11609688](https://www.wikidata.org/wiki/Q11609688) / confidence 0.80
- 群馬県立館林美術館: [Gunma Museum of Art, Tatebayashi 1.jpg](https://commons.wikimedia.org/wiki/File:Gunma_Museum_of_Art%2C_Tatebayashi_1.jpg) / [Q521611](https://www.wikidata.org/wiki/Q521611) / confidence 0.80
- 芦屋市立美術博物館: [Ashiya City Museum of Art & History01s3200.jpg](https://commons.wikimedia.org/wiki/File:Ashiya_City_Museum_of_Art_%26_History01s3200.jpg) / [Q11614836](https://www.wikidata.org/wiki/Q11614836) / confidence 0.80
- 茨城県近代美術館: [Museum of Modern Art Ibaraki.JPG](https://commons.wikimedia.org/wiki/File:Museum_of_Modern_Art_Ibaraki.JPG) / [Q11617518](https://www.wikidata.org/wiki/Q11617518) / confidence 0.80
- 茨城県陶芸美術館: [Ibaraki Ceramic Art Museum.JPG](https://commons.wikimedia.org/wiki/File:Ibaraki_Ceramic_Art_Museum.JPG) / [Q132183583](https://www.wikidata.org/wiki/Q132183583) / confidence 0.80
- 西宮市大谷記念美術館: [230825 Otani Memorial Art Museum Nishinomiya City Hyogo pref Japan07s3.jpg](https://commons.wikimedia.org/wiki/File:230825_Otani_Memorial_Art_Museum_Nishinomiya_City_Hyogo_pref_Japan07s3.jpg) / [Q11627626](https://www.wikidata.org/wiki/Q11627626) / confidence 0.80
- 諏訪市美術館: [130607 Suwa City Museum of Art Suwa Japan01s3.jpg](https://commons.wikimedia.org/wiki/File:130607_Suwa_City_Museum_of_Art_Suwa_Japan01s3.jpg) / [Q109370433](https://www.wikidata.org/wiki/Q109370433) / confidence 0.80
- 豊田市美術館: [Toyota Municipal Museum of Art, Kozakahon-machi Toyota 2012.JPG](https://commons.wikimedia.org/wiki/File:Toyota_Municipal_Museum_of_Art%2C_Kozakahon-machi_Toyota_2012.JPG) / [Q4461630](https://www.wikidata.org/wiki/Q4461630) / confidence 0.80
- 那珂川町馬頭広重美術館: [Bato Hiroshige Museum 2009.jpg](https://commons.wikimedia.org/wiki/File:Bato_Hiroshige_Museum_2009.jpg) / [Q42704985](https://www.wikidata.org/wiki/Q42704985) / confidence 0.80
- 金沢21世紀美術館: [21st Century Museum of Contemporary Art, Kanazawa011.jpg](https://commons.wikimedia.org/wiki/File:21st_Century_Museum_of_Contemporary_Art%2C_Kanazawa011.jpg) / [Q3242206](https://www.wikidata.org/wiki/Q3242206) / confidence 0.80
- 長野県立美術館: [Nagano Prefectural Art Museum 2021-12 1.jpg](https://commons.wikimedia.org/wiki/File:Nagano_Prefectural_Art_Museum_2021-12_1.jpg) / [Q110245475](https://www.wikidata.org/wiki/Q110245475) / confidence 0.80
- 青森公立大学 国際芸術センター青森: [国際芸術センター青森 ACAC - panoramio.jpg](https://commons.wikimedia.org/wiki/File:%E5%9B%BD%E9%9A%9B%E8%8A%B8%E8%A1%93%E3%82%BB%E3%83%B3%E3%82%BF%E3%83%BC%E9%9D%92%E6%A3%AE_ACAC_-_panoramio.jpg) / [Q124982324](https://www.wikidata.org/wiki/Q124982324) / confidence 0.80
- 青森県立美術館: [140913 Aomori Museum of Art Japan02bs3.jpg](https://commons.wikimedia.org/wiki/File:140913_Aomori_Museum_of_Art_Japan02bs3.jpg) / [Q11662266](https://www.wikidata.org/wiki/Q11662266) / confidence 0.80
- 静岡市立芹沢銈介美術館: [Shizuoka City Serizawa Keisuke Art Museum front gate.JPG](https://commons.wikimedia.org/wiki/File:Shizuoka_City_Serizawa_Keisuke_Art_Museum_front_gate.JPG) / [Q78120016](https://www.wikidata.org/wiki/Q78120016) / confidence 0.80
- 静岡市美術館: [Shizuoka City Museum-1.jpg](https://commons.wikimedia.org/wiki/File:Shizuoka_City_Museum-1.jpg) / [Q121503263](https://www.wikidata.org/wiki/Q121503263) / confidence 0.80
- 静岡県立美術館: [静岡県立美術館-15.JPG](https://commons.wikimedia.org/wiki/File:%E9%9D%99%E5%B2%A1%E7%9C%8C%E7%AB%8B%E7%BE%8E%E8%A1%93%E9%A4%A8-15.JPG) / [Q11663204](https://www.wikidata.org/wiki/Q11663204) / confidence 0.80
- 高崎市美術館: [Takasaki Museum of Art.jpg](https://commons.wikimedia.org/wiki/File:Takasaki_Museum_of_Art.jpg) / [Q11669765](https://www.wikidata.org/wiki/Q11669765) / confidence 0.80
- 高松市美術館: [Takamatsu City Museum of Art Building 1.jpg](https://commons.wikimedia.org/wiki/File:Takamatsu_City_Museum_of_Art_Building_1.jpg) / [Q11670406](https://www.wikidata.org/wiki/Q11670406) / confidence 0.80
- 高知県立美術館: [The Museum of Art Kochi08s3872.jpg](https://commons.wikimedia.org/wiki/File:The_Museum_of_Art_Kochi08s3872.jpg) / [Q2496483](https://www.wikidata.org/wiki/Q2496483) / confidence 0.80
- 鳥取県立博物館: [Tottori prefectural museum01 1920.jpg](https://commons.wikimedia.org/wiki/File:Tottori_prefectural_museum01_1920.jpg) / [Q4707652](https://www.wikidata.org/wiki/Q4707652) / confidence 0.80
- 鹿児島県霧島アートの森: [Kirishima Open-Air Museum 2008.jpg](https://commons.wikimedia.org/wiki/File:Kirishima_Open-Air_Museum_2008.jpg) / [Q10855706](https://www.wikidata.org/wiki/Q10855706) / confidence 0.80

## 20. Errors

- None
- Final local DB verification (SELECT only): `venues=178`, `venue_external_match_candidates=120`, `source_image_candidates=65`, `media_assets=1`.
- Latest `venues.updated_at` was `2026-09-04T16:36:08.361211+00:00`, before this test began. No Venue row was updated by the test.

## Sources and property interpretation

- [Wikidata API](https://www.wikidata.org/w/api.php)
- [coordinate location (P625)](https://www.wikidata.org/wiki/Property:P625)
- [image (P18)](https://www.wikidata.org/wiki/Property:P18)
- [official website (P856)](https://www.wikidata.org/wiki/Property:P856)
- [street address (P6375)](https://www.wikidata.org/wiki/Property:P6375)
- [postal code (P281)](https://www.wikidata.org/wiki/Property:P281)
- [Commons category (P373)](https://www.wikidata.org/wiki/Property:P373)
- [open days (P3025)](https://www.wikidata.org/wiki/Property:P3025) with [opening time (P8626)](https://www.wikidata.org/wiki/Property:P8626) and [closing time (P8627)](https://www.wikidata.org/wiki/Property:P8627)
- [inception (P571)](https://www.wikidata.org/wiki/Property:P571) and [date of official opening (P1619)](https://www.wikidata.org/wiki/Property:P1619)
