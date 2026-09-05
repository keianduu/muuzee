# Venue Priority Tier Simulation

Date: 2026-09-05  
Environment: LOCAL / Read only  
Venue rows: 4980

## 1. Purpose

全Venueを同じ品質へ揃えるのではなく、Art relevanceとOperational priorityを分離し、A〜E Tierごとの整備範囲を検討するための読み取り専用Simulation。DBへの書き込み、Crawler、Sync、公開状態変更は行っていない。

## 2. Current Data

- Venue: 4980
- Exhibition relationあり: 178
- 過去12か月に重なる展示あり: 152
- 開催中: 152
- 今後予定あり: 41
- 基準日: 2026-09-05

## 3. Art Relevance Logic

| Candidate | Venue | Share | Rule |
| --- | --- | --- | --- |
| art | 1210 | 24.3% | Wikidata art class、明示的な美術館・Gallery表記、またはMuuzee Exhibition relation |
| possible | 18 | 0.4% | Art evidenceとnon-art evidenceの競合、または弱い文化・Art表記 |
| non_art | 493 | 9.9% | Science、Railway、Natural History等の明確な非Art分類 |
| unverified | 3259 | 65.4% | 現在のLOCALデータに明示的Art evidenceなし |

名称は補助Evidenceに限定し、曖昧な名称だけでartへ強制分類していない。これは正式分類ではなく候補である。

## 4. Exhibition Activity

- `total_exhibition_count`: 全期間のdistinct Exhibition数
- `past_12m_exhibition_count`: 2026-09-05までの12か月間に会期が重なる展示。開催中を含む
- `active_now_exhibition_count`: 基準日に開催中
- `upcoming_exhibition_count`: 開始日が基準日より後
- Date欠損の推測は行っていない（現在のOccurrence 241件はstart/endとも入力済み）。

## 5. Exhibition Distribution

| Exhibition count | All time | Past 12m | Upcoming |
| --- | --- | --- | --- |
| 10+ | 0 (0.0%) | 0 (0.0%) | 0 (0.0%) |
| 5–9 | 3 (0.1%) | 0 (0.0%) | 1 (0.0%) |
| 3–4 | 7 (0.1%) | 3 (0.1%) | 2 (0.0%) |
| 2 | 29 (0.6%) | 17 (0.3%) | 10 (0.2%) |
| 1 | 139 (2.8%) | 132 (2.7%) | 28 (0.6%) |
| 0 | 4802 (96.4%) | 4828 (96.9%) | 4939 (99.2%) |

## 6. Tier Logic

- A: art + 公立表記 + 明示的Art Museum名 + recent/upcoming 1件以上または全期間3件以上
- B: artかつScenario thresholdを満たす
- C: artで過去12か月・開催中・今後のいずれかに1件以上
- D: artだがrecent/upcomingなし
- E: possible / non_art / unverified

## 7. Scenario Comparison

| Scenario | B threshold | A | B | C | D | E |
| --- | --- | --- | --- | --- | --- | --- |
| S1 | Past 12m ≥3 OR Upcoming ≥2 | 46 | 10 | 117 | 1037 | 3770 |
| S2 | Past 12m ≥2 OR Upcoming ≥2 | 46 | 19 | 108 | 1037 | 3770 |
| S3 | Past 12m ≥5 OR Upcoming ≥3 | 46 | 1 | 126 | 1037 | 3770 |

推奨は**S2（Past 12m ≥2 OR Upcoming ≥2）**。現在のExhibition coverageが178 Venueに限られるため、S3では主要な継続開催Venueを落としやすく、S1よりも初期B候補を少し広く保てる。

## 8. A Manual Review candidates

AUTO A: 46件。Manual Review: 140件。

| Venue | Type | All | Past 12m | Upcoming | Current tier | Reason |
| --- | --- | --- | --- | --- | --- | --- |
| 安曇野ちひろ美術館 | museum | 6 | 3 | 3 | B | High Exhibition activity |
| 松岡美術館 | museum | 5 | 3 | 2 | B | High Exhibition activity |
| ちひろ美術館・東京 | museum | 4 | 2 | 2 | B | High Exhibition activity |
| 東京都美術館 | museum | 4 | 2 | 2 | B | High Exhibition activity |
| ラッズギャラリー | other | 3 | 1 | 2 | B | High Exhibition activity |
| 宇都宮美術館 | museum | 3 | 1 | 2 | B | High Exhibition activity |
| 刈谷市美術館 | other | 2 | 0 | 2 | B | High Exhibition activity |
| 上野の森美術館 | museum | 2 | 0 | 2 | B | High Exhibition activity |
| 武蔵野美術大学 美術館 | other | 2 | 0 | 2 | B | High Exhibition activity |
| 森美術館 | gallery | 2 | 1 | 1 | C | User-named landmark candidate |
| 鳥取県立博物館 | other | 1 | 0 | 1 | C | Public art venue |
| 横浜美術館 | museum | 3 | 3 | 0 | B | High Exhibition activity |
| アーティゾン美術館 | museum | 2 | 2 | 0 | B | High Exhibition activity |
| サンリツ服部美術館 | museum | 2 | 2 | 0 | B | High Exhibition activity |
| 京都国立博物館 | other | 2 | 2 | 0 | B | Public art venue |
| 三溪園 | other | 2 | 2 | 0 | B | High Exhibition activity |
| 世田谷文学館 | museum | 2 | 2 | 0 | B | High Exhibition activity |
| 大阪中之島美術館 | museum | 2 | 2 | 0 | B | High Exhibition activity |
| 土門拳写真美術館 | other | 2 | 2 | 0 | B | High Exhibition activity |
| 府中市美術館 | museum | 2 | 2 | 0 | B | High Exhibition activity |
| 豊田市美術館 | museum | 2 | 2 | 0 | B | High Exhibition activity |
| 芦屋市立美術博物館 | museum | 1 | 1 | 0 | C | Public art venue |
| 岡山県立博物館 | museum | 1 | 1 | 0 | C | Public art venue |
| 九州国立博物館 | other | 1 | 1 | 0 | C | Public art venue |
| 国立工芸館 | museum | 1 | 1 | 0 | C | Public art venue |
| 東京国立博物館 | museum | 1 | 1 | 0 | C | Public art venue |
| 奈良国立博物館 | other | 1 | 1 | 0 | C | Public art venue |
| 北海道立釧路芸術館 | museum | 1 | 1 | 0 | C | Public art venue |
| 東京都江戸東京博物館 | museum | 4 | 0 | 0 | D | High Exhibition activity |
| さいたま市立漫画会館 | museum | 0 | 0 | 0 | D | Public art venue |
| 愛知県立芸術大学芸術資料館 | museum | 0 | 0 | 0 | D | Public art venue |
| 芦北町立星野富弘美術館 | museum | 0 | 0 | 0 | D | Public art venue |
| 安芸市立書道美術館 | museum | 0 | 0 | 0 | D | Public art venue |
| 伊丹市立美術館 | museum | 0 | 0 | 0 | D | Public art venue |
| 井原市立平櫛田中美術館 | museum | 0 | 0 | 0 | D | Public art venue |
| 益田市立雪舟の郷記念館 | museum | 0 | 0 | 0 | D | Public art venue |
| 岡山市立オリエント美術館 | museum | 0 | 0 | 0 | D | Public art venue |
| 沖縄県立博物館・美術館 | museum | 0 | 0 | 0 | D | Public art venue |
| 下関市立美術館 | museum | 0 | 0 | 0 | D | Public art venue |
| 滑川市立博物館 | museum | 0 | 0 | 0 | D | Public art venue |
| 関市立篠田桃紅美術空間 | museum | 0 | 0 | 0 | D | Public art venue |
| 久万高原町立久万美術館 | museum | 0 | 0 | 0 | D | Public art venue |
| 京都市立芸術大学ギャラリー | museum | 0 | 0 | 0 | D | Public art venue |
| 京都市立芸術大学芸術資料館 | museum | 0 | 0 | 0 | D | Public art venue |
| 京都府立陶板名画の庭 | museum | 0 | 0 | 0 | D | Public art venue |
| 京都府立堂本印象美術館 | museum | 0 | 0 | 0 | D | Public art venue |
| 金沢市立中村記念美術館 | museum | 0 | 0 | 0 | D | Public art venue |
| 釧路市立美術館 | museum | 0 | 0 | 0 | D | Public art venue |
| 熊本県立美術館 | museum | 0 | 0 | 0 | D | Public art venue |
| 熊本県立美術館分館 | museum | 0 | 0 | 0 | D | Public art venue |

候補が50件を超える場合、全件はCSVの`manual_a_review_candidate`で確認する。

## 9. Tier Counts

| Tier | Venue | Share |
| --- | --- | --- |
| A | 46 | 0.9% |
| B | 19 | 0.4% |
| C | 108 | 2.2% |
| D | 1037 | 20.8% |
| E | 3770 | 75.7% |

## 10. Tier Completeness

現行Adminと同じ6項目（Name / Address / Coordinates / Description / Primary image / Opening Hours）で計算。

| Tier | Venue | Average | Median | Target | Target未達 |
| --- | --- | --- | --- | --- | --- |
| A | 46 | 52.3% | 50.0% | 100% | 46 |
| B | 19 | 43.2% | 50.0% | 83% | 19 |
| C | 108 | 47.6% | 50.0% | 67% | 65 |
| D | 1037 | 38.7% | 33.0% | 50% | 585 |
| E | 3770 | 38.8% | 33.0% | 17% | 0 |

## 11. Missing Fields

| Tier | Name EN | Address | Postal | Coordinates | Official URL | Image candidate | Approved image | Description | Hours | Closed | Access |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| A | 4 | 29 | 17 | 6 | 4 | 27 | 46 | 5 | 46 | 46 | 46 |
| B | 6 | 15 | 8 | 6 | 6 | 10 | 19 | 6 | 19 | 19 | 19 |
| C | 29 | 65 | 56 | 31 | 29 | 71 | 108 | 30 | 108 | 108 | 108 |
| D | 77 | 547 | 585 | 152 | 195 | 366 | 1037 | 1036 | 1037 | 1037 | 1037 |
| E | 421 | 1822 | 2704 | 691 | 630 | 1272 | 3769 | 3767 | 3770 | 3770 | 3770 |

## 12. Human Workload

- A〜C合計: 173 Venue
- Tier target未達: 130 Venue
- Official URLがあり、直ちにSource B Crawl可能: 134 Venue
- Official URL不足でSource B Crawl前にURL調査が必要: 39 Venue
- Description不足: 41 Venue
- Approved image不足: 173 Venue
- 初期に人間が触る可能性がある最大集合はTarget未達の130 Venue。Fieldごとの件数は重複するため合算しない。
- A Manual Review候補140件のうちA〜Cとの重複は28件。A〜C整備とA候補判定を合わせたdistinct Venueは285件。

## 13. Recommended Threshold

S2を初期値とする。BはPast 12m 2件以上またはUpcoming 2件以上。Aは自動判定を狭く維持し、Manual Review候補を人間がA/Bへ確定する。

## 14. Recommended Completeness Target

現行Completenessは6項目のため17ポイント刻み。90%や80%を設定しても実質100%・83%になる。

- A: 100%
- B: 83%（6項目中5）
- C: 67%（6項目中4）
- D: 50%（6項目中3）
- E: 17%（Name最低限。正式対象外は追加整備しない）

Closed DaysとAccess等は現行Completeness外なので、Tier別必須Field policyを別途持つ必要がある。

## 15. Exhibition-driven Tier Update

- D + recent/upcoming Exhibition → 最低Cへ自動候補昇格
- E / possible + Exhibition → art relevance reviewを作成し、確認後は最低C候補
- E / non_art + Exhibition →自動でartへ変更せず、scope conflictとしてReview

## 16. Manual Override Design

`auto_priority_tier`、`manual_priority_tier`、`effective_priority_tier = manual_priority_tier ?? auto_priority_tier`は妥当。加えて`tier_reason`と`tier_calculated_at`を保持する。Art relevanceにもauto/manual/effectiveを分けると、分類根拠と運用優先度を混同しない。

## 17. Known Limitations

- Exhibition relationは178 Venueのみで、全Venueの活動実態ではなく現在のMuuzee取込coverageを示す。
- Exhibition relationありの178 Venueはすべて`venue_type=other`で、Source A由来の詳細Fieldがほぼ未統合。Tier判定には使えるが、Completenessの低さには取込経路の分断が大きく影響する。
- 直近データは開催中・今後の会期に偏っており、Past 12mの分布は実際の年間開催頻度を完全には表さない。
- Wikidataのgeneric museum rootはArt Museumを保証しない。Subclass labelの完全な階層解決は今回行っていない。
- 明示的なArt/Non-art文字列を高精度優先で使っており、名称・descriptionが曖昧なVenueはunverifiedへ寄せた。
- 公的区分、施設規模、有名度、来館者数の正規データがないためAUTO Aは意図的に狭い。
- Image candidateは利用可能性ではなく候補の存在、Approved imageはPrimaryかつrights approvedを数えた。
- TierとArt relevanceはSimulationでありDBへ保存していない。
