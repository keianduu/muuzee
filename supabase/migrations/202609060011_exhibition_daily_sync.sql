-- Exhibition Daily Sync / canonical relation audit.
-- Resolution failures are retained for a later targeted worker and never create
-- Venue/Artist masters from source strings alone.

alter table public.source_records
  add column if not exists last_seen_at timestamptz,
  add column if not exists last_changed_at timestamptz;

update public.source_records
set last_seen_at = coalesce(last_seen_at, fetched_at),
    last_changed_at = coalesce(last_changed_at, fetched_at)
where last_seen_at is null or last_changed_at is null;

create table if not exists public.exhibition_venue_mentions (
  id uuid primary key default gen_random_uuid(),
  exhibition_id uuid not null references public.exhibitions(id) on delete cascade,
  source_record_id uuid references public.source_records(id) on delete set null,
  source_venue_name text not null,
  normalized_name text not null,
  matched_venue_id uuid references public.venues(id) on delete set null,
  candidate_venue_ids uuid[] not null default '{}',
  match_method text,
  match_confidence numeric,
  match_status text not null default 'unresolved'
    check (match_status in ('pending', 'resolved', 'ambiguous', 'unresolved', 'failed')),
  resolution_status text not null default 'pending'
    check (resolution_status in ('pending', 'resolved', 'ambiguous', 'failed')),
  match_reason text,
  is_active boolean not null default true,
  last_seen_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (exhibition_id, normalized_name)
);

create index if not exists exhibition_venue_mentions_status_idx
  on public.exhibition_venue_mentions (resolution_status, exhibition_id);

drop trigger if exists exhibition_venue_mentions_updated_at on public.exhibition_venue_mentions;
create trigger exhibition_venue_mentions_updated_at before update on public.exhibition_venue_mentions
for each row execute function public.set_updated_at();

alter table public.exhibition_occurrences
  add column if not exists source_record_id uuid references public.source_records(id) on delete set null,
  add column if not exists source_venue_name text,
  add column if not exists match_method text,
  add column if not exists match_confidence numeric,
  add column if not exists relation_status text not null default 'active'
    check (relation_status in ('active', 'stale')),
  add column if not exists last_seen_at timestamptz;

alter table public.exhibition_artist_mentions
  add column if not exists resolution_status text not null default 'pending'
    check (resolution_status in ('pending', 'resolved', 'ambiguous', 'failed')),
  add column if not exists is_active boolean not null default true,
  add column if not exists last_seen_at timestamptz;

alter table public.exhibition_artists
  add column if not exists source_record_id uuid references public.source_records(id) on delete set null,
  add column if not exists relation_status text not null default 'active'
    check (relation_status in ('active', 'stale')),
  add column if not exists last_seen_at timestamptz;

create unique index if not exists exhibition_occurrences_source_identity_idx
  on public.exhibition_occurrences (exhibition_id, venue_id, coalesce(start_date, '0001-01-01'::date));

alter table public.exhibition_venue_mentions enable row level security;

comment on table public.exhibition_venue_mentions is
  'Audit and targeted-resolution handoff for source Venue strings. It never authorizes creating a Venue from a string alone.';
comment on column public.source_records.last_seen_at is
  'Most recent successful source observation. Failed or partial scans do not mark a record stale.';
comment on column public.source_records.last_changed_at is
  'Most recent observation at which the source checksum changed.';
