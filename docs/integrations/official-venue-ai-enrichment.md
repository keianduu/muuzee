# Official Venue AI Enrichment

## Purpose

Source Bの公式サイトCrawler結果を、CodexでVenue Master向けの構造化CSVへ変換するLOCAL運用。AI自動実行やOpenAI API連携は行わない。

```text
Official Website
→ Crawler
→ AI補完用CSV
→ Codex + 固定Prompt
→ Structured CSV
→ 既存CSV Preview
→ Conflict確認
→ Confirm Import
```

## Source policy

- Sourceは常に`official_website`。AIはSourceではなくTransformation。
- AIが利用できるのはCrawler CSV内の公式本文、既存抽出値、公式Source URL、曖昧候補だけ。
- Web検索、第三者情報、一般知識、推測は禁止。
- CSVはtransportであり、Source priorityを持たない。
- Priorityは`Manual > Official Website > Trusted API > Wikidata`。

## CSV

AdminのCrawl結果から`AI補完用CSV Download`を選ぶ。対象はaddress、postal_code、opening_hours_text、closed_days_text、access_text、description。公式本文は`official_source_text`へ、AI判断は`ai_notes`へ保存する。AIが生成したField名を`generated_by_ai`へ`|`区切りで列挙し、各`*_confidence`へ`high / medium / low`を入れる。

既存値は保持し、空欄を中心に補完する。AI生成Fieldには公式Source URLが必須。空欄は削除として扱わない。Manual由来の値はPreviewでConflictとなり、自動上書きされない。

## Description

公式本文に十分な施設説明がある場合だけ、200〜300字を目安にMuuzee独自の日本語要約を作る。事実中心とし、宣伝調、評価、根拠のない特徴、長い転載は禁止。根拠不足、別施設の本文、domain乗っ取りが疑われる本文では生成しない。

## Provenance

Confirm時は`venue_field_sources`へ、`source=official_website`、公式`source_url`、`generated_by_ai=true`、confidence、AI notes、適用日時を記録する。Human Reviewは複数候補、Manual conflict、lowかつ曖昧、parse mismatchに限定する。

## LOCAL operation

全件AI Enrichmentは行わず、判断に必要なSampleだけを処理する。今回の20件結果は`docs/research/venue-official-ai-enrichment-coverage.md`に記録する。Sample CSVは`tmp/venue-official-ai-enriched-20.csv`（gitignored）に置く。
