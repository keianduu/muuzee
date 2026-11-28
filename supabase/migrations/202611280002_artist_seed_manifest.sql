-- MVP Artist seed manifest and bounded hosted settlement.
--
-- The approved MVP scope is exhibition-evidence-led and intentionally does not
-- reuse global discovery completion, because that operation inactivates rows
-- outside the current generation.

create table public.artist_seed_manifests (
  id uuid primary key default gen_random_uuid(),
  data_source_id uuid not null references public.data_sources(id) on delete restrict,
  generation_run_id uuid not null references public.import_runs(id) on delete restrict,
  scope text not null,
  version text not null,
  checksum text not null check (checksum ~ '^[0-9a-f]{64}$'),
  item_count integer not null check (item_count between 1 and 1000),
  resolved_count integer not null default 0 check (resolved_count >= 0),
  review_count integer not null default 0 check (review_count >= 0),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (scope, version),
  unique (checksum)
);

create table public.artist_seed_manifest_items (
  manifest_id uuid not null references public.artist_seed_manifests(id) on delete cascade,
  rank integer not null check (rank between 1 and 1000),
  external_id text check (external_id is null or external_id ~ '^Q[0-9]+$'),
  identity_status text not null check (identity_status in ('qid_confirmed', 'review')),
  artist_name text not null,
  evidence jsonb not null,
  inventory_id uuid references public.artist_discovery_inventory(id) on delete set null,
  created_at timestamptz not null default now(),
  primary key (manifest_id, rank),
  check (identity_status <> 'qid_confirmed' or external_id is not null)
);

create unique index artist_seed_manifest_items_qid_uq
  on public.artist_seed_manifest_items (manifest_id, external_id)
  where external_id is not null;

alter table public.artist_seed_manifests enable row level security;
alter table public.artist_seed_manifest_items enable row level security;
revoke all on table public.artist_seed_manifests from public, anon, authenticated, service_role;
revoke all on table public.artist_seed_manifest_items from public, anon, authenticated, service_role;
grant select, insert, update, delete on table public.artist_seed_manifests to service_role;
grant select, insert, update, delete on table public.artist_seed_manifest_items to service_role;

create or replace function public.record_artist_seed_manifest(
  p_data_source_id uuid,
  p_generation_id uuid,
  p_scope text,
  p_version text,
  p_checksum text,
  p_items jsonb,
  p_metadata jsonb default '{}'::jsonb,
  p_seen_at timestamptz default now()
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_manifest_id uuid;
  resolved_count integer;
  review_count integer;
  item_count integer;
begin
  if not exists (
    select 1 from public.import_runs run
    where run.id = p_generation_id
      and run.data_source_id = p_data_source_id
      and run.operation_type = 'artist_seed_manifest_generation'
      and run.status = 'running'
  ) then
    raise exception 'Artist seed manifest generation is not active';
  end if;
  if nullif(btrim(p_scope), '') is null or nullif(btrim(p_version), '') is null
    or p_checksum !~ '^[0-9a-f]{64}$' then
    raise exception 'Artist seed manifest identity is invalid';
  end if;
  if jsonb_typeof(p_items) is distinct from 'array'
    or jsonb_array_length(p_items) < 1
    or jsonb_array_length(p_items) > 1000 then
    raise exception 'Artist seed manifest must contain 1 to 1000 items';
  end if;

  item_count := jsonb_array_length(p_items);
  if exists (
    select 1 from jsonb_array_elements(p_items) item
    where coalesce((item ->> 'rank')::integer, 0) not between 1 and item_count
      or nullif(btrim(item ->> 'name'), '') is null
      or coalesce((item ->> 'verifiedExhibitionCount')::integer, 0) < 2
      or item ->> 'identityStatus' not in ('qid_confirmed', 'review')
      or (item ->> 'identityStatus' = 'qid_confirmed' and item ->> 'qid' !~ '^Q[0-9]+$')
  ) then
    raise exception 'Artist seed manifest item is invalid';
  end if;
  if (select count(distinct (item ->> 'rank')::integer) from jsonb_array_elements(p_items) item) <> item_count
    or (select min((item ->> 'rank')::integer) from jsonb_array_elements(p_items) item) <> 1
    or (select max((item ->> 'rank')::integer) from jsonb_array_elements(p_items) item) <> item_count then
    raise exception 'Artist seed manifest ranks must be contiguous and unique';
  end if;
  if (select count(distinct item ->> 'qid') from jsonb_array_elements(p_items) item where item ->> 'qid' is not null)
    <> (select count(*) from jsonb_array_elements(p_items) item where item ->> 'qid' is not null) then
    raise exception 'Artist seed manifest QIDs must be unique';
  end if;

  select count(*) filter (where item ->> 'identityStatus' = 'qid_confirmed'),
         count(*) filter (where item ->> 'identityStatus' = 'review')
  into resolved_count, review_count
  from jsonb_array_elements(p_items) item;

  insert into public.artist_seed_manifests (
    data_source_id, generation_run_id, scope, version, checksum,
    item_count, resolved_count, review_count, metadata
  ) values (
    p_data_source_id, p_generation_id, p_scope, p_version, p_checksum,
    item_count, resolved_count, review_count, coalesce(p_metadata, '{}'::jsonb)
  )
  on conflict (scope, version) do update set
    generation_run_id = excluded.generation_run_id,
    checksum = excluded.checksum,
    item_count = excluded.item_count,
    resolved_count = excluded.resolved_count,
    review_count = excluded.review_count,
    metadata = excluded.metadata
  returning id into v_manifest_id;

  delete from public.artist_seed_manifest_items where artist_seed_manifest_items.manifest_id = v_manifest_id;

  insert into public.artist_discovery_inventory (
    data_source_id, external_id, state, is_active, first_discovered_at,
    last_seen_at, last_seen_generation_id
  )
  select distinct p_data_source_id, item ->> 'qid', 'pending', true,
    coalesce(p_seen_at, now()), coalesce(p_seen_at, now()), p_generation_id
  from jsonb_array_elements(p_items) item
  where item ->> 'identityStatus' = 'qid_confirmed'
  on conflict (data_source_id, external_id) do update set
    is_active = true,
    last_seen_at = greatest(public.artist_discovery_inventory.last_seen_at, excluded.last_seen_at),
    last_seen_generation_id = excluded.last_seen_generation_id;

  insert into public.artist_seed_manifest_items (
    manifest_id, rank, external_id, identity_status, artist_name, evidence, inventory_id
  )
  select v_manifest_id, (item ->> 'rank')::integer, item ->> 'qid',
    item ->> 'identityStatus', item ->> 'name', item,
    inventory.id
  from jsonb_array_elements(p_items) item
  left join public.artist_discovery_inventory inventory
    on inventory.data_source_id = p_data_source_id
   and inventory.external_id = item ->> 'qid';

  update public.import_runs
  set status = 'completed', finished_at = now(), metrics = coalesce(metrics, '{}'::jsonb) || jsonb_build_object(
    'manifestScope', p_scope,
    'manifestVersion', p_version,
    'manifestChecksum', p_checksum,
    'manifestCount', item_count,
    'identityConfirmed', resolved_count,
    'identityReview', review_count,
    'inventoryComplete', true,
    'unrelatedInventoryInactivated', 0
  )
  where id = p_generation_id;

  return jsonb_build_object(
    'manifestId', v_manifest_id,
    'itemCount', item_count,
    'resolvedCount', resolved_count,
    'reviewCount', review_count
  );
end;
$$;

create or replace function public.settle_wikidata_artist_inventory_batch(
  p_run_id uuid,
  p_items jsonb default '[]'::jsonb,
  p_invalid jsonb default '[]'::jsonb,
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
  valid_result jsonb := jsonb_build_object(
    'created', 0, 'exactSource', 0, 'review', 0, 'processed', 0,
    'imageDiscoveryExecuted', false
  );
  invalid_count integer := 0;
begin
  if jsonb_typeof(coalesce(p_items, '[]'::jsonb)) is distinct from 'array'
    or jsonb_typeof(coalesce(p_invalid, '[]'::jsonb)) is distinct from 'array'
    or jsonb_array_length(coalesce(p_items, '[]'::jsonb)) + jsonb_array_length(coalesce(p_invalid, '[]'::jsonb)) < 1
    or jsonb_array_length(coalesce(p_items, '[]'::jsonb)) + jsonb_array_length(coalesce(p_invalid, '[]'::jsonb)) > 100 then
    raise exception 'Artist mixed settlement must contain 1 to 100 items';
  end if;

  -- Fail closed before any write if a Wikidata source record already belongs
  -- to another entity type or any claim is not owned by this run.
  for item in
    select value from jsonb_array_elements(coalesce(p_items, '[]'::jsonb))
    union all
    select value from jsonb_array_elements(coalesce(p_invalid, '[]'::jsonb))
  loop
    select * into inventory
    from public.artist_discovery_inventory candidate
    where candidate.id = (item ->> 'inventoryId')::uuid
    for update;
    if inventory.id is null or inventory.state <> 'processing'
      or inventory.claimed_run_id is distinct from p_run_id
      or inventory.external_id is distinct from item ->> 'externalId' then
      raise exception 'Artist inventory claim ownership mismatch';
    end if;
    select * into source_record
    from public.source_records sr
    where sr.data_source_id = inventory.data_source_id
      and sr.external_id = inventory.external_id
    for update;
    if source_record.id is not null
      and num_nonnulls(source_record.exhibition_id, source_record.venue_id, source_record.work_id) > 0 then
      raise exception 'Artist source record is owned by another entity type';
    end if;
  end loop;

  if jsonb_array_length(coalesce(p_items, '[]'::jsonb)) > 0 then
    valid_result := public.apply_wikidata_artist_inventory_batch(p_run_id, p_items, p_now);
  end if;

  for item in select value from jsonb_array_elements(coalesce(p_invalid, '[]'::jsonb)) loop
    perform public.invalidate_artist_discovery_inventory_candidate(
      (item ->> 'inventoryId')::uuid,
      p_run_id,
      coalesce(nullif(item ->> 'reason', ''), 'Terminal Artist provider record'),
      p_now
    );
    invalid_count := invalid_count + 1;
  end loop;

  return valid_result || jsonb_build_object(
    'invalid', invalid_count,
    'processed', coalesce((valid_result ->> 'processed')::integer, 0) + invalid_count
  );
end;
$$;

revoke all on function public.record_artist_seed_manifest(uuid, uuid, text, text, text, jsonb, jsonb, timestamptz) from public, anon, authenticated;
revoke all on function public.settle_wikidata_artist_inventory_batch(uuid, jsonb, jsonb, timestamptz) from public, anon, authenticated;
grant execute on function public.record_artist_seed_manifest(uuid, uuid, text, text, text, jsonb, jsonb, timestamptz) to service_role;
grant execute on function public.settle_wikidata_artist_inventory_batch(uuid, jsonb, jsonb, timestamptz) to service_role;

comment on table public.artist_seed_manifests is
  'Versioned, checksummed MVP Artist selection manifests derived from documented museum exhibition participation.';
comment on table public.artist_seed_manifest_items is
  'Ranked Artist manifest evidence. QID-confirmed rows link to bounded discovery inventory; unresolved identity remains explicit review evidence.';
comment on function public.record_artist_seed_manifest(uuid, uuid, text, text, text, jsonb, jsonb, timestamptz) is
  'Persists one complete selected Artist manifest without inactivating any unrelated discovery inventory.';
comment on function public.settle_wikidata_artist_inventory_batch(uuid, jsonb, jsonb, timestamptz) is
  'Atomically settles valid and terminal-invalid Artist claims after claim and cross-entity source ownership validation.';
