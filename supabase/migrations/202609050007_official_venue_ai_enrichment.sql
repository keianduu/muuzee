alter table public.official_venue_crawl_results
  add column if not exists official_source_text text;

alter table public.venue_field_sources
  add column if not exists ai_confidence text
    check (ai_confidence is null or ai_confidence in ('high', 'medium', 'low')),
  add column if not exists transformation_notes text;

comment on column public.official_venue_crawl_results.official_source_text is
  'Bounded cleaned text collected only from crawled official pages for offline AI extraction; never raw HTML.';

comment on column public.venue_field_sources.ai_confidence is
  'Transformation confidence supplied by the AI-structured CSV. It does not change source authority.';
