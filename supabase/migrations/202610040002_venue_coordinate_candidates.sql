create table public.venue_coordinate_candidates (
  id uuid primary key default gen_random_uuid(),
  venue_id uuid not null references public.venues(id) on delete cascade,
  source text not null check (source in ('wikidata', 'geolonia')),
  candidate_key text not null,
  external_id text,
  latitude numeric not null,
  longitude numeric not null,
  confidence numeric,
  reason text,
  precision text,
  source_url text,
  source_record_id uuid references public.source_records(id) on delete set null,
  review_status text not null default 'candidate'
    check (review_status in ('candidate', 'accepted', 'rejected')),
  decided_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (venue_id, source, candidate_key)
);

create index venue_coordinate_candidates_venue_idx
  on public.venue_coordinate_candidates (venue_id, review_status, updated_at desc);

create trigger venue_coordinate_candidates_updated_at
before update on public.venue_coordinate_candidates
for each row execute function public.set_updated_at();

alter table public.venue_coordinate_candidates enable row level security;

insert into public.venue_coordinate_candidates (
  venue_id, source, candidate_key, external_id, latitude, longitude,
  confidence, reason, source_url, review_status, decided_at
)
select
  id,
  coordinate_candidate_source,
  coalesce(coordinate_candidate_qid, concat(coordinate_candidate_latitude, ',', coordinate_candidate_longitude)),
  coordinate_candidate_qid,
  coordinate_candidate_latitude,
  coordinate_candidate_longitude,
  coordinate_candidate_confidence,
  coordinate_candidate_reason,
  case when coordinate_candidate_qid is not null then 'https://www.wikidata.org/wiki/' || coordinate_candidate_qid else null end,
  case when coordinate_status = 'approved' then 'accepted' when coordinate_status = 'rejected' then 'rejected' else 'candidate' end,
  coordinate_candidate_decided_at
from public.venues
where coordinate_candidate_source is not null
  and coordinate_candidate_latitude is not null
  and coordinate_candidate_longitude is not null
on conflict (venue_id, source, candidate_key) do nothing;

insert into public.venue_coordinate_candidates (
  venue_id, source, candidate_key, latitude, longitude, precision, reason
)
select
  id,
  'geolonia',
  concat(geolonia_candidate_latitude, ',', geolonia_candidate_longitude),
  geolonia_candidate_latitude,
  geolonia_candidate_longitude,
  geolonia_candidate_precision,
  'Geolonia address candidate'
from public.venues
where geolonia_candidate_latitude is not null
  and geolonia_candidate_longitude is not null
on conflict (venue_id, source, candidate_key) do nothing;

comment on table public.venue_coordinate_candidates is
  'Human-reviewed coordinate proposals. Entity identity and each coordinate candidate decision remain independent.';
