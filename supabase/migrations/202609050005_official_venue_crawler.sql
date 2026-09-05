insert into public.data_sources (key, name, base_url, terms_url, metadata_license)
values (
  'official_website',
  'Venue Official Website',
  'https://example.invalid',
  null,
  'Official source; extracted facts only'
)
on conflict (key) do update set
  name = excluded.name,
  metadata_license = excluded.metadata_license;

alter table public.venue_field_sources drop constraint venue_field_sources_review_status_check;
alter table public.venue_field_sources add constraint venue_field_sources_review_status_check
  check (review_status in ('unreviewed', 'applied', 'approved', 'rejected'));

alter table public.artist_field_sources drop constraint artist_field_sources_review_status_check;
alter table public.artist_field_sources add constraint artist_field_sources_review_status_check
  check (review_status in ('unreviewed', 'applied', 'approved', 'rejected'));

alter table public.work_field_sources drop constraint work_field_sources_review_status_check;
alter table public.work_field_sources add constraint work_field_sources_review_status_check
  check (review_status in ('unreviewed', 'applied', 'approved', 'rejected'));

create table public.official_venue_crawl_results (
  id uuid primary key default gen_random_uuid(),
  import_run_id uuid not null references public.import_runs(id) on delete cascade,
  venue_id uuid not null references public.venues(id) on delete cascade,
  crawl_status text not null
    check (crawl_status in ('success', 'partial', 'no_official_url', 'robots_blocked', 'fetch_failed', 'parse_failed', 'no_relevant_page', 'timeout')),
  crawled_at timestamptz not null default now(),
  crawl_source_url text,
  discovered_urls jsonb not null default '[]'::jsonb,
  extracted_values jsonb not null default '{}'::jsonb,
  field_source_urls jsonb not null default '{}'::jsonb,
  description_source_text text,
  description_source_url text,
  phone text,
  ambiguous_fields jsonb not null default '{}'::jsonb,
  notes text,
  created_at timestamptz not null default now(),
  unique (import_run_id, venue_id)
);

create index official_venue_crawl_results_venue_idx
  on public.official_venue_crawl_results (venue_id, crawled_at desc);

alter table public.official_venue_crawl_results enable row level security;

comment on table public.official_venue_crawl_results is
  'Bounded official-site crawl output. This never updates Venue Master directly; CSV Preview and Confirm are required.';
