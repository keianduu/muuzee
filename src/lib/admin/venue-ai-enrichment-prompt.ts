export const VENUE_AI_ENRICHMENT_FIELDS = [
  "address", "postal_code", "opening_hours_text", "closed_days_text", "access_text", "description",
] as const;

export const VENUE_AI_ENRICHMENT_PROMPT = `MuuzeeのOfficial Website Crawler CSVを、Venue Master Import用CSVへ構造化してください。

絶対ルール:
- 使用できる根拠は入力CSV内の official_source_text、description_source_text、既存抽出値、field source URL、ambiguous_fieldsだけです。
- Web検索、第三者サイト、一般知識、推測、補完は禁止です。
- AIはSourceではありません。source_typeは必ず official_website のままにしてください。
- CSVはtransportです。SourceはOfficial Websiteです。
- 既に値があるFieldは保持し、AIで上書きしないでください。
- AIは空欄を中心に補完してください。既存値と異なる候補を見つけても上書きせず、ai_notesへ記録してください。
- 根拠が不足するFieldは空欄のままにしてください。空欄を架空の値で埋めないでください。
- source URLは入力CSV内の公式URLだけを使用してください。
- address / postal_code / opening_hours_text / closed_days_text / access_text / description以外を変更しないでください。
- AIが生成・整理したField名だけを generated_by_ai に | 区切りで列挙してください。例: address|description
- AIが触れなかった既存値は generated_by_ai に含めないでください。
- 各AI生成Fieldの *_confidence は high / medium / low のいずれかにしてください。未生成Fieldは空欄です。
- 複数候補を一意に判断できない場合はFieldを空欄のままにし、候補と理由をai_notesへ記録してください。
- low confidenceで曖昧な値は採用せず、ai_notesへ記録してください。
- 出力は入力と同じ行数・idで、CSVだけを返してください。説明文やMarkdownコードフェンスは不要です。

Field rule:
- address: 公式本文に明記された施設所在地だけ。
- postal_code: 公式本文に明記された郵便番号だけ。addressから機械的に切り出せる場合は可。
- opening_hours_text: 通常の開館・営業時間。期間限定イベントや個別店舗の時間を混ぜない。
- closed_days_text: 通常の休館・休業日。臨時休館だけなら通常Fieldへ入れない。
- access_text: 最寄駅、徒歩、バス等の来館経路。住所だけをAccessとして扱わない。
- description: Official Sourceに十分な施設説明がある場合だけ、200〜300字を目安にMuuzee独自の日本語要約を作る。事実中心、宣伝調・評価表現・根拠のない特徴・長い転載は禁止。根拠不足なら空欄。

Conflict handling:
- 既存値と矛盾する情報は既存値を保持し、ai_notesへ記録。
- 複数候補、期間限定情報との混在、施設本体と併設施設の混同、parse mismatchはai_notesへ記録。
- ambiguous_fieldsを解消できた場合は、根拠と判断をai_notesへ残し、出力のambiguous_fieldsは解消後の未解決項目だけにする。

Source URL:
- AI生成Fieldのsource URLは、そのFieldの根拠が含まれる [Source URL: ...] を使用。
- 特定できない場合はcrawl_source_urlまたはofficial_urlを使うが、公式domain外のURLは作らない。`;
