-- Exhibition-derived Venue -> Canonical Venue Master integration.
-- Source rows remain as soft redirects; no Venue row is hard-deleted.

alter table public.venues
  add column merged_into_venue_id uuid references public.venues(id) on delete restrict,
  add column merged_at timestamptz,
  add column merge_method text,
  add constraint venues_not_merged_into_self_chk check (merged_into_venue_id is null or merged_into_venue_id <> id);

create index venues_merged_into_idx on public.venues (merged_into_venue_id) where merged_into_venue_id is not null;

create table public.venue_canonical_merge_candidates (
  id uuid primary key default gen_random_uuid(),
  source_venue_id uuid not null references public.venues(id) on delete restrict,
  candidate_venue_id uuid not null references public.venues(id) on delete restrict,
  canonical_venue_id uuid not null references public.venues(id) on delete restrict,
  rank integer not null check (rank between 1 and 3),
  confidence numeric(4,3) not null check (confidence between 0 and 1),
  match_category text not null check (match_category in ('HIGH', 'POSSIBLE', 'NONE')),
  match_reasons text[] not null default '{}',
  distance_meters numeric,
  canonical_priority_reason text not null,
  recommended_action text not null check (recommended_action in ('auto_merge', 'human_review', 'keep_separate')),
  auto_merge_eligible boolean not null default false,
  review_status text not null default 'pending' check (review_status in ('pending', 'merged', 'separate', 'held')),
  source_snapshot jsonb not null default '{}'::jsonb,
  candidate_snapshot jsonb not null default '{}'::jsonb,
  reviewed_at timestamptz,
  reviewed_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (source_venue_id, candidate_venue_id)
);

create index venue_canonical_merge_review_idx
  on public.venue_canonical_merge_candidates (review_status, match_category, confidence desc);

create table public.venue_merge_audit (
  id uuid primary key default gen_random_uuid(),
  source_venue_id uuid not null references public.venues(id) on delete restrict,
  canonical_venue_id uuid not null references public.venues(id) on delete restrict,
  candidate_id uuid references public.venue_canonical_merge_candidates(id) on delete set null,
  confidence numeric(4,3),
  match_reasons text[] not null default '{}',
  merge_method text not null,
  source_snapshot jsonb not null,
  canonical_snapshot_before jsonb not null,
  canonical_snapshot_after jsonb not null,
  relation_counts jsonb not null default '{}'::jsonb,
  merged_at timestamptz not null default now(),
  unique (source_venue_id)
);

create or replace function public.venue_source_priority(source_name text)
returns integer language sql immutable as $$
  select case source_name
    when 'manual' then 4
    when 'official_website' then 3
    when 'trusted_api' then 2
    when 'wikidata' then 1
    else 0
  end;
$$;

create or replace function public.merge_venue_into_canonical(
  p_source_venue_id uuid,
  p_canonical_venue_id uuid,
  p_candidate_id uuid default null,
  p_confidence numeric default null,
  p_match_reasons text[] default '{}',
  p_merge_method text default 'human_review'
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  source_row public.venues%rowtype;
  canonical_row public.venues%rowtype;
  relation_summary jsonb;
  provenance_row record;
  canonical_priority integer;
  source_priority integer;
  should_take boolean;
  duplicate_count integer := 0;
  occurrence_duplicate_count integer := 0;
begin
  if p_source_venue_id = p_canonical_venue_id then raise exception 'source and canonical venue must differ'; end if;
  select * into source_row from public.venues where id = p_source_venue_id for update;
  select * into canonical_row from public.venues where id = p_canonical_venue_id for update;
  if source_row.id is null or canonical_row.id is null then raise exception 'venue not found'; end if;
  if source_row.merged_into_venue_id = p_canonical_venue_id then
    return jsonb_build_object('status', 'already_merged', 'sourceVenueId', p_source_venue_id, 'canonicalVenueId', p_canonical_venue_id);
  end if;
  if source_row.merged_into_venue_id is not null or canonical_row.merged_into_venue_id is not null then
    raise exception 'merge chain is not allowed; resolve the current canonical venue first';
  end if;
  if exists (
    select 1 from public.media_assets s join public.media_assets c on c.venue_id = p_canonical_venue_id and c.is_primary
    where s.venue_id = p_source_venue_id and s.is_primary
  ) then raise exception 'both venues have Primary media; human media review is required'; end if;
  if exists (
    select 1 from public.source_records s join public.data_sources ds on ds.id = s.data_source_id and ds.key = 'wikidata'
    join public.source_records c on c.venue_id = p_canonical_venue_id and c.data_source_id = s.data_source_id
    where s.venue_id = p_source_venue_id and s.external_id <> c.external_id
  ) then raise exception 'conflicting Wikidata QIDs require human review'; end if;

  -- Decide which current provenance survives before moving history.
  for provenance_row in
    select s.id, s.field_name, s.source,
      c.id as canonical_source_id, c.source as canonical_source
    from public.venue_field_sources s
    left join public.venue_field_sources c
      on c.venue_id = p_canonical_venue_id and c.field_name = s.field_name and c.is_current
    where s.venue_id = p_source_venue_id and s.is_current
  loop
    source_priority := public.venue_source_priority(provenance_row.source);
    canonical_priority := public.venue_source_priority(provenance_row.canonical_source);
    should_take := provenance_row.canonical_source_id is null or source_priority > canonical_priority;
    if should_take and provenance_row.canonical_source_id is not null then
      update public.venue_field_sources set is_current = false where id = provenance_row.canonical_source_id;
    elsif not should_take then
      update public.venue_field_sources set is_current = false where id = provenance_row.id;
    end if;
  end loop;

  -- Canonical non-empty values win by default. Source values fill blanks. Aliases
  -- retain both names, and source-priority provenance remains available for a
  -- later explicit field correction without silently overwriting human data.
  update public.venues set
    name_en = coalesce(name_en, source_row.name_en),
    name_native = coalesce(name_native, source_row.name_native),
    aliases = (select array_agg(distinct value) from unnest(coalesce(aliases, '{}') || coalesce(source_row.aliases, '{}') || array[source_row.name]) value where nullif(btrim(value), '') is not null),
    postal_code = coalesce(postal_code, source_row.postal_code),
    prefecture = coalesce(prefecture, source_row.prefecture),
    city = coalesce(city, source_row.city),
    address = coalesce(address, source_row.address),
    latitude = coalesce(latitude, source_row.latitude),
    longitude = coalesce(longitude, source_row.longitude),
    official_url = coalesce(official_url, source_row.official_url),
    country_code = coalesce(country_code, source_row.country_code),
    region = coalesce(region, source_row.region),
    district = coalesce(district, source_row.district),
    description = coalesce(description, source_row.description),
    access_text = coalesce(access_text, source_row.access_text),
    opening_hours_text = coalesce(opening_hours_text, source_row.opening_hours_text),
    closed_days_text = coalesce(closed_days_text, source_row.closed_days_text),
    opening_note = coalesce(opening_note, source_row.opening_note),
    inception_year = coalesce(inception_year, source_row.inception_year)
  where id = p_canonical_venue_id;

  -- Exact duplicate holdings and occurrences are collapsed only after their
  -- optional fields have been filled into the canonical relation.
  with duplicates as (
    select s.id source_id, c.id canonical_id
    from public.collection_holdings s join public.collection_holdings c
      on c.venue_id = p_canonical_venue_id and c.work_id = s.work_id
      and c.inventory_number is not distinct from s.inventory_number
    where s.venue_id = p_source_venue_id
  )
  update public.collection_holdings c set
    holding_type = coalesce(c.holding_type, s.holding_type), source_url = coalesce(c.source_url, s.source_url),
    verified_at = coalesce(c.verified_at, s.verified_at)
  from duplicates d join public.collection_holdings s on s.id = d.source_id
  where c.id = d.canonical_id;
  with duplicates as (
    select s.id from public.collection_holdings s join public.collection_holdings c
      on c.venue_id = p_canonical_venue_id and c.work_id = s.work_id
      and c.inventory_number is not distinct from s.inventory_number
    where s.venue_id = p_source_venue_id
  ) delete from public.collection_holdings where id in (select id from duplicates);
  get diagnostics duplicate_count = row_count;

  with duplicates as (
    select s.id source_id, c.id canonical_id
    from public.exhibition_occurrences s join public.exhibition_occurrences c
      on c.venue_id = p_canonical_venue_id and c.exhibition_id = s.exhibition_id
      and c.start_date is not distinct from s.start_date and c.end_date is not distinct from s.end_date
    where s.venue_id = p_source_venue_id
  )
  update public.exhibition_occurrences c set
    opening_hours_text = coalesce(c.opening_hours_text, s.opening_hours_text),
    closed_days_text = coalesce(c.closed_days_text, s.closed_days_text), ticket_url = coalesce(c.ticket_url, s.ticket_url)
  from duplicates d join public.exhibition_occurrences s on s.id = d.source_id
  where c.id = d.canonical_id;
  with duplicates as (
    select s.id from public.exhibition_occurrences s join public.exhibition_occurrences c
      on c.venue_id = p_canonical_venue_id and c.exhibition_id = s.exhibition_id
      and c.start_date is not distinct from s.start_date and c.end_date is not distinct from s.end_date
    where s.venue_id = p_source_venue_id
  ) delete from public.exhibition_occurrences where id in (select id from duplicates);
  get diagnostics occurrence_duplicate_count = row_count;
  duplicate_count := duplicate_count + occurrence_duplicate_count;

  insert into public.venue_tags (venue_id, tag_id)
    select p_canonical_venue_id, tag_id from public.venue_tags where venue_id = p_source_venue_id
    on conflict do nothing;
  delete from public.venue_tags where venue_id = p_source_venue_id;
  update public.exhibition_occurrences set venue_id = p_canonical_venue_id where venue_id = p_source_venue_id;
  update public.collection_holdings set venue_id = p_canonical_venue_id where venue_id = p_source_venue_id;
  update public.media_assets set venue_id = p_canonical_venue_id where venue_id = p_source_venue_id;
  update public.source_records set venue_id = p_canonical_venue_id where venue_id = p_source_venue_id;
  update public.venue_field_sources set venue_id = p_canonical_venue_id where venue_id = p_source_venue_id;
  update public.official_venue_crawl_results r set venue_id = p_canonical_venue_id
    where r.venue_id = p_source_venue_id
      and not exists (select 1 from public.official_venue_crawl_results c where c.venue_id = p_canonical_venue_id and c.import_run_id = r.import_run_id);

  relation_summary := jsonb_build_object(
    'occurrences', (select count(*) from public.exhibition_occurrences where venue_id = p_canonical_venue_id),
    'holdings', (select count(*) from public.collection_holdings where venue_id = p_canonical_venue_id),
    'media', (select count(*) from public.media_assets where venue_id = p_canonical_venue_id),
    'sourceRecords', (select count(*) from public.source_records where venue_id = p_canonical_venue_id),
    'fieldSources', (select count(*) from public.venue_field_sources where venue_id = p_canonical_venue_id),
    'deduplicatedRelations', duplicate_count
  );
  update public.venues set merged_into_venue_id = p_canonical_venue_id, merged_at = now(), merge_method = p_merge_method where id = p_source_venue_id;
  if p_candidate_id is not null then
    update public.venue_canonical_merge_candidates set review_status = 'merged', reviewed_at = now(), reviewed_by = p_merge_method where id = p_candidate_id;
  end if;
  insert into public.venue_merge_audit (source_venue_id, canonical_venue_id, candidate_id, confidence, match_reasons, merge_method, source_snapshot, canonical_snapshot_before, canonical_snapshot_after, relation_counts)
  values (p_source_venue_id, p_canonical_venue_id, p_candidate_id, p_confidence, coalesce(p_match_reasons, '{}'), p_merge_method, to_jsonb(source_row), to_jsonb(canonical_row), (select to_jsonb(v) from public.venues v where v.id = p_canonical_venue_id), relation_summary)
  on conflict (source_venue_id) do nothing;
  return jsonb_build_object('status', 'merged', 'sourceVenueId', p_source_venue_id, 'canonicalVenueId', p_canonical_venue_id, 'relations', relation_summary);
end;
$$;

create trigger venue_canonical_merge_candidates_updated_at before update on public.venue_canonical_merge_candidates
for each row execute function public.set_updated_at();

alter table public.venue_canonical_merge_candidates enable row level security;
alter table public.venue_merge_audit enable row level security;

comment on table public.venue_canonical_merge_candidates is 'Dry-run canonical Venue candidates and human review decisions.';
comment on table public.venue_merge_audit is 'Immutable audit snapshot for soft Venue canonicalization merges.';
