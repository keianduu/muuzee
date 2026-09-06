# Wikimedia Commons integration

Status: Draft for Venue Enrichment v0.

Muuzee walks the shared confidence thresholds from `0.95` down to `0.00` in `0.05` steps. At the first threshold whose eligible, non-rejected Wikidata entities contain P18, it records that threshold and calls Commons' MediaWiki Action API `imageinfo` with `url|extmetadata` and a 640px thumbnail request. It does not continue to lower thresholds after a hit. Unconfirmed candidates are capped at three per venue and remain reference images; their existence does not confirm the Wikidata entity.

Normalized fields include file title, original/thumbnail URL, Commons description page, author/artist, credit, license short name, license URL, and usage terms. `extmetadata` may contain HTML, so Admin receives plain text rather than rendering upstream markup.

Admin expands recognized reported license names into a review table: license, usage availability, commercial use, modification/cropping, attribution, and share-alike. For example, `CC BY 3.0` becomes usable, commercial use allowed, modification allowed, attribution required, and no share-alike requirement. CC BY-SA, CC BY-NC, CC BY-ND, CC0, and Public Domain conditions remain explicit. Unknown/custom/missing license names show `不明` for every condition instead of inferring permission. This table is an operational aid derived from the reported license, not a legal determination or Muuzee rights approval.

Candidates are external research references. Candidate relevance begins `unreviewed`; rights always begin `needs_review` (記載なし・不明), regardless of the reported license. Admin records rights as 明確に不可 (`rejected`), 記載なし・不明 (`needs_review`), or 明確に利用可能 (`approved`). Relevance, Primary selection, and rights approval remain separate. Existing Primary is preserved; otherwise a usable Wikidata P18 is the preferred representative image and may become Primary even when alternatives exist. Without P18, only one usable fallback is auto-selected; multiple fallbacks require human selection. `(source_record_id, provider, stable_identifier)` deduplicates the same Commons file while allowing metadata refresh and preserving human decisions.

Venue Image DiscoveryではCommons File TitleをStable Identifierとして、Wikidata P18、Commons Category、Wikipedia Article間の重複を除く。確定QIDのP18を最優先にし、追加候補は施設写真らしいFile名だけに絞り、Venueあたり最大3件保存する。`discovery_source`は候補がどの経路で見つかったかを示すもので、ライセンス判断やRights Approvedを意味しない。

Official references:

- https://www.mediawiki.org/wiki/API:Imageinfo/en
- https://commons.wikimedia.org/wiki/Commons:Reusing_content_outside_Wikimedia
