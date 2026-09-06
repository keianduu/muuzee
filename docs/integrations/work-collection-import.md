# Work / Collection Targeted Import v1

Status: Draft / LOCAL only.

## Purpose

Work Masterは網羅的な作品DBではない。Artist Detailの代表作品とVenue Detailの主要所蔵作品を支える、小さく明示的な関係データを扱う。

Work Core Qualityは次の3項目だけである。

1. Title
2. Artist Relation (`work_artists`)
3. Holding Venue (`collection_holdings`)

Yearは任意。Image、description、dimensions、medium、展示状態は公開必須条件に含めない。

## Multilingual title policy

Work titleは用途を分けて保存する。

- `title_ja`: 日本語表示名。日本語UIでは最優先する。
- `title_en`: 英語表示名。英語UIでは最優先する。
- `title_original`: 原題。翻訳名から推測しない。
- `original_language`: 原題の言語コード。Sourceが明示した場合だけ保存する。
- `title`: 既存実装との互換用Legacy field。新しい表示・公開判定の唯一の根拠にはしない。

日本語表示は`title_ja → title_original → title_en → title`、英語表示は`title_en → title_original → title_ja → title`の順でfallbackする。どれか1つのタイトルがあればTitle Coreは成立する。Sourceが日本語・英語・原題を区別して返した場合は各fieldへ保存し、同一文字列や文字種から言語を推測しない。

## Source adapters

- SHŪZŌ: Artist名の完全一致後、検索結果から最大5候補を取得する。
- ToMuCo: 公開APIのArtist名検索を使用する。ただしLOCALから403等で利用できない場合は失敗を記録し、SHŪZŌだけで続行する。

結果順だけでは代表作と確定できないため、両Sourceとも`work_import_candidates`へ候補保存する。自動採用はせず、Adminで人が`この作品を採用`を実行した候補だけをWork Masterへ反映する。全件同期やcronは実装しない。

## Relation rules

```text
Tier A Artist
  → source search
  → exact Artist identity
  → Work candidate (max 5 / Artist)
  → exact Venue Master match
  → human selects representative work
  → Work + work_artists + collection_holdings
```

- ArtistとVenueは既存Muuzee UUIDへ結ぶ。VenueはDB-side Shared Venue Resolverで照合し、Master全件をApplicationへ取得しない。曖昧な候補からMasterを新規作成しない。
- 所蔵がSourceに明記された場合だけ`collection_holdings`へ保存する。
- `collection_holdings`は所有・寄託等を表し、現在展示中を意味しない。
- 常設・企画・現在展示中等が明記された場合だけ`work_presentations`へ保存する。
- Year不明はNULLのままにし、推測しない。
- Source external IDを第一の重複判定とし、補助的に正規化Title + Artist UUID + Venue UUID + Yearを使う。曖昧な複数一致は自動統合しない。

## Candidate adoption

- Core 3/3（Title / canonical Artist / canonical Holding Venue）の候補だけ採用できる。
- 採用はDB function内の単一Transactionで`works`、`work_artists`、`collection_holdings`、`source_records`、`work_field_sources`を更新する。
- Workは必ず`draft`で作成し、採用とPublishを分離する。
- PresentationはSourceに明示されたCandidateだけ作成する。Holdingから展示中を推測しない。
- 同じCandidateを再採用しても同じWorkを返し、Relationを重複作成しない。
- Candidate再取得時も`imported`と`matched_work_id`を保持する。
- 未照合Candidateの再照合はVenue relation情報だけを更新し、Workを自動採用しない。候補ID、match method、reasonを監査用に保持する。
- `work_artists.sort_order`はArtistごとのAdmin表示順を保持する補助値で、代表性の自動判定には使わない。

## Admin and CSV

`/admin/works`は候補の日本語Title / English Title / Original Title / Artist / Holding Venue / Year / Source / HoldingとDisplayの区別 / Statusを表示し、1件または最大20件を明示的に採用できる。採用できないCandidateには、作品名がない、アーティスト情報と紐づいていない、所蔵先情報がない、所蔵先と会場情報を紐づけられていない、一致する会場候補が複数ある、採用済みの該当理由をテーブル上で表示する。Master一覧はUI localeに応じたfallback Title / Artist / Holding Venue / Year / Publication / Core Qualityを表示する。Artist/Holding不足とPresentationでFilterできる。Work CSVは`title_ja` / `title_en` / `title_original` / `original_language`、Artist、Holding Venue、任意のPresentation列を含み、Import後もfield / relation source URLを保持する。

Publishはサーバー側でCore 3/3を再検証する。候補、Year、Display、Imageがなくても、Core 3/3なら公開可能である。

## Safety boundary

このv1はLOCAL候補探索基盤であり、STG/Production、remote Supabase、scheduler、global crawlには接続しない。Sourceの検索順を「代表作」と断定しない。
