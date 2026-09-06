-- Shared DB-side Venue resolver.
-- Exact lookup keys avoid PostgREST's default 1,000-row response cap and keep
-- ambiguous identities visible to the application instead of choosing top-1.

create or replace function public.normalize_venue_search_key(p_value text)
returns text
language sql
immutable
parallel safe
as $$
  select nullif(lower(regexp_replace(btrim(normalize(coalesce(p_value, ''), NFKC)), '[[:space:]]+', ' ', 'g')), '');
$$;

create table if not exists public.venue_search_keys (
  venue_id uuid not null references public.venues(id) on delete cascade,
  key_type text not null check (key_type in ('name', 'name_en', 'alias', 'official_url')),
  normalized_value text not null,
  source_value text not null,
  created_at timestamptz not null default now(),
  primary key (venue_id, key_type, normalized_value)
);

create index if not exists venue_search_keys_lookup_idx
  on public.venue_search_keys (normalized_value, key_type, venue_id);

create or replace function public.refresh_venue_search_keys()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  alias_value text;
begin
  delete from public.venue_search_keys where venue_id = new.id;
  if new.merged_into_venue_id is not null or new.is_active is false then
    return new;
  end if;

  insert into public.venue_search_keys (venue_id, key_type, normalized_value, source_value)
  select new.id, 'name', public.normalize_venue_search_key(new.name), new.name
  where public.normalize_venue_search_key(new.name) is not null
  on conflict do nothing;

  insert into public.venue_search_keys (venue_id, key_type, normalized_value, source_value)
  select new.id, 'name_en', public.normalize_venue_search_key(new.name_en), new.name_en
  where public.normalize_venue_search_key(new.name_en) is not null
  on conflict do nothing;

  foreach alias_value in array coalesce(new.aliases, '{}'::text[]) loop
    insert into public.venue_search_keys (venue_id, key_type, normalized_value, source_value)
    select new.id, 'alias', public.normalize_venue_search_key(alias_value), alias_value
    where public.normalize_venue_search_key(alias_value) is not null
    on conflict do nothing;
  end loop;

  insert into public.venue_search_keys (venue_id, key_type, normalized_value, source_value)
  select new.id, 'official_url', public.normalize_venue_search_key(new.official_url), new.official_url
  where public.normalize_venue_search_key(new.official_url) is not null
  on conflict do nothing;
  return new;
end;
$$;

drop trigger if exists venues_refresh_search_keys on public.venues;
create trigger venues_refresh_search_keys
after insert or update of name, name_en, aliases, official_url, is_active, merged_into_venue_id
on public.venues for each row execute function public.refresh_venue_search_keys();

delete from public.venue_search_keys;

insert into public.venue_search_keys (venue_id, key_type, normalized_value, source_value)
select id, 'name', public.normalize_venue_search_key(name), name
from public.venues
where is_active is true and merged_into_venue_id is null
  and public.normalize_venue_search_key(name) is not null
on conflict do nothing;

insert into public.venue_search_keys (venue_id, key_type, normalized_value, source_value)
select id, 'name_en', public.normalize_venue_search_key(name_en), name_en
from public.venues
where is_active is true and merged_into_venue_id is null
  and public.normalize_venue_search_key(name_en) is not null
on conflict do nothing;

insert into public.venue_search_keys (venue_id, key_type, normalized_value, source_value)
select venue.id, 'alias', public.normalize_venue_search_key(alias_value), alias_value
from public.venues venue cross join lateral unnest(venue.aliases) alias_value
where venue.is_active is true and venue.merged_into_venue_id is null
  and public.normalize_venue_search_key(alias_value) is not null
on conflict do nothing;

insert into public.venue_search_keys (venue_id, key_type, normalized_value, source_value)
select id, 'official_url', public.normalize_venue_search_key(official_url), official_url
from public.venues
where is_active is true and merged_into_venue_id is null
  and public.normalize_venue_search_key(official_url) is not null
on conflict do nothing;

alter table public.work_import_candidates
  add column if not exists venue_candidate_ids uuid[] not null default '{}',
  add column if not exists venue_match_method text,
  add column if not exists venue_match_reason text;

alter table public.venue_search_keys enable row level security;

comment on table public.venue_search_keys is
  'Indexed exact identity keys for the shared Venue Resolver. Maintained automatically from active canonical Venue rows.';
