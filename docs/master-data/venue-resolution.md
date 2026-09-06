# Shared Venue Resolver / DB-side Matching

Status: Draft

## Purpose

Venue Master全件をApplicationへ読み込んで照合しない。PostgRESTの既定返却上限に左右されないよう、Work Candidate、Exhibition Daily Sync、Targeted Master Resolution、CSV relation importは共通Resolverを通してDB側の索引検索を行う。

```text
Importer / Resolver caller
  → Shared Venue Resolver
  → venue_search_keys exact indexed lookup
  → resolved / ambiguous / unresolved
  → canonical venue_id or candidate IDs + diagnostics
```

## Matching contract

優先順は既存Relation保護、Source external ID mapping、`name`、`name_en`、`alias`、`official_url`。住所は同順位の完全一致候補を1件に絞れる場合だけ補助証拠として使う。Unicode NFKC、trim、大小文字、連続空白だけを正規化し、記号削除や部分一致、fuzzy matchはcanonical relationの自動確定に使わない。

同順位候補が複数なら`ambiguous`、0件なら`unresolved`とし、候補ID、method、reasonを保持する。`A / B`のように複数会場らしいSource文字列は分割を推測せず`multiple_venue_values`として未解決にする。既存Relationは上書きしない。

## Storage and update

`venue_search_keys`はactiveかつ未mergeのVenueについて`name / name_en / alias / official_url`の検索キーを保持する。Venueの該当Field、active状態、merge先が変わるとDB triggerが同じTransactionで検索キーを再構築する。`normalized_value`先頭の複合IndexをDB検索に使う。

`work_import_candidates`は`matched_venue_id`に加え、`venue_candidate_ids / venue_match_method / venue_match_reason`を保持する。再照合はCandidateをWork Masterへ自動採用せず、Venue relation候補だけを更新する。

## Operations and safety

- Shared Resolverは全Venue取得を行わず、入力をdeduplicateし100検索キー単位でqueryする。
- Daily Syncはscan batch内のVenue名をまとめて解決する。
- Targeted workerはShared Resolverを先に実行し、未解決時だけ外部Targeted Searchへ進む。
- Exact matchが複数ならtop-1を選ばない。
- Publication、Primary Image、Rights、Manual overrideは変更しない。
- STG / Production適用、Cron、DeployはこのLOCAL v1の範囲外。
