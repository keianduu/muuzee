# Exhibition Daily Sync / Master Resolution v1

Status: Draft

## Purpose and boundary

Exhibitionは日付とSource更新に追従するDaily Sync対象である。Venue / Artist / Workの低頻度Full Enrichmentとは別Jobとして扱う。LOCAL AdminのHTTP実行は検証用であり、Productionでは同じservice runnerをbackground worker / schedulerから呼ぶ。

```text
Japan Search / Art Commons scan
  → normalize
  → external ID + checksum diff
  → changed fields only apply
  → canonical Venue / Artist resolution
  → unresolved targeted-enrichment handoff
  → Venue / Artist Tier refresh
```

既定windowはAsia/Tokyoの今日から過去45日〜1年後。最近終了した展示を含めて遅延訂正を拾う。失敗または部分scanでSource recordやRelationをstaleにしない。終了展示は削除せず、`upcoming / ongoing / ended`を開催日から動的に判定する。これは`publication_status`とは独立する。

## Scan / Diff / Apply

- Scanは既存Scroll API、`f-db=exhib`、年boundary、詳細取得後のexact date overlapを再利用する。
- `source_records(data_source_id, external_id)`がIdentity。`raw_payload`、`checksum`、`last_seen_at`、`last_changed_at`を保持する。
- 同一checksumはMaster fieldを更新しないが、Relation resolutionと`last_seen_at`は再確認できる。
- Changedは`Manual > Official Website > Trusted API / Art Commons > Wikipedia > Wikidata`を守り、適用Fieldを`exhibition_field_sources`へ記録する。
- Publication、Primary Image、Rights判断は更新しない。Source画像はCandidateに留める。

## Canonical relations

Venueは既存Occurrenceを最優先で保護し、その次にcanonical Venueのname / name_en / aliasのnormalized exact単一候補だけを接続する。文字列だけからVenueを作らない。0件または複数候補は`exhibition_venue_mentions`へ監査情報と`pending / ambiguous`を保存し、将来のTargeted Venue workerへ渡す。

Artistは構造化Artist field、または既存Artistの完全なname / name_en / aliasがTitleに明示された場合だけを扱う。Description推測、fuzzy/partial nameによるRelation作成、Global Artist Syncは行わない。`exhibition_artist_mentions`が監査とTargeted Artist handoffを保持する。既存`exhibition_artists`はdelete/recreateせず、追加またはlast-seen更新のみ行う。

SourceからMentionが一時的に消えてもRelationを即削除しない。`last_seen_at`と`relation_status`を使い、stale化は完全で成功したsource snapshotに対する別の明示Jobでのみ行う。

## Operation and failure isolation

AdminのDry RunはDB変更なしでNew / Changed / UnchangedとRelation予定を返す。Applyは`operation_type=exhibition_daily_sync`の`import_runs.metrics`へ集計を残す。1 recordの失敗は他recordを止めない。Japan Searchのtimeout、429、5xxはbounded exponential backoffで最大3回試行する。

Productionでは長時間HTTP requestにしない。Scan snapshot ID、checkpoint、batch size、worker retry / dead-letter、排他制御、observabilityを追加し、ScanとApplyを別Jobに分離する。Targeted Venue / Artist enrichmentも別queue consumerにする。

## Publish rule

既存Ruleを維持する。Title、canonical Venue occurrence、Date、Primary Image、approved Rightsが必要。Artist Relationは必須ではない。
