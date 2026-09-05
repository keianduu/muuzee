# Exhibition Venue → Canonical Venue Master

Status: Draft / LOCAL only (2026-09-05)

## Purpose

Art Commons importで作成されたExhibition由来Venueを、Source Aを含む既存Venue Masterと照合し、安全な根拠がある場合だけCanonical Venueへ統合する。名称だけの一致では自動統合しない。

この機能は、同じVenueを表す複数のMuuzee UUIDが実在するときだけ使う。既存の1 Venueに単一のWikidata Source CandidateがあるだけならMergeせず、そのUUIDへSource Aを直接適用する。Source Application PolicyのField Review廃止とは別の安全境界である。

## Matching signals

- Wikidata QID
- Official Website domain
- `name` / `name_en` / `aliases` の正規化一致・類似度
- 住所
- 座標距離
- 都道府県 / 市区町村
- Venue type

判定は`HIGH` / `POSSIBLE` / `NONE`。自動統合可能な`HIGH`は、QID一致、Official domain＋名称一致、名称＋近接座標＋地域一致、名称＋住所一致のいずれかを必要とする。異なるQIDや双方のPrimary画像がある場合はHuman Reviewへ送る。

Dry Run:

```bash
node scripts/dry_run_venue_canonical_merge.mjs
```

出力はGit管理外の`tmp/exhibition-venue-canonical-merge-dry-run.csv`。`--persist`を付けた場合だけ、`HIGH` / `POSSIBLE`をReview queueへ保存する。

## Review workflow

Admin `/admin/venues` の`Canonical候補を確認`から、両Venueの名称、別名、住所、座標、URL、QID、画像、Relation、Manual / Official provenance数を比較する。

- 同じVenueとして統合
- 別Venueとして扱う
- 判断保留

## Merge safety

`merge_venue_into_canonical`は単一DB transaction内で実行される。

- Venue rowはhard deleteせず、`merged_into_venue_id`を持つsoft redirectにする
- `exhibition_occurrences`、`collection_holdings`、`media_assets`、`source_records`、`venue_field_sources`、`venue_tags`をCanonicalへ付け替える
- `official_venue_crawl_results`は同じrunとの衝突がないものだけ付け替え、衝突履歴はredirect元に残す
- `venue_external_match_candidates`とreview candidateは監査証跡としてredirect元に残す
- 完全一致するOccurrence / Holdingは、値を補完してから重複Relationを1件へ集約する
- Field値は `Manual > Official Website > Trusted API > Wikidata` の優先順で選び、空欄はSource値で補完する
- 低優先度値や空欄でManual値を上書きせず、全Provenance履歴を保持する
- 双方にPrimary画像がある場合、または異なるWikidata QIDがある場合は統合を拒否する
- `venue_merge_audit`に統合前後snapshot、根拠、Relation件数を保存する
- 同じ統合の再実行は`already_merged`となり冪等

## Venue foreign keys (2026-09-05 LOCAL)

| Table | Column | ON DELETE |
|---|---|---|
| collection_holdings | venue_id | RESTRICT |
| exhibition_occurrences | venue_id | RESTRICT |
| media_assets | venue_id | CASCADE |
| official_venue_crawl_results | venue_id | CASCADE |
| source_records | venue_id | SET NULL |
| venue_external_match_candidates | venue_id | CASCADE |
| venue_field_sources | venue_id | CASCADE |
| venue_tags | venue_id | CASCADE |

## Current LOCAL result

2026-09-05のDry Runでは、全Venue 4,980件、Exhibition由来Venue 178件を比較した。`HIGH 0 / POSSIBLE 0 / NONE 178`。Source A内に対象178件の候補QIDと一致するCanonical Venueが存在しなかったため、5件、20件、全HIGHの自動統合はいずれも0件である。

これはMatcherの失敗ではなく、現時点のSource A coverage gapを示す。次の候補はSource Aの対象範囲拡張、またはOfficial Website / Trusted API由来の識別子追加後に再Dry Runする。

## Validation

```bash
npm test -- --run src/lib/venue-canonicalization/matcher.test.ts
docker exec -i supabase_db_muuzee psql -v ON_ERROR_STOP=1 -U postgres -d postgres < supabase/tests/venue_canonical_merge.sql
node scripts/simulate_venue_priority_tiers.mjs --as-of=2026-09-05
```
