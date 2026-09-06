-- Work / Collection import foundation v1.
-- Ownership (collection_holdings) and display state (work_presentations) are
-- intentionally independent. Display state is recorded only when a source is explicit.

insert into public.data_sources (key, name, base_url, terms_url, metadata_license)
values
  ('apj_shuzo', 'Art Platform Japan — SHŪZŌ', 'https://artplatform.go.jp/collections', 'https://artplatform.go.jp/about/terms', 'See APJ terms'),
  ('tomuco', 'Tokyo Museum Collection', 'https://museumcollection.tokyo/works/', 'https://museumcollection.tokyo/terms/', 'PDL 1.0 / source-specific rights')
on conflict (key) do update set
  name = excluded.name, base_url = excluded.base_url, terms_url = excluded.terms_url, metadata_license = excluded.metadata_license;

update public.collection_holdings
set holding_type = 'other'
where holding_type is not null
  and holding_type not in ('collection', 'long_term_loan', 'deposit', 'other');

alter table public.collection_holdings
  alter column holding_type set default 'collection',
  add constraint collection_holdings_holding_type_chk
    check (holding_type is null or holding_type in ('collection', 'long_term_loan', 'deposit', 'other'));

alter table public.work_artists
  add column source text,
  add column source_url text,
  add column source_record_id uuid references public.source_records(id) on delete set null,
  add column verified_at timestamptz;

alter table public.collection_holdings
  add column source text,
  add column source_record_id uuid references public.source_records(id) on delete set null;

create table public.work_presentations (
  id uuid primary key default gen_random_uuid(),
  work_id uuid not null references public.works(id) on delete cascade,
  venue_id uuid not null references public.venues(id) on delete restrict,
  presentation_type text not null default 'unknown'
    check (presentation_type in ('permanent', 'temporary', 'unknown')),
  status text not null default 'unknown'
    check (status in ('currently_displayed', 'not_displayed', 'unknown')),
  start_date date,
  end_date date,
  source text,
  source_url text,
  source_record_id uuid references public.source_records(id) on delete set null,
  verified_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (start_date is null or end_date is null or start_date <= end_date),
  unique (work_id, venue_id, presentation_type, start_date)
);

create index work_presentations_work_idx on public.work_presentations (work_id, venue_id);
create index work_presentations_venue_idx on public.work_presentations (venue_id, work_id);

create table public.work_import_candidates (
  id uuid primary key default gen_random_uuid(),
  artist_id uuid not null references public.artists(id) on delete cascade,
  data_source_id uuid not null references public.data_sources(id) on delete restrict,
  external_id text not null,
  source_url text,
  title text not null,
  title_en text,
  title_original text,
  year_text text,
  created_year_from integer,
  created_year_to integer,
  source_artist_name text,
  source_venue_name text,
  matched_venue_id uuid references public.venues(id) on delete set null,
  holding_type text check (holding_type is null or holding_type in ('collection', 'long_term_loan', 'deposit', 'other')),
  presentation_type text check (presentation_type is null or presentation_type in ('permanent', 'temporary', 'unknown')),
  presentation_status text check (presentation_status is null or presentation_status in ('currently_displayed', 'not_displayed', 'unknown')),
  representative_score numeric,
  representative_reason text,
  match_status text not null default 'candidate'
    check (match_status in ('candidate', 'selected', 'imported', 'rejected', 'duplicate', 'ambiguous')),
  matched_work_id uuid references public.works(id) on delete set null,
  raw_payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (data_source_id, external_id, artist_id)
);

create index work_import_candidates_artist_idx
  on public.work_import_candidates (artist_id, match_status, representative_score desc nulls last);

create trigger work_presentations_updated_at before update on public.work_presentations
for each row execute function public.set_updated_at();

create trigger work_import_candidates_updated_at before update on public.work_import_candidates
for each row execute function public.set_updated_at();

alter table public.work_presentations enable row level security;
alter table public.work_import_candidates enable row level security;
