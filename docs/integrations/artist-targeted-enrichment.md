# Artist Targeted Enrichment

Status: Draft
Environment: LOCAL

## Operating model

```text
Exhibition / Work
  → required Artist
  → Wikidata Targeted Import
  → Wikipedia explicit-field fallback
  → APJ DAJ identity / authority lookup
  → Getty ULAN explicit nationality lookup
  → official Artist / Gallery / Foundation / Museum image research
  → Manual only for ambiguity or unresolved rights
```

APJ、Getty、ArtistのGlobal Full SyncやCronは行わない。今回のendpointは固定されたTier A不足QIDだけを処理する。

## Matching and application

- APJ / GettyともName、Name EN、Aliases、Birth / Deathを照合し、一意Matchだけを採用する。
- APJへの収録、日本語名、Birth PlaceからNationalityを推測しない。
- Gettyに明示されたNationalityが1種類で、Masterが空欄の場合だけcountry codeを適用する。
- Gettyの複数NationalityはSource Recordのraw payloadへ保持し、canonical値は空欄にする。
- Source Record、APJ / ULAN External ID、Field Provenanceを保存し、`generated_by_ai=false`とする。
- Source PriorityはManual > Official > APJ > Getty > Wikipedia > Wikidata。既存値はTargeted処理で上書きしない。

## Images and rights

- 既存の共通`source_image_candidates` / `media_assets`を使い、Artist専用画像構造は作らない。
- Source priorityはArtist公式、公式Gallery、Foundation / Estate、美術館公式、公式Press、Open Collectionの順。
- Candidateが1件だけなら共通PolicyでPrimary化できる。複数はHuman Selection、既存Primaryは上書きしない。
- Image discoveryとRights approvalは別。利用条件を確認できない公式画像は`needs_review`のままとし、公開前に確認・許諾判断する。

## LOCAL result — 2026-09-06

- Nationality: 8 targets / APJ exact 5 / Getty exact 6 / 5 applied
- Images: 8 targets / candidates found 3 / Primary added 3 / Rights approved 0
- Remaining nationality missing: 3
- Remaining Primary missing: 5
- Tier A Core Quality: 88.2% → 94.1%
- Second application: no new values, candidates, or Primary images
