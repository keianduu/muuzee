# Venue Data Quality Operations

Status: Draft. 初期MVPのVenue Master整備を、全4,980件ではなくPriority Tier A〜Cへ集中するための運用仕様。

## Priority Tier and targets

`venues.auto_priority_tier`を共通計算、`manual_priority_tier`を明示的な上書き、`effective_priority_tier`を実運用値とする。TierはPublicationと独立し、AでもDraftは非公開のまま。

| Tier | Draft target | Operation |
| --- | ---: | --- |
| A | 100% | 高品質化を最優先 |
| B | 83% | 高品質化を優先 |
| C | 67% | Exhibition掲載に必要な品質を優先 |
| D | 50% | 原則追加Enrichmentなし |
| E | 17% | 原則追加Enrichmentなし |

Admin一覧とData Quality Queueは実効Tier A→B→C→D→E→未分類でSortする。同Tier内はTarget未達を先にし、Opening Hours不足→Closed Days不足→Access不足→Description不足→Address不足→Completeness低→名称→UUIDの順で安定Sortする。Tier FilterとDrawerの`selected`は同じURL Query上で共存する。

## Source B targeting

住所欠損はSource Bより前に、確定Wikidata QIDからWikipedia / MediaWiki APIを使用して補完する。順序は`Wikidata → Wikipedia → Official Website → AI / Manual`。Wikipediaは明示的なInfobox住所のみを単一値として自動適用し、Conflictは上書きしない。AddressはVenue MVPのCompleteness対象、Postal CodeはOptional。

既存のOfficial Website Crawler → AI用CSV → Structured CSV → Preview → Confirmを再利用する。TargetはA、A+B、A〜C、現在Filter、Checkbox選択。優先順はTier A→B→C、同Tier内でTarget未達→Opening Hours不足→Closed Days不足→Access不足→Description不足→Address不足。郵便番号はOptional。公式URLなしは`officialUrl Missing`として集計し、Crawler対象にしない。

LOCALでは5→20→必要時50件までのSampleに留める。Productionでのみ、明示的な運用判断のもとA〜C全件を処理する。Source Cは未実装。

## Image targeting

A〜Cかつ有効Image CandidateなしだけをTargeted Image Search対象とする。Wikidata P18 / Wikimedia Commonsを先に試し、取得不能時は既存の施設画像調査Promptを使う。

Venue / Artist共通Policyとして、既存Primaryを最優先で維持する。PrimaryなしでusableなWikidata P18があれば、Candidate総数が複数でもP18をPreferred Representative Imageとして自動Primary化する。P18がなくusable Candidateが1件だけならそのCandidateを自動Primary化し、複数件なら人が選択する。inactive、Candidate review rejected、Rights rejectedは除外する。画像選択とRights判断は分離し、Discovery Source / Commons File Title / Author / Credit / Reported License / License URL / Usage Terms / Source URL / Rights Statusを保持し、Rightsを自動Approvedにはしない。

## Human work queue

AdminのData Quality QueueはA Target未達→B Target未達→C Target未達、同Tier内はCompleteness低い順。Dashboardは不足Field、Candidate、Primary、Rights未確認、Approved Imageを実DBから集計する。複数QIDは既存Source Candidate Selectionで人が処理する。

## LOCAL verification on 2026-09-05

- A/B/C: 46 / 19 / 108（合計173）
- 既存の単一Candidate 64件をDry Run後にPrimary化。Rightsは変更なし。
- Targeted Image Searchは5件だけ実行し、5件でCandidate取得。全173件検索は未実行。
- Source BはOpening Hours不足を対象に5件だけPreview Crawl。Success 1 / Partial 4 / Master Confirm 0。
- Source B後のMaster値はPreviewのみのため未変更。Primary反映後のA〜C平均Completenessは55%。

## LOCAL verification on 2026-09-06

- Wikipedia住所Fallbackの残り対象50件を全件Dry Runし、安全判定後44件をLOCALへ適用した。Conflict / Errorは0。
- A〜C住所Coverage: 88 / 173（50.9%）→132 / 173（76.3%）。住所欠損は41件。
- Tier別住所Coverage: A 42 / 46（91.3%）、B 13 / 19（68.4%）、C 77 / 108（71.3%）。
- Completeness: A 平均72.0% / 中央83% / Target未達46、B 58.8% / 67% / 未達13、C 58.3% / 67% / 未達33。A〜C全体平均61.9%、中央値67%。
- Official Website Crawler実行可能（Official URLあり）: 134件→134件。Opening Hours / Closed Days / Accessが全173件で不足するため、住所適用だけではdistinct対象総数は減らない。
- Address Missing理由かつOfficial URLあり: 47件→6件（-41件）。
- Opening Hours / Closed Days / Access不足は各173件、Description不足41件、Official URL不足39件。
- Wikipedia住所Provenanceは68 Venue / current 68行。再処理3件はすべて`unchanged`。
- STG / Production / Cron / Official Website全件Crawlは未実施。
- 共通P18-first PolicyのDry RunでA〜CのPrimaryなし+usable P18は8件、single fallbackは0件。8件をLOCAL Primaryへ設定し、既存Primary 79件を維持、複数Primary違反0、Rights自動Approved 0を確認した。D/Eの3,164件は低優先度の大量処理になるため未適用。
