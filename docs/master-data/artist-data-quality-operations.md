# Artist Data Quality Operations

Status: Draft
Environment: LOCAL implementation

## Product role and Core Quality

Artist Masterは、知っているArtistを見つけ、保存し、そのArtistの展覧会へつなぐCanonical identityである。MVP Core Qualityは次の4項目だけで算出する。

- Name
- Name EN
- Nationality
- Primary Image

Description、Style Summary、Field of Work、Movement、BiographyはSupplementalであり、Core Qualityへ含めない。

## Priority Tier

ArtistはVenueと同じ`auto_priority_tier`、`manual_priority_tier`、`effective_priority_tier = manual ?? auto`の枠組みを使う。

| Tier | Rule |
| --- | --- |
| A | 開催中または今後のMuuzee対象ExhibitionにRelationがある |
| B | 過去12か月以内の対象ExhibitionにRelationがあり、Aではない |
| C | Artist Masterには存在するがA/Bではない |

Tier再計算は`exhibition_artists.artist_id`を参照し、画面表示時の文字列Matchは行わない。A/B重複時はA。将来Workや重要Venue由来の昇格条件を追加できるが、現在はExhibition Relationだけを使う。

## Image and rights

ArtistとVenueは同じImage ComponentとPrimary判定を使う。

- Primaryなし + usableなWikidata P18: Candidate総数が複数でもP18を自動Primary化
- Primaryなし + P18なし + usable Candidateが1件だけ: 自動Primary化
- Primaryなし + P18なし + Candidate複数: 人が「この画像を設定」
- 既存Primaryあり: 自動上書きしない
- inactive、Candidate reviewが`rejected`、またはRightsが`rejected`: Primary設定不可
- Primary設定とRights Approvedは別状態

一覧Statusは`画像なし`、`Primaryあり / Rights未確認`、`Primaryあり / Rights確認済み`、`複数Candidate / 選択必要`でVenueと共通。Candidateには取得経路、Author、Credit、Reported License、License URL、Source URL、Rights Statusと共通の日本語License解釈を表示する。

Image DiscoveryはWikidata P18 → Wikipedia Lead Image → Wikimedia Commons Categoryの順で最大3件。QID確定後は再探索できるが、既存Candidateを重複登録せずPrimaryを上書きしない。作品、Poster、Book cover、Signatureのみ、Logo、Map、DiagramはArtist本人画像候補として除外する。

P18はWikidata Entityの`Preferred Representative Image`として扱うが、本人同定、見た目の妥当性、再利用可否を保証するものではない。P18のPrimary化後もDiscovery Source、QIDを持つSource Record、Commons File Title、Author、Credit、Reported License、License URL、Usage Terms、Source URL、Rights Statusを保持し、Rightsを自動Approvedにしない。

## LOCAL P18 backfill (2026-09-06)

- Tier A Artist 34件をDry Runし、既存Primary 6、Primaryなし+usable P18 20、P18なし+fallback Candidate 0、Candidateなし8に分類した。
- Candidate数は1件4 Artist、2件1 Artist、3件21 Artist、0件8 Artist。
- P18 20件をPrimaryへ設定。その他Candidateの自動Primaryは0件。既存Primaryは上書きせず、全20件のRightsは`needs_review`を維持した。
- Tier A Primary Coverageは6/34（17.6%）から26/34（76.5%）、平均Core Qualityは73.5%から88.2%、4/4は3件から19件へ改善した。
- 画像Candidateなし8件はOfficial Artist / Gallery / Museum / Foundation等のTargeted research対象として残る。

## Enrichment and relation flow

```text
Exhibition source record
  → structured Artist field if present
  → otherwise explicit known Artist name in title only
  → preserve source_artist_name in exhibition_artist_mentions
  → exact name / name_en / alias match
  → unique candidate: exhibition_artists relation
  → multiple candidates: human selection
  → structured mention with no candidate: targeted Wikidata lookup
```

Wikidataの不足は、Wikipedia Infobox、APJ DAJ、Getty ULANを必要なArtistだけTargetedに参照して補完する。NationalityはAuthority Sourceに明示された単一値だけを適用し、日本語名、APJ収録、Birth Place、活動国から推測しない。APJはIdentityとAuthority IDの照合に使い、APJ画面にNationalityが明記されない場合は国籍Sourceとして扱わない。Gettyの複数Nationality descriptorはRaw Source Recordに保持し、単一のcanonical country codeへ潰さない。

## Tier A targeted enrichment (2026-09-06)

- LOCAL Tier A 34件の不足対象だけを処理し、APJ / Gettyの全件同期は行っていない。
- Nationality Missing 8件を調査し、APJ exact 5件、Getty exact 6件。Gettyに単一Nationalityが明記された5件（カイ・フランク、一原有徳、向井潤吉、平山郁夫、平櫛田中）を適用した。
- エットレ・ソットサスはGettyにAustrian / Italianの複数値があるためRaw Sourceだけを保存し、canonicalは空欄を維持した。いわさきちひろ、やなせたかしはAPJでIdentityを一意確認したが、明示Nationalityを得られなかったため空欄を維持した。
- 画像不足8件について、本人公式1件、美術館公式2件の候補を追加した。いずれも利用条件の明記を確認できないため`needs_review`であり、Rights Approvedにはしていない。
- 単一Candidateの共通Policyにより3件をPrimaryへ設定。既存Primaryは上書きしていない。
- Tier A Primary Coverageは26/34（76.5%）から29/34（85.3%）、Nationality Coverageは26/34（76.5%）から31/34（91.2%）、4/4は19件から26件へ改善した。
- Tier A平均Core Qualityは120/136（88.2%）から128/136（94.1%）へ改善した。

Targeted処理はAdminの`Tier A Targeted補完`からDry Run後に実行する。処理対象QIDは今回の不足対象に限定し、Source Record、External ID、Field Provenance、Image Candidateへ冪等保存する。

## Environment policy

- LOCAL: 判断用Sample、Dry Run、idempotency検証だけ
- STG: 将来のExhibition / Frontend QAに必要なArtistだけ
- Production: Exhibition / Workから必要になったArtistだけをTargeted Import
- Global Artist Full Sync / Cron: 必要性と運用承認が得られるまで禁止
