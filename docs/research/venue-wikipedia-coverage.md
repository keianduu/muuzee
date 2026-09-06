# Venue Wikipedia / MediaWiki API Coverage Test

> Implementation follow-up: このCoverage Testを根拠に、2026-09-06にWikipedia Address FallbackをLOCALへDraft実装した。正式仕様は[`docs/integrations/wikipedia-venue-enrichment.md`](../integrations/wikipedia-venue-enrichment.md)を参照。Coverage Test自体のread-only結果は以下に保持する。

## Summary

- Test date: 2026-09-05T16:11:23.688Z
- Sample: 20 venues (Tier A: 7, B: 7, C: 6)
- Selection: Wikidata matched, QID present, and address or postal code missing
- Wikipedia page identification: 19 / 20 (95.0%)
- Conflicts: 5
- Safety: LOCAL DB was read with SELECT only. No DB, Storage, migration, crawler, STG, or Production write was performed.

## Method

1. Resolve each existing QID with Wikidata `wbgetentities` and read `jawiki`, falling back to `enwiki` only when Japanese is absent.
2. Retrieve the identified article through the documented MediaWiki Action API `action=query&prop=revisions|coordinates|info` with `rvslots=main&rvprop=content`.
3. Prefer explicit Infobox/template fields. Unclear free prose is not inferred, and missing values remain null.
4. Compare facts read directly from Wikidata claims with Wikipedia facts. Conflicting non-empty values are reported, not resolved.

## Coverage Before / After

| Field | Wikidata only | Wikidata + Wikipedia | Gain |
| --- | ---: | ---: | ---: |
| Address | 1 / 20 (5.0%) | 19 / 20 (95.0%) | +18 |
| Postal Code | 11 / 20 (55.0%) | 11 / 20 (55.0%) | +0 |
| Coordinates | 19 / 20 (95.0%) | 19 / 20 (95.0%) | +0 |
| Official URL | 20 / 20 (100.0%) | 20 / 20 (100.0%) | +0 |
| Opening Year | 18 / 20 (90.0%) | 19 / 20 (95.0%) | +1 |

## Per Venue

| Venue | Tier | QID | Wikipedia | New fields from Wikipedia | Conflicts |
| --- | --- | --- | --- | --- | --- |
| いわき市立美術館 | A | Q11260168 | いわき市立美術館 | address | — |
| みどり市立富弘美術館 | A | Q11279084 | みどり市立富弘美術館 | address | coordinates |
| 丹波市立植野記念美術館 | A | Q11368569 | 丹波市立植野記念美術館 | address | — |
| 京都国立近代美術館 | A | Q1055628 | 京都国立近代美術館 | address | officialUrl |
| 佐久市立近代美術館 | A | Q78314906 | 佐久市立近代美術館 | address | officialUrl |
| 北海道立帯広美術館 | A | Q11402964 | 北海道立帯広美術館 | address | — |
| 北海道立近代美術館 | A | Q11402992 | 北海道立近代美術館 | address | — |
| サンリツ服部美術館 | B | Q11306065 | サンリツ服部美術館 | address | — |
| ちひろ美術館・東京 | B | Q11271822 | ちひろ美術館・東京 | address | — |
| 上野の森美術館 | B | Q11360245 | 上野の森美術館 | address | — |
| 宇都宮美術館 | B | Q11449808 | 宇都宮美術館 | address, openingYear | — |
| 安曇野ちひろ美術館 | B | Q11450770 | 安曇野ちひろ美術館 | address | — |
| 府中市美術館 | B | Q11486046 | 府中市美術館 | address | — |
| 東京都美術館 | B | Q864957 | 東京都美術館 | address | — |
| TOTOギャラリー・間 | C | Q55526821 | TOTOギャラリー・間 | address | coordinates |
| おぶせミュージアム | C | Q105334745 | おぶせミュージアム・中島千波館 | address | — |
| しもだて美術館 | C | Q139498029 | — | — | — |
| フジヤマミュージアム | C | Q109324144 | フジヤマミュージアム | — | — |
| 三菱一号館美術館 | C | Q3815458 | 三菱一号館美術館 | address | — |
| 世田谷美術館 | C | Q3892314 | 世田谷美術館 | address | officialUrl |

## Conflicts

- みどり市立富弘美術館 / Coordinates: Wikidata=`36.556666666666665, 139.3713888888889` / Wikipedia=`36.55355556, 139.37305556`
- 京都国立近代美術館 / Official URL: Wikidata=`http://www.momak.go.jp/English/index.html` / Wikipedia=`http://www.momak.go.jp/`
- 佐久市立近代美術館 / Official URL: Wikidata=`https://www.city.saku.nagano.jp/museum/` / Wikipedia=`https://www.city.saku.nagano.jp/museum/index.html`
- TOTOギャラリー・間 / Coordinates: Wikidata=`35.66747222, 139.72672222` / Wikipedia=`35.67, 139.73`
- 世田谷美術館 / Official URL: Wikidata=`http://www.setagayaartmuseum.or.jp/index_e.html` / Wikipedia=`https://www.setagayaartmuseum.or.jp/`

## Wikipediaでも補完できなかったVenue

- しもだて美術館: QID has no ja/en Wikipedia sitelink
- フジヤマミュージアム: recognizable infobox/template not found; no new requested field in explicit Infobox/page metadata

## 取得失敗理由

- しもだて美術館: QID has no ja/en Wikipedia sitelink
- フジヤマミュージアム: recognizable infobox/template not found; no new requested field in explicit Infobox/page metadata


## Sourceとしての評価

Wikipedia is suitable as a **read-only fallback candidate source** when the venue already has a Wikidata QID and a corresponding sitelink. It should not replace Official Website as the higher-priority source. Structured Infobox coverage is useful, but template naming and field formatting vary, and article facts can be older than official information. Conflicts must remain unresolved until a higher-priority source or human judgment is available.

Recommended acquisition order: Wikidata → Wikipedia / MediaWiki API → Official Website → AI / Manual. Conflict priority: Manual > Official Website > Wikipedia > Wikidata.

## A〜Cへ適用した場合の改善見込み

Within this deliberately missing-field-heavy sample, Wikipedia recovered 94.7% of Wikidata address gaps and 0.0% of postal-code gaps. Applying the fallback to all A〜C venues with a confirmed QID should improve those fields, but this 20-row stratified sample is too small for an exact total. Use these observed recovery rates as a directional estimate only, and retain field provenance as `source_type=wikipedia` with the article URL if implementation is later approved.

## LOCAL implementation result — 2026-09-06

Coverage Test後、A〜Cの住所欠損かつ確定QIDあり75件を段階処理した。最初の25件では24件、残り50件では安全判定後44件、合計68件の住所をWikipediaからLOCAL Venue Masterへ適用した。

| Metric | Before Wikipedia apply | After all LOCAL batches | Change |
| --- | ---: | ---: | ---: |
| A〜C Address filled | 64 / 173 (37.0%) | 132 / 173 (76.3%) | +68 |
| A Address filled | 17 / 46 (37.0%) | 42 / 46 (91.3%) | +25 |
| B Address filled | 4 / 19 (21.1%) | 13 / 19 (68.4%) | +9 |
| C Address filled | 43 / 108 (39.8%) | 77 / 108 (71.3%) | +34 |

残り50件の結果はArticle Found 47、Address Found / Applied 44、No Article 3、Address Not Found 3、Conflict 0、Error 0。東京藝術大学大学美術館は複数拠点Entityのため自動適用対象外とした。実適用済み3件の再処理はすべて`unchanged`で、current Wikipedia address provenanceは68 Venue / 68行だった。

今回の残りバッチにより、Address Missing理由かつOfficial URLありのSource B対象は47件から6件へ減った。一方、Opening Hours / Closed Days / Accessは全A〜C Venueで不足しているため、Official Website Crawlerのdistinct対象は134件から変わらない。

## Official API references

- [MediaWiki Action API](https://www.mediawiki.org/wiki/API:Main_page)
- [Revisions API](https://www.mediawiki.org/wiki/API:Revisions)
- [Parsing wikitext](https://www.mediawiki.org/wiki/API:Parsing_wikitext)
