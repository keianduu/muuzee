create table if not exists public.artist_external_match_candidates (
  id uuid primary key default gen_random_uuid(),
  artist_id uuid not null references public.artists(id) on delete cascade,
  provider text not null,
  external_id text not null,
  label_ja text,
  label_en text,
  birth_year integer,
  confidence numeric not null default 0,
  match_reasons jsonb not null default '[]'::jsonb,
  status text not null default 'candidate' check (status in ('candidate', 'matched', 'rejected')),
  raw_payload jsonb not null,
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  unique (artist_id, provider, external_id)
);
create index if not exists artist_match_candidates_artist_idx on public.artist_external_match_candidates (artist_id, status, confidence desc);
alter table public.artist_external_match_candidates enable row level security;
comment on table public.artist_external_match_candidates is 'Ambiguous Artist identity candidates only; unambiguous Wikidata Source A records apply directly to Artist Master.';
