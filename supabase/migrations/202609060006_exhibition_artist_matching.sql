create table if not exists public.exhibition_artist_mentions (
  id uuid primary key default gen_random_uuid(),
  exhibition_id uuid not null references public.exhibitions(id) on delete cascade,
  source_record_id uuid references public.source_records(id) on delete set null,
  source_artist_name text not null,
  normalized_name text not null,
  role text,
  extraction_method text not null
    check (extraction_method in ('structured_source', 'title_exact_master_name')),
  match_status text not null default 'unmatched'
    check (match_status in ('unmatched', 'candidate', 'matched', 'rejected')),
  matched_artist_id uuid references public.artists(id) on delete set null,
  candidate_artist_ids uuid[] not null default '{}',
  targeted_import_qid text,
  match_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (exhibition_id, normalized_name)
);

create index if not exists exhibition_artist_mentions_status_idx
  on public.exhibition_artist_mentions (match_status, exhibition_id);

drop trigger if exists exhibition_artist_mentions_updated_at on public.exhibition_artist_mentions;
create trigger exhibition_artist_mentions_updated_at before update on public.exhibition_artist_mentions
for each row execute function public.set_updated_at();

alter table public.exhibition_artist_mentions enable row level security;

comment on table public.exhibition_artist_mentions is
  'Audit ledger preserving the Artist name written by an Exhibition source before canonical Artist matching.';
