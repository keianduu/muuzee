-- Artist Discovery Inventory foundation.
--
-- The global Visual Artist scope is substantially larger than Venue discovery,
-- so identity lookup and settlement must remain indexed, bounded, resumable,
-- and independent from image discovery.

create or replace function public.normalize_artist_search_key(p_value text)
returns text
language sql
immutable
parallel safe
as $$
  select nullif(
    lower(regexp_replace(btrim(normalize(coalesce(p_value, ''), NFKC)), '[[:space:]・._-]+', '', 'g')),
    ''
  );
$$;

create table public.artist_search_keys (
  artist_id uuid not null references public.artists(id) on delete cascade,
  key_type text not null check (key_type in ('name', 'name_en', 'alias')),
  normalized_value text not null,
  source_value text not null,
  created_at timestamptz not null default now(),
  primary key (artist_id, key_type, normalized_value)
);

create index artist_search_keys_lookup_idx
  on public.artist_search_keys (normalized_value, key_type, artist_id);

create or replace function public.refresh_artist_search_keys()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  alias_value text;
begin
  delete from public.artist_search_keys where artist_id = new.id;

  insert into public.artist_search_keys (artist_id, key_type, normalized_value, source_value)
  select new.id, 'name', public.normalize_artist_search_key(new.name), new.name
  where public.normalize_artist_search_key(new.name) is not null
  on conflict do nothing;

  insert into public.artist_search_keys (artist_id, key_type, normalized_value, source_value)
  select new.id, 'name_en', public.normalize_artist_search_key(new.name_en), new.name_en
  where public.normalize_artist_search_key(new.name_en) is not null
  on conflict do nothing;

  foreach alias_value in array coalesce(new.aliases, '{}'::text[]) loop
    insert into public.artist_search_keys (artist_id, key_type, normalized_value, source_value)
    select new.id, 'alias', public.normalize_artist_search_key(alias_value), alias_value
    where public.normalize_artist_search_key(alias_value) is not null
    on conflict do nothing;
  end loop;
  return new;
end;
$$;

create trigger artists_refresh_search_keys
after insert or update of name, name_en, aliases
on public.artists for each row execute function public.refresh_artist_search_keys();

insert into public.artist_search_keys (artist_id, key_type, normalized_value, source_value)
select id, 'name', public.normalize_artist_search_key(name), name
from public.artists
where public.normalize_artist_search_key(name) is not null
on conflict do nothing;

insert into public.artist_search_keys (artist_id, key_type, normalized_value, source_value)
select id, 'name_en', public.normalize_artist_search_key(name_en), name_en
from public.artists
where public.normalize_artist_search_key(name_en) is not null
on conflict do nothing;

insert into public.artist_search_keys (artist_id, key_type, normalized_value, source_value)
select artist.id, 'alias', public.normalize_artist_search_key(alias_value), alias_value
from public.artists artist cross join lateral unnest(artist.aliases) alias_value
where public.normalize_artist_search_key(alias_value) is not null
on conflict do nothing;

create table public.artist_discovery_inventory (
  id uuid primary key default gen_random_uuid(),
  data_source_id uuid not null references public.data_sources(id) on delete restrict,
  external_id text not null check (external_id ~ '^Q[0-9]+$'),
  state text not null default 'pending'
    check (state in ('pending', 'processing', 'processed', 'review', 'invalid')),
  is_active boolean not null default true,
  first_discovered_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  last_seen_generation_id uuid references public.import_runs(id) on delete set null,
  claimed_run_id uuid references public.import_runs(id) on delete set null,
  lease_expires_at timestamptz,
  attempt_count integer not null default 0 check (attempt_count >= 0),
  last_attempt_at timestamptz,
  next_attempt_at timestamptz,
  last_error text,
  linked_artist_id uuid references public.artists(id) on delete set null,
  processed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (data_source_id, external_id),
  check (
    (state = 'processing' and claimed_run_id is not null and lease_expires_at is not null)
    or
    (state <> 'processing' and claimed_run_id is null and lease_expires_at is null)
  )
);

create index artist_discovery_inventory_claim_idx
  on public.artist_discovery_inventory (
    data_source_id,
    is_active,
    state,
    next_attempt_at,
    lease_expires_at,
    external_id
  );

create index artist_discovery_inventory_generation_idx
  on public.artist_discovery_inventory (data_source_id, last_seen_generation_id);

create index artist_discovery_inventory_linked_artist_idx
  on public.artist_discovery_inventory (linked_artist_id)
  where linked_artist_id is not null;

create trigger artist_discovery_inventory_updated_at
before update on public.artist_discovery_inventory
for each row execute function public.set_updated_at();

alter table public.artist_search_keys enable row level security;
alter table public.artist_discovery_inventory enable row level security;

revoke all on table public.artist_search_keys from public, anon, authenticated, service_role;
revoke all on table public.artist_discovery_inventory from public, anon, authenticated, service_role;
grant select, insert, update, delete on table public.artist_search_keys to service_role;
grant select, insert, update, delete on table public.artist_discovery_inventory to service_role;

create or replace function public.bootstrap_artist_discovery_inventory()
returns bigint
language plpgsql
security definer
set search_path = public
as $$
declare
  affected bigint;
begin
  insert into public.artist_discovery_inventory (
    data_source_id,
    external_id,
    state,
    is_active,
    first_discovered_at,
    last_seen_at,
    linked_artist_id,
    processed_at
  )
  select
    sr.data_source_id,
    sr.external_id,
    'processed',
    true,
    sr.fetched_at,
    sr.fetched_at,
    sr.artist_id,
    sr.fetched_at
  from public.source_records sr
  join public.data_sources ds
    on ds.id = sr.data_source_id
   and ds.key = 'wikidata'
  where sr.artist_id is not null
    and sr.external_id ~ '^Q[0-9]+$'
  on conflict (data_source_id, external_id) do update set
    state = 'processed',
    is_active = true,
    first_discovered_at = least(
      public.artist_discovery_inventory.first_discovered_at,
      excluded.first_discovered_at
    ),
    last_seen_at = greatest(
      public.artist_discovery_inventory.last_seen_at,
      excluded.last_seen_at
    ),
    claimed_run_id = null,
    lease_expires_at = null,
    next_attempt_at = null,
    last_error = null,
    linked_artist_id = excluded.linked_artist_id,
    processed_at = coalesce(
      public.artist_discovery_inventory.processed_at,
      excluded.processed_at
    );

  get diagnostics affected = row_count;
  return affected;
end;
$$;

create or replace function public.record_artist_discovery_inventory_page(
  p_data_source_id uuid,
  p_generation_id uuid,
  p_external_ids text[],
  p_seen_at timestamptz default now()
)
returns bigint
language plpgsql
security definer
set search_path = public
as $$
declare
  affected bigint;
begin
  if not exists (
    select 1
    from public.import_runs run
    where run.id = p_generation_id
      and run.data_source_id = p_data_source_id
      and run.operation_type = 'wikidata_artist_discovery_inventory'
      and run.status = 'running'
  ) then
    raise exception 'Artist discovery generation is not active';
  end if;

  if exists (
    select 1
    from unnest(coalesce(p_external_ids, '{}'::text[])) item(external_id)
    where external_id !~ '^Q[0-9]+$'
  ) then
    raise exception 'Invalid Artist discovery candidate ID';
  end if;

  insert into public.artist_discovery_inventory (
    data_source_id,
    external_id,
    state,
    is_active,
    first_discovered_at,
    last_seen_at,
    last_seen_generation_id
  )
  select distinct
    p_data_source_id,
    item.external_id,
    'pending',
    true,
    p_seen_at,
    p_seen_at,
    p_generation_id
  from unnest(coalesce(p_external_ids, '{}'::text[])) item(external_id)
  on conflict (data_source_id, external_id) do update set
    is_active = true,
    last_seen_at = greatest(
      public.artist_discovery_inventory.last_seen_at,
      excluded.last_seen_at
    ),
    last_seen_generation_id = excluded.last_seen_generation_id;

  get diagnostics affected = row_count;
  return affected;
end;
$$;

create or replace function public.complete_artist_discovery_inventory_generation(
  p_generation_id uuid,
  p_metrics jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  generation public.import_runs%rowtype;
  inactivated_count bigint;
  reopened_count bigint;
begin
  select * into generation
  from public.import_runs
  where id = p_generation_id
  for update;

  if generation.id is null
    or generation.operation_type <> 'wikidata_artist_discovery_inventory'
    or generation.status <> 'running' then
    raise exception 'Artist discovery generation is not active';
  end if;

  if p_metrics is null
    or jsonb_typeof(p_metrics) <> 'object'
    or not (p_metrics @> '{"inventoryComplete": true}'::jsonb)
    or p_metrics -> 'roots' is distinct from '["Q3391743"]'::jsonb
    or p_metrics -> 'completedRoots' is distinct from '["Q3391743"]'::jsonb
    or jsonb_typeof(p_metrics -> 'rootIndex') is distinct from 'number'
    or p_metrics ->> 'rootIndex' is distinct from '1' then
    raise exception 'Artist discovery generation completion evidence is incomplete';
  end if;

  update public.artist_discovery_inventory
  set
    state = 'pending',
    claimed_run_id = null,
    lease_expires_at = null,
    next_attempt_at = null,
    last_error = null,
    processed_at = null
  where data_source_id = generation.data_source_id
    and last_seen_generation_id = p_generation_id
    and state = 'invalid';
  get diagnostics reopened_count = row_count;

  update public.artist_discovery_inventory
  set is_active = false
  where data_source_id = generation.data_source_id
    and is_active = true
    and last_seen_generation_id is distinct from p_generation_id;
  get diagnostics inactivated_count = row_count;

  update public.import_runs
  set
    status = 'completed',
    metrics = coalesce(metrics, '{}'::jsonb) || coalesce(p_metrics, '{}'::jsonb) || jsonb_build_object(
      'inactivatedCount', inactivated_count,
      'reopenedInvalidCount', reopened_count,
      'inventoryComplete', true
    ),
    finished_at = now()
  where id = p_generation_id;

  return jsonb_build_object(
    'inactivatedCount', inactivated_count,
    'reopenedInvalidCount', reopened_count
  );
end;
$$;

create or replace function public.claim_artist_discovery_inventory(
  p_data_source_id uuid,
  p_run_id uuid,
  p_limit integer default 50,
  p_lease_seconds integer default 300,
  p_now timestamptz default now()
)
returns setof public.artist_discovery_inventory
language plpgsql
security definer
set search_path = public
as $$
declare
  effective_now timestamptz := coalesce(p_now, now());
begin
  if not exists (
    select 1
    from public.import_runs run
    where run.id = p_run_id
      and run.data_source_id = p_data_source_id
      and run.status = 'running'
  ) then
    raise exception 'Artist claim run is not active';
  end if;

  return query
  with eligible as materialized (
    select inventory.id
    from public.artist_discovery_inventory inventory
    where inventory.data_source_id = p_data_source_id
      and inventory.is_active = true
      and (
        (
          inventory.state = 'pending'
          and (inventory.next_attempt_at is null or inventory.next_attempt_at <= effective_now)
        )
        or
        (
          inventory.state = 'processing'
          and inventory.lease_expires_at <= effective_now
        )
      )
    order by substring(inventory.external_id from 2)::numeric, inventory.external_id, inventory.id
    for update skip locked
    limit least(greatest(coalesce(p_limit, 50), 1), 100)
  ), claimed as (
    update public.artist_discovery_inventory inventory
    set
      state = 'processing',
      claimed_run_id = p_run_id,
      lease_expires_at = effective_now + make_interval(secs => least(greatest(coalesce(p_lease_seconds, 300), 1), 3600)),
      attempt_count = inventory.attempt_count + 1,
      last_attempt_at = effective_now,
      next_attempt_at = null,
      last_error = null
    from eligible
    where inventory.id = eligible.id
    returning inventory.*
  )
  select * from claimed
  order by substring(claimed.external_id from 2)::numeric, claimed.external_id, claimed.id;
end;
$$;

create or replace function public.apply_wikidata_artist_inventory_batch(
  p_run_id uuid,
  p_items jsonb,
  p_now timestamptz default now()
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  item jsonb;
  inventory public.artist_discovery_inventory%rowtype;
  source_record public.source_records%rowtype;
  normalized_payload jsonb;
  inventory_id uuid;
  qid text;
  checksum_value text;
  effective_now timestamptz := coalesce(p_now, now());
  incoming_keys text[];
  candidate_ids uuid[];
  candidate_id uuid;
  settled_artist_id uuid;
  field_row record;
  created_count integer := 0;
  exact_count integer := 0;
  review_count integer := 0;
begin
  if jsonb_typeof(p_items) is distinct from 'array'
    or jsonb_array_length(p_items) < 1
    or jsonb_array_length(p_items) > 100 then
    raise exception 'Artist settlement batch must contain 1 to 100 items';
  end if;

  -- Validate every claim and provider envelope before performing the first
  -- mutation. Any later failure still rolls the whole SQL call back.
  for item in select value from jsonb_array_elements(p_items) loop
    begin
      inventory_id := (item ->> 'inventoryId')::uuid;
    exception when others then
      raise exception 'Artist settlement inventory ID is invalid';
    end;
    qid := item ->> 'externalId';
    checksum_value := item ->> 'checksum';
    normalized_payload := item #> '{payload,normalized}';

    select * into inventory
    from public.artist_discovery_inventory candidate
    where candidate.id = inventory_id
    for update;

    if inventory.id is null
      or inventory.state <> 'processing'
      or inventory.claimed_run_id is distinct from p_run_id then
      raise exception 'Artist inventory claim ownership mismatch';
    end if;
    if qid !~ '^Q[0-9]+$' or qid is distinct from inventory.external_id then
      raise exception 'Artist settlement QID mismatch';
    end if;
    if checksum_value is null or checksum_value !~ '^[0-9a-f]{64}$' then
      raise exception 'Artist settlement checksum is invalid';
    end if;
    if jsonb_typeof(item -> 'payload') is distinct from 'object'
      or jsonb_typeof(normalized_payload) is distinct from 'object'
      or nullif(btrim(normalized_payload ->> 'name'), '') is null
      or normalized_payload ->> 'qid' is distinct from qid
      or (
        normalized_payload ? 'aliases'
        and jsonb_typeof(normalized_payload -> 'aliases') is distinct from 'array'
      ) then
      raise exception 'Artist provider payload schema is invalid';
    end if;
  end loop;

  for item in select value from jsonb_array_elements(p_items) loop
    inventory_id := (item ->> 'inventoryId')::uuid;
    qid := item ->> 'externalId';
    checksum_value := item ->> 'checksum';
    normalized_payload := item #> '{payload,normalized}';

    select * into inventory
    from public.artist_discovery_inventory candidate
    where candidate.id = inventory_id
    for update;

    select sr.* into source_record
    from public.source_records sr
    where sr.data_source_id = inventory.data_source_id
      and sr.external_id = qid
    for update;

    if source_record.artist_id is not null then
      update public.source_records
      set
        source_url = 'https://www.wikidata.org/wiki/' || qid,
        raw_payload = item -> 'payload',
        checksum = checksum_value,
        fetched_at = effective_now
      where id = source_record.id;

      update public.artist_discovery_inventory
      set
        state = 'processed',
        claimed_run_id = null,
        lease_expires_at = null,
        next_attempt_at = null,
        last_error = null,
        linked_artist_id = source_record.artist_id,
        processed_at = effective_now
      where id = inventory_id;
      exact_count := exact_count + 1;
      continue;
    end if;

    select coalesce(array_agg(distinct key_value), '{}'::text[])
    into incoming_keys
    from (
      select public.normalize_artist_search_key(normalized_payload ->> 'name') as key_value
      union all
      select public.normalize_artist_search_key(normalized_payload ->> 'nameEn')
      union all
      select public.normalize_artist_search_key(alias_value)
      from jsonb_array_elements_text(coalesce(normalized_payload -> 'aliases', '[]'::jsonb)) alias(alias_value)
    ) keys
    where key_value is not null;

    select coalesce(array_agg(distinct search_key.artist_id), '{}'::uuid[])
    into candidate_ids
    from public.artist_search_keys search_key
    where search_key.normalized_value = any(incoming_keys);

    if cardinality(candidate_ids) > 0 then
      insert into public.source_records (
        data_source_id,
        external_id,
        artist_id,
        source_url,
        raw_payload,
        checksum,
        fetched_at
      ) values (
        inventory.data_source_id,
        qid,
        null,
        'https://www.wikidata.org/wiki/' || qid,
        item -> 'payload',
        checksum_value,
        effective_now
      )
      on conflict (data_source_id, external_id) do update set
        source_url = excluded.source_url,
        raw_payload = excluded.raw_payload,
        checksum = excluded.checksum,
        fetched_at = excluded.fetched_at;

      foreach candidate_id in array candidate_ids loop
        insert into public.artist_external_match_candidates (
          artist_id,
          provider,
          external_id,
          label_ja,
          label_en,
          birth_year,
          confidence,
          match_reasons,
          status,
          raw_payload,
          last_seen_at
        )
        select
          artist.id,
          'wikidata',
          qid,
          normalized_payload ->> 'name',
          nullif(normalized_payload ->> 'nameEn', ''),
          nullif(normalized_payload ->> 'birthYear', '')::integer,
          case
            when artist.birth_year is not null
              and normalized_payload ->> 'birthYear' is not null
              and artist.birth_year <> (normalized_payload ->> 'birthYear')::integer then 0.1
            when artist.death_year is not null
              and normalized_payload ->> 'deathYear' is not null
              and artist.death_year <> (normalized_payload ->> 'deathYear')::integer then 0.1
            else 0.5
          end,
          jsonb_build_array(
            'indexed name or alias collision; human identity review required',
            case
              when artist.birth_year is not null
                and normalized_payload ->> 'birthYear' is not null
                and artist.birth_year <> (normalized_payload ->> 'birthYear')::integer
                then 'birth year conflict'
              when artist.death_year is not null
                and normalized_payload ->> 'deathYear' is not null
                and artist.death_year <> (normalized_payload ->> 'deathYear')::integer
                then 'death year conflict'
              else 'no automatic cross-QID link'
            end
          ),
          'candidate',
          item -> 'payload',
          effective_now
        from public.artists artist
        where artist.id = candidate_id
        on conflict (artist_id, provider, external_id) do update set
          label_ja = excluded.label_ja,
          label_en = excluded.label_en,
          birth_year = excluded.birth_year,
          confidence = excluded.confidence,
          match_reasons = excluded.match_reasons,
          raw_payload = excluded.raw_payload,
          last_seen_at = excluded.last_seen_at;
      end loop;

      update public.artist_discovery_inventory
      set
        state = 'review',
        claimed_run_id = null,
        lease_expires_at = null,
        next_attempt_at = null,
        last_error = 'Indexed identity collision requires human review',
        linked_artist_id = null,
        processed_at = effective_now
      where id = inventory_id;
      review_count := review_count + 1;
      continue;
    end if;

    insert into public.artists (
      slug,
      name,
      name_en,
      name_native,
      aliases,
      birth_date,
      birth_year,
      death_date,
      death_year,
      nationality_country_code,
      birth_country_code,
      birth_place,
      official_url,
      publication_status
    ) values (
      'artist-' || lower(qid),
      normalized_payload ->> 'name',
      nullif(normalized_payload ->> 'nameEn', ''),
      nullif(normalized_payload ->> 'nameNative', ''),
      coalesce(
        array(select jsonb_array_elements_text(coalesce(normalized_payload -> 'aliases', '[]'::jsonb))),
        '{}'::text[]
      ),
      nullif(normalized_payload ->> 'birthDate', '')::date,
      nullif(normalized_payload ->> 'birthYear', '')::integer,
      nullif(normalized_payload ->> 'deathDate', '')::date,
      nullif(normalized_payload ->> 'deathYear', '')::integer,
      nullif(normalized_payload ->> 'nationalityCountryCode', ''),
      nullif(normalized_payload ->> 'birthCountryCode', ''),
      nullif(normalized_payload ->> 'birthPlace', ''),
      nullif(normalized_payload ->> 'officialUrl', ''),
      'draft'
    ) returning id into settled_artist_id;

    insert into public.source_records (
      data_source_id,
      external_id,
      artist_id,
      source_url,
      raw_payload,
      checksum,
      fetched_at
    ) values (
      inventory.data_source_id,
      qid,
      settled_artist_id,
      'https://www.wikidata.org/wiki/' || qid,
      item -> 'payload',
      checksum_value,
      effective_now
    )
    on conflict (data_source_id, external_id) do update set
      artist_id = excluded.artist_id,
      source_url = excluded.source_url,
      raw_payload = excluded.raw_payload,
      checksum = excluded.checksum,
      fetched_at = excluded.fetched_at
    returning * into source_record;

    for field_row in
      select field_name, field_value
      from jsonb_each(jsonb_build_object(
        'name', to_jsonb(normalized_payload ->> 'name'),
        'name_en', normalized_payload -> 'nameEn',
        'name_native', normalized_payload -> 'nameNative',
        'aliases', normalized_payload -> 'aliases',
        'birth_date', normalized_payload -> 'birthDate',
        'birth_year', normalized_payload -> 'birthYear',
        'death_date', normalized_payload -> 'deathDate',
        'death_year', normalized_payload -> 'deathYear',
        'nationality_country_code', normalized_payload -> 'nationalityCountryCode',
        'birth_country_code', normalized_payload -> 'birthCountryCode',
        'birth_place', normalized_payload -> 'birthPlace',
        'official_url', normalized_payload -> 'officialUrl'
      )) fields(field_name, field_value)
      where field_value is not null and field_value <> 'null'::jsonb
        and field_value <> '""'::jsonb and field_value <> '[]'::jsonb
    loop
      insert into public.artist_field_sources (
        artist_id,
        field_name,
        source,
        source_url,
        source_record_id,
        value_snapshot,
        generated_by_ai,
        review_status,
        is_current
      ) values (
        settled_artist_id,
        field_row.field_name,
        'wikidata',
        'https://www.wikidata.org/wiki/' || qid,
        source_record.id,
        field_row.field_value,
        false,
        'applied',
        true
      );
    end loop;

    update public.artist_discovery_inventory
    set
      state = 'processed',
      claimed_run_id = null,
      lease_expires_at = null,
      next_attempt_at = null,
      last_error = null,
      linked_artist_id = settled_artist_id,
      processed_at = effective_now
    where id = inventory_id;
    created_count := created_count + 1;
  end loop;

  return jsonb_build_object(
    'created', created_count,
    'exactSource', exact_count,
    'review', review_count,
    'processed', created_count + exact_count + review_count,
    'imageDiscoveryExecuted', false
  );
end;
$$;

create or replace function public.invalidate_artist_discovery_inventory_candidate(
  p_inventory_id uuid,
  p_run_id uuid,
  p_reason text,
  p_now timestamptz default now()
)
returns public.artist_discovery_inventory
language plpgsql
security definer
set search_path = public
as $$
declare
  settled public.artist_discovery_inventory%rowtype;
begin
  update public.artist_discovery_inventory inventory
  set
    state = 'invalid',
    claimed_run_id = null,
    lease_expires_at = null,
    next_attempt_at = null,
    last_error = left(coalesce(nullif(btrim(p_reason), ''), 'Invalid Artist provider record'), 500),
    processed_at = coalesce(p_now, now())
  where inventory.id = p_inventory_id
    and inventory.state = 'processing'
    and inventory.claimed_run_id = p_run_id
  returning inventory.* into settled;

  if settled.id is null then
    raise exception 'Artist inventory claim ownership mismatch';
  end if;
  return settled;
end;
$$;

create or replace function public.retry_artist_discovery_inventory_candidate(
  p_inventory_id uuid,
  p_run_id uuid,
  p_error text,
  p_now timestamptz default now()
)
returns public.artist_discovery_inventory
language plpgsql
security definer
set search_path = public
as $$
declare
  settled public.artist_discovery_inventory%rowtype;
  effective_now timestamptz := coalesce(p_now, now());
begin
  update public.artist_discovery_inventory inventory
  set
    state = 'pending',
    claimed_run_id = null,
    lease_expires_at = null,
    next_attempt_at = effective_now + case
      when inventory.attempt_count <= 1 then interval '1 minute'
      when inventory.attempt_count = 2 then interval '5 minutes'
      when inventory.attempt_count = 3 then interval '30 minutes'
      else interval '60 minutes'
    end,
    last_error = left(coalesce(nullif(btrim(p_error), ''), 'Transient Artist inventory failure'), 500),
    processed_at = null
  where inventory.id = p_inventory_id
    and inventory.state = 'processing'
    and inventory.claimed_run_id = p_run_id
  returning inventory.* into settled;

  if settled.id is null then
    raise exception 'Artist inventory claim ownership mismatch';
  end if;
  return settled;
end;
$$;

create or replace function public.release_artist_discovery_inventory_claims(
  p_run_id uuid,
  p_error text,
  p_now timestamptz default now()
)
returns bigint
language plpgsql
security definer
set search_path = public
as $$
declare
  affected bigint;
  effective_now timestamptz := coalesce(p_now, now());
begin
  update public.artist_discovery_inventory inventory
  set
    state = 'pending',
    claimed_run_id = null,
    lease_expires_at = null,
    next_attempt_at = effective_now + case
      when inventory.attempt_count <= 1 then interval '1 minute'
      when inventory.attempt_count = 2 then interval '5 minutes'
      when inventory.attempt_count = 3 then interval '30 minutes'
      else interval '60 minutes'
    end,
    last_error = left(coalesce(nullif(btrim(p_error), ''), 'Controlled Artist importer interruption'), 500),
    processed_at = null
  where inventory.state = 'processing'
    and inventory.claimed_run_id = p_run_id;

  get diagnostics affected = row_count;
  return affected;
end;
$$;

revoke all on function public.bootstrap_artist_discovery_inventory() from public, anon, authenticated;
revoke all on function public.record_artist_discovery_inventory_page(uuid, uuid, text[], timestamptz) from public, anon, authenticated;
revoke all on function public.complete_artist_discovery_inventory_generation(uuid, jsonb) from public, anon, authenticated;
revoke all on function public.claim_artist_discovery_inventory(uuid, uuid, integer, integer, timestamptz) from public, anon, authenticated;
revoke all on function public.apply_wikidata_artist_inventory_batch(uuid, jsonb, timestamptz) from public, anon, authenticated;
revoke all on function public.invalidate_artist_discovery_inventory_candidate(uuid, uuid, text, timestamptz) from public, anon, authenticated;
revoke all on function public.retry_artist_discovery_inventory_candidate(uuid, uuid, text, timestamptz) from public, anon, authenticated;
revoke all on function public.release_artist_discovery_inventory_claims(uuid, text, timestamptz) from public, anon, authenticated;

grant execute on function public.bootstrap_artist_discovery_inventory() to service_role;
grant execute on function public.record_artist_discovery_inventory_page(uuid, uuid, text[], timestamptz) to service_role;
grant execute on function public.complete_artist_discovery_inventory_generation(uuid, jsonb) to service_role;
grant execute on function public.claim_artist_discovery_inventory(uuid, uuid, integer, integer, timestamptz) to service_role;
grant execute on function public.apply_wikidata_artist_inventory_batch(uuid, jsonb, timestamptz) to service_role;
grant execute on function public.invalidate_artist_discovery_inventory_candidate(uuid, uuid, text, timestamptz) to service_role;
grant execute on function public.retry_artist_discovery_inventory_candidate(uuid, uuid, text, timestamptz) to service_role;
grant execute on function public.release_artist_discovery_inventory_claims(uuid, text, timestamptz) to service_role;

comment on table public.artist_search_keys is
  'Indexed Artist identity collision keys. Matching keys create review work and never authorize cross-QID auto-linking.';
comment on table public.artist_discovery_inventory is
  'Persisted, resumable Wikidata Visual Artist inventory. Review is a terminal operator state, distinct from invalid provider data.';
comment on function public.apply_wikidata_artist_inventory_batch(uuid, jsonb, timestamptz) is
  'Atomically settles a claimed Artist batch. Exact QID links are authoritative; name or alias collisions are isolated for review; image discovery is excluded.';

select public.bootstrap_artist_discovery_inventory();
