# Artist Priority Tier / Image Coverage Test

Date: 2026-09-06
Status: Draft / LOCAL investigation
Scope: Exhibition-driven sample only. Global Artist Full Sync was not run.

## Executive summary

This document began as a pre-implementation simulation. The current LOCAL database now calculates Artist tiers from canonical `exhibition_artists` relations. The stored Art Commons sample exposes no dedicated Artist field, so the initial relation population used only existing Artist names explicitly present in current/upcoming exhibition titles. It does not infer artists from generic group-exhibition titles.

- Exhibition schedule population: Tier A 236 exhibitions, Tier B 0, older/out-of-window 5.
- Sample: 45 explicit artist names from Tier A exhibition titles.
- Safe exact Wikidata resolution: 35 matched (77.8%), 8 ambiguous, 2 not found.
- The 35 matched artists were imported to LOCAL as Draft records only.
- The matched mentions are now persisted as 35 `exhibition_artists` relations covering 34 unique Artists; Tier is calculated from those UUID relations.
- A repeat run produced New 0 / Updated 0 / Candidate Added 0 / Errors 0.

## Artist role in Muuzee

Artist is the canonical identity that connects Exhibitions and Works and later supports Favorite, Collection, discovery, and recommendation. Initial product value depends on a reliable Name, Name EN, Nationality, and human-usable Primary Image—not on maximizing biography or style prose.

## Tier simulation rules

| Tier | Simulation rule | Current result |
| --- | --- | ---: |
| A | Artist explicitly appears in an exhibition ending on or after 2026-09-06 | 45-name sample; 35 safely resolved |
| B | Artist explicitly appears only in an exhibition ending from 2025-09-06 through 2026-09-05 | 0 in current LOCAL schedule |
| C | Existing Artist Master record outside the A/B sample | 25 pre-existing Wikidata sample records |

Tier A wins if an artist qualifies for both A and B. The table above records the original simulation cohort; the authoritative current LOCAL result is below.

## Implemented LOCAL result

The table below is the latest post-backfill snapshot. The prior values supplied at task start (72.1% average and 30 missing Primary) had already changed through manual LOCAL work before this run; the immediately measured baseline was 73.5% and 28 missing.

After safe matching, relation creation, Tier refresh, and explicit Wikipedia Infobox enrichment:

| Tier | Artist count | Average Core Quality | 4 / 4 | Incomplete | Name missing | Name EN missing | Nationality missing | Primary Image missing | Primary Rights unconfirmed |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| A | 34 | 88.2% | 19 | 15 | 0 | 0 | 8 | 8 | 26 |
| B | 0 | — | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| C | 26 | 73.1% | 2 | 24 | 0 | 0 | 4 | 24 | 2 |

Overall 60 Artist coverage after this LOCAL backfill includes Primary Image 28。The last measured non-image coverage was Name 60、Name EN 60、Nationality 48、Aliases 35、Birth 50、Death 30、Birth Place 44。Wikipedia improved Nationality from 41 / 60 (68.3%) to 48 / 60 (80.0%) without guessing from birthplace. The remaining sections retain the original 35-record simulation evidence and should be read as historical pre-relation measurements.

### P18 Primary backfill measurement

| Metric | Before | After |
| --- | ---: | ---: |
| Primary Image | 6 / 34 (17.6%) | 26 / 34 (76.5%) |
| Primary Missing | 28 | 8 |
| Average Core Quality | 73.5% | 88.2% |
| 4 / 4 | 3 | 19 |
| 3 / 4 | 26 | 14 |
| 2 / 4 | 5 | 1 |
| Nationality Missing | 8 | 8 |
| Rights unconfirmed Primary | 6 | 26 |
| Rights approved Primary | 0 | 0 |

Dry Run classification was Primary exists 6、Primary missing + usable P18 20、P18 missing + fallback Candidate 0、no usable Candidate 8. Candidate counts were one=4、two=1、three=21、zero=8. The shared Venue / Artist policy then set 20 P18 candidates as Primary and zero fallback candidates. It did not overwrite an existing Primary or approve rights.

The remaining Tier A Artist image research queue is:

| Artist | Wikidata QID | Nationality | Exhibition relations |
| --- | --- | --- | ---: |
| はしもとみお | Q27917904 | JP | 1 |
| 一原有徳 | Q11352469 | Missing | 1 |
| 佐藤時啓 | Q6352389 | JP | 1 |
| 國松明日香 | Q11422730 | JP | 1 |
| 小野竹喬 | Q11464231 | JP | 1 |
| 木田金次郎 | Q11519304 | JP | 2 |
| 毛利悠子 | Q30924607 | JP | 1 |
| 清川泰次 | Q94533385 | JP | 1 |

## Sample and identity resolution

| Requested exhibition artist | Result | Wikidata QID / note |
| --- | --- | --- |
| 向井潤吉 | Matched | Q11415898 |
| 宮本三郎 | Ambiguous | Q11454791 / Q24049273 / Q24875382 |
| 清川泰次 | Matched | Q94533385 |
| 日比野克彦 | Matched | Q11509594 |
| ロン・ミュエク | Matched | Q510808 |
| ダニエル・ビュレン | Matched | Q593621 |
| 平櫛田中 | Matched | Q11483145 |
| 佐藤時啓 | Matched | Q6352389 |
| 椿昇 | Matched | Q11541022 |
| 國松明日香 | Matched | Q11422730 |
| パブロ・ピカソ | Ambiguous | Q5593 / Q7121722 |
| 杉本博司 | Matched | Q919236 |
| 平山郁夫 | Matched | Q3124280 |
| 清水裕貴 | Not found | No exact label/alias match |
| 一原有徳 | Matched | Q11352469 |
| エットレ・ソットサス | Matched | Q78885 |
| 瀧口修造 | Matched | Q1786653 |
| カイ・フランク | Matched | Q909809 |
| 隈研吾 | Matched | Q725462 |
| やなせたかし | Matched | Q2496707 |
| 千住博 | Matched | Q5771042 |
| 木田金次郎 | Matched | Q11519304 |
| カール・ヴァルザー | Matched | Q1733293 |
| テオ・ヤンセン | Ambiguous | Q540764 / Q705169 / Q11319140 |
| はしもとみお | Matched | Q27917904 |
| ルーシー・リー | Ambiguous | Q214391 / Q56467483 |
| 髙島野十郎 | Not found | Exact orthography did not resolve safely |
| レンブラント | Ambiguous | Q5598 / Q154347 |
| サルバドール・ダリ | Matched | Q5577 |
| 小村雪岱 | Matched | Q11461005 |
| 落合陽一 | Matched | Q16265041 |
| 細江英公 | Matched | Q2564831 |
| 土門拳 | Matched | Q3195028 |
| アンドリュー・ワイエス | Matched | Q316325 |
| 岡本太郎 | Matched | Q983942 |
| 草間彌生 | Matched | Q231121 |
| 毛利悠子 | Matched | Q30924607 |
| メル・チン | Matched | Q6810674 |
| 李禹煥 | Matched | Q399775 |
| フェルメール | Ambiguous | Q41264 / Q918252 / Q19912259 |
| 森万里子 | Ambiguous | Q438703 / Q6147220 |
| ターナー | Ambiguous | Seven exact label/alias candidates |
| 小野竹喬 | Matched | Q11464231 |
| 荻須高徳 | Matched | Q3514177 |
| いわさきちひろ | Matched | Q5097289 |

Ambiguous and not-found entries were not imported. This is intentional: name-only resolution is not sufficient to choose among multiple identities.

## Core 4 coverage

Core 4 means Name, Name EN, Nationality, and a Primary Image.

| Metric | Tier A matched sample (n=35) | Tier C comparison (n=25) |
| --- | ---: | ---: |
| Name | 100% | 100% |
| Name EN | 100% | 100% |
| Nationality | 57% | 84% |
| P18 available | 74% | 20% |
| Any image candidate | 74% | 20% |
| Primary Image | 11% | 4% |
| Core 4 complete | 1 / 35 (2.9%) | 1 / 25 (4.0%) |
| Core fields complete if a reviewed candidate is later selected | 15 / 35 (42.9%) | Not evaluated |

Primary coverage is intentionally lower than candidate coverage. Multiple candidates remain for human selection, and no image rights status was automatically approved.

### Tier quality simulation

| Tier | Artist count | Average Core Quality | 4 / 4 | 3 / 4 | 2 / 4 | Name missing | Name EN missing | Nationality missing | Primary Image missing |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| A | 35 safely matched from a 45-name sample | 2.69 / 4 | 1 | 22 | 12 | 0 | 0 | 15 | 31 |
| B | 0 | N/A | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| C | 25 pre-existing sample records | 2.88 / 4 | 1 | 20 | 4 | 0 | 0 | 4 | 24 |

The C average is higher only because the earlier QID-order sample happened to have better Nationality coverage. It does not make C more valuable than A. Relevance and quality must be tracked separately.

## Supplemental field coverage

| Field | Tier A matched sample | Tier C comparison |
| --- | ---: | ---: |
| Aliases | 71% | 40% |
| Birth date/year | 100% | 60% |
| Death date/year | 63% | 32% |
| Birthplace | 89% | 52% |
| Occupation | 100% | 100% |
| Field of work | 23% | 0% |
| Movement | 20% | 0% |
| Wikipedia article | 100% | 20% |

## Image discovery comparison

Artist image discovery now uses this order:

1. Wikidata P18
2. Wikipedia article lead image (`pageimages`)
3. Wikimedia Commons category fallback

Candidates are deduplicated by normalized Commons file title and limited to three per artist.

| Route set | Artists with at least one usable candidate | Coverage |
| --- | ---: | ---: |
| P18 only | 26 / 35 | 74.3% |
| P18 + Wikipedia lead image | 26 / 35 | 74.3% |
| P18 + Wikipedia lead + Commons category | 26 / 35 | 74.3% |

In this sample, Wikipedia and Commons added alternative candidates but did not rescue an artist with no P18 candidate. The fallback gain was therefore 0 percentage points. This is a useful negative result: broad Commons crawling is not justified as an automatic global sync based on the present sample.

Candidate subject classification (69 candidates):

| Type | Candidates | Artists represented |
| --- | ---: | ---: |
| portrait_photo | 3 | 3 |
| artist_at_work | 0 | 0 |
| self_portrait | 0 | 0 |
| portrait_artwork | 2 | 2 |
| other | 64 | 26 |

The high `other` count reflects conservative filename-only classification. It must not be interpreted as automatic suitability. Artwork-only, exhibition poster, book cover, signature, logo, map, diagram, and SVG candidates are excluded. Existing Primary images are preserved.

## Image gaps and review workload

- Tier A matched sample with no candidate: 9 artists.
- Tier A matched sample with candidates: 26 artists / 69 candidates.
- Tier A Primary missing: 31 artists.
- Tier B: no current LOCAL records, so no immediate review workload.
- Rights unconfirmed: 69 candidates across 26 artists; 4 automatically selected single-candidate Primary assets remain `needs_review`.
- Rights approved automatically: 0.
- Existing automatically selected single candidates remain `needs_review`; image selection and rights approval are separate judgments.
- Wikimedia metadata for Eikō Hosoe currently points to a filename containing “Toshihiro Hosoe”. This must be visually checked before use and illustrates why P18 is a candidate source, not proof of correctness.

## Source stability and repeatability

| Run | New | Unchanged | Candidate added | Errors |
| --- | ---: | ---: | ---: | ---: |
| Targeted import | 35 | 0 | 69 | 0 |
| Repeat by the same QIDs | 0 | 35 | 0 | 0 |

No duplicate Artist or image candidate was created on repeat. Image discovery is re-run even when the Wikidata source checksum is unchanged, so a prior no-image result does not permanently block later discovery.

## Operational recommendation

Do not run Global Artist Full Sync now. The production-oriented order should be:

1. Populate and maintain `exhibition_artists` from trustworthy exhibition sources or editorial input.
2. Process Tier A first, then Tier B.
3. Resolve names with a unique exact label/alias match; send ambiguous identities to human review.
4. Re-run image discovery after QID assignment.
5. Review candidate identity and visual suitability, then select Primary.
6. Review rights separately; never infer approval from candidate discovery.
7. Defer Tier C unless it becomes related to a Muuzee exhibition, work, collection, or editorial need.

The current bottleneck is not Wikidata throughput. It is the missing Exhibition–Artist relation/source field, followed by Nationality and Primary Image review. Global import would increase low-priority review debt without improving the current user-facing exhibition catalog.

### Recommended tier targets

- Tier A: 4 / 4 is a sound publication-readiness target, but 100% is not achievable from Wikidata alone. In the measured sample, only 2.9% reached 4 / 4 without further review.
- Tier B: use the same 4 / 4 goal when the Artist is surfaced to users, but process after A. Current LOCAL data has no B cohort.
- Tier C: keep automatically sourced facts and provenance, but do not spend initial human image/nationality review effort.

Additional image sources should not be added globally yet. First fix Exhibition–Artist relations and measure the nine Tier A sample gaps individually. Add Official Artist / Gallery / Museum sources only for high-priority unresolved gaps with traceable rights, rather than broad automatic crawling.
