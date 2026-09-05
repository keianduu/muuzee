# Official Website Venue Crawler (Source B)

Status: Draft. Local Admin only.

## Purpose

Source B complements Venue Master fields from each venue's official website. It is intentionally a reviewable CSV pipeline, not a direct database crawler:

```text
Venue official_url
  → bounded same-domain crawl
  → stored crawl result and provenance evidence
  → CSV Download
  → optional human / Codex edit
  → existing CSV Preview and diff
  → explicit Confirm
  → Venue Master + field provenance
```

The crawler extracts only directly stated facts. It does not infer missing values. If equally reliable official pages disagree, the field is left blank and listed in `ambiguous_fields` for human resolution.

## Admin operation

Open `/admin/venues` and choose `公式サイト情報取得`.

- `選択中をCrawl`: crawls selected rows, up to 50.
- `現在のFilterからN件`: applies the current Venue filters and crawls the first eligible official URLs.
- `不足Fieldを優先`: restricts targets to records missing the selected field.
- `Count`: deliberately limited to 1–50 for local verification. There is no Full Crawl button.

After completion, inspect the summary/table and download the run CSV. Upload that file through the existing `CSV（入出力）` menu. Preview shows Before → After and conflicts. Only Confirm changes the Master.

## Crawl safety

- HTTP(S) only; credentials in URLs are rejected.
- DNS-resolved private/loopback/link-local targets are rejected to reduce SSRF risk.
- Navigation remains on the official URL's domain (`www` is normalized).
- `robots.txt` Allow / Disallow and Crawl-delay are honored.
- At most 6 HTML pages per venue.
- Responses are limited to 2 MiB; non-HTML pages are skipped.
- DNS resolution has a 5 second limit, HTTP requests have a 12 second timeout, and each venue has a 45 second total limit.
- Transient failures are retried once. Pages are sequential per venue with at least 600 ms between requests; at most 2 venues run concurrently.
- Redirects are limited and cross-domain redirects are rejected.
- Declared HTML charset is honored so legacy Japanese sites are not decoded as UTF-8 blindly.

## Extracted fields

The current extraction order is structured data (JSON-LD), then semantic page content and conservative labels. The CSV may contain:

- `address`, `postal_code`
- `opening_hours_text`, `closed_days_text`
- `access_text`
- `description_source_url`, `description_source_text` (source material only)
- `official_source_text` (公式domain内で取得したHTMLから整形した本文。1ページ4,000文字、1 Venue 16,000文字を上限とし、AI構造化の入力にのみ使う)
- `phone` (optional operational column; not imported into the current Venue schema)
- per-field source URLs, crawl status/date, visited URLs, ambiguity, and notes

Description generation is not automated. Adminの`AI補完用CSV Download`と`AI補完Promptをコピー`を使い、Codexへ手動で渡す。AIはSourceではなく、公式サイトを根拠とするExtraction / Summary Transformationである。出力CSVは既存のMaster CSV Preview / Confirmへ戻し、AIが生成したFieldだけを`generated_by_ai`へ列挙する。

AI workflowの詳細は[official-venue-ai-enrichment.md](./official-venue-ai-enrichment.md)を参照する。

## Source priority and update policy

```text
Manual > Official Website > Trusted API > Wikidata
```

Reliable source values are applied at Confirm without a separate field-level accept/reject step. CSV is only a transport: Source B declares `source_type=official_website`, while an undeclared generic CSV cannot displace attributable data automatically. Manual values remain protected and appear as conflicts requiring explicit override. Equal-priority recrawls produce ordinary diffs. Blank Source B fields never clear existing Master values. Every applied field keeps source, source URL, timestamp, value snapshot, AI flag, and current/history state.

Publication remains the final content-wide control. Crawl and CSV import never publish a Venue.

## Recrawl

Run Source B again and download the new CSV. The normal Preview compares it against the current Master. Unchanged fields are skipped; changed Official Website values are shown as diffs; Manual conflicts are stopped for explicit confirmation. Crawl history is retained in `import_runs` and `official_venue_crawl_results` and is visible in the Venue drawer's Data tab.

## Current boundary

This version does not schedule crawls, access remote/staging/production environments, call an AI API, crawl all Venue records, or implement Source C. Production use requires Admin authentication/authorization and an operational review of traffic limits and each site's terms.

## Local coverage sample (2026-09-05)

The final conservative extraction pass processed 5 venues first, then 20 venues. No crawl result was confirmed into Venue Master.

| Field / result | 5 venues | 20 venues |
| --- | ---: | ---: |
| Official page fetched | 4 (80%) | 18 (90%) |
| Address | 1 (20%) | 2 (10%) |
| Postal code | 1 (20%) | 5 (25%) |
| Opening hours | 0 (0%) | 3 (15%) |
| Closed days | 0 (0%) | 2 (10%) |
| Access | 0 (0%) | 1 (5%) |
| Description source | 4 (80%) | 16 (80%) |

For the 20 venue run, one venue was complete, sixteen were partial, one had no relevant extractable page, and two failed. Observed failures were an unresolvable domain and HTTP 429 while fetching robots.txt. Source B is useful for official description evidence and some basic fields, but coverage for complex visitor information is not sufficient by itself; Source C or site-specific adapters may be needed.
