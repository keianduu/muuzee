create table public.venue_discovery_inventory (
  id uuid primary key default gen_random_uuid(),
  data_source_id uuid not null references public.data_sources(id) on delete restrict,
  external_id text not null check (external_id ~ '^Q[0-9]+$'),
  discovery_root_ids text[] not null default '{}'::text[],
  state text not null default 'pending'
    check (state in ('pending', 'processing', 'processed', 'invalid')),
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
  linked_venue_id uuid references public.venues(id) on delete set null,
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

create index venue_discovery_inventory_claim_idx
  on public.venue_discovery_inventory (
    data_source_id,
    is_active,
    state,
    next_attempt_at,
    lease_expires_at,
    external_id
  );

create index venue_discovery_inventory_generation_idx
  on public.venue_discovery_inventory (data_source_id, last_seen_generation_id);

create index venue_discovery_inventory_linked_venue_idx
  on public.venue_discovery_inventory (linked_venue_id)
  where linked_venue_id is not null;

create trigger venue_discovery_inventory_updated_at
before update on public.venue_discovery_inventory
for each row execute function public.set_updated_at();

alter table public.venue_discovery_inventory enable row level security;

-- Future public objects do not inherit the earlier blanket service_role grant.
-- Discovery Inventory remains server-only: no anon/authenticated policies exist.
revoke all on table public.venue_discovery_inventory from public, anon, authenticated, service_role;
grant select, insert, update, delete on table public.venue_discovery_inventory to service_role;

create or replace function public.bootstrap_venue_discovery_inventory()
returns bigint
language plpgsql
security definer
set search_path = public
as $$
declare
  affected bigint;
begin
  insert into public.venue_discovery_inventory (
    data_source_id,
    external_id,
    discovery_root_ids,
    state,
    is_active,
    first_discovered_at,
    last_seen_at,
    linked_venue_id,
    processed_at
  )
  select
    sr.data_source_id,
    sr.external_id,
    coalesce(roots.root_ids, '{}'::text[]),
    'processed',
    true,
    sr.fetched_at,
    sr.fetched_at,
    sr.venue_id,
    sr.fetched_at
  from public.source_records sr
  join public.data_sources ds
    on ds.id = sr.data_source_id
   and ds.key = 'wikidata'
  left join lateral (
    select coalesce(array_agg(distinct root_id order by root_id), '{}'::text[]) as root_ids
    from jsonb_array_elements_text(
      case
        when jsonb_typeof(sr.raw_payload #> '{normalized,discoveryRootIds}') = 'array'
          then sr.raw_payload #> '{normalized,discoveryRootIds}'
        else '[]'::jsonb
      end
    ) root(root_id)
    where root_id ~ '^Q[0-9]+$'
  ) roots on true
  where sr.venue_id is not null
    and sr.external_id ~ '^Q[0-9]+$'
  on conflict (data_source_id, external_id) do update set
    discovery_root_ids = (
      select coalesce(array_agg(distinct root_id order by root_id), '{}'::text[])
      from unnest(
        public.venue_discovery_inventory.discovery_root_ids || excluded.discovery_root_ids
      ) root(root_id)
    ),
    state = 'processed',
    is_active = true,
    first_discovered_at = least(
      public.venue_discovery_inventory.first_discovered_at,
      excluded.first_discovered_at
    ),
    last_seen_at = greatest(
      public.venue_discovery_inventory.last_seen_at,
      excluded.last_seen_at
    ),
    claimed_run_id = null,
    lease_expires_at = null,
    next_attempt_at = null,
    last_error = null,
    linked_venue_id = excluded.linked_venue_id,
    processed_at = coalesce(
      public.venue_discovery_inventory.processed_at,
      excluded.processed_at
    );

  get diagnostics affected = row_count;
  return affected;
end;
$$;

revoke all on function public.bootstrap_venue_discovery_inventory() from public, anon, authenticated;
grant execute on function public.bootstrap_venue_discovery_inventory() to service_role;

create or replace function public.record_venue_discovery_inventory_page(
  p_data_source_id uuid,
  p_generation_id uuid,
  p_root_id text,
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
  if p_root_id !~ '^Q[0-9]+$' then
    raise exception 'Invalid discovery root ID';
  end if;

  if not exists (
    select 1
    from public.import_runs run
    where run.id = p_generation_id
      and run.data_source_id = p_data_source_id
      and run.operation_type = 'wikidata_venue_discovery_inventory'
      and run.status = 'running'
  ) then
    raise exception 'Discovery generation is not active';
  end if;

  if exists (
    select 1
    from unnest(coalesce(p_external_ids, '{}'::text[])) item(external_id)
    where external_id !~ '^Q[0-9]+$'
  ) then
    raise exception 'Invalid discovery candidate ID';
  end if;

  insert into public.venue_discovery_inventory (
    data_source_id,
    external_id,
    discovery_root_ids,
    state,
    is_active,
    first_discovered_at,
    last_seen_at,
    last_seen_generation_id
  )
  select distinct
    p_data_source_id,
    item.external_id,
    array[p_root_id],
    'pending',
    true,
    p_seen_at,
    p_seen_at,
    p_generation_id
  from unnest(coalesce(p_external_ids, '{}'::text[])) item(external_id)
  on conflict (data_source_id, external_id) do update set
    discovery_root_ids = (
      select coalesce(array_agg(distinct root_id order by root_id), '{}'::text[])
      from unnest(
        public.venue_discovery_inventory.discovery_root_ids || excluded.discovery_root_ids
      ) root(root_id)
    ),
    is_active = true,
    last_seen_at = greatest(
      public.venue_discovery_inventory.last_seen_at,
      excluded.last_seen_at
    ),
    last_seen_generation_id = excluded.last_seen_generation_id;

  get diagnostics affected = row_count;
  return affected;
end;
$$;

revoke all on function public.record_venue_discovery_inventory_page(uuid, uuid, text, text[], timestamptz) from public, anon, authenticated;
grant execute on function public.record_venue_discovery_inventory_page(uuid, uuid, text, text[], timestamptz) to service_role;

create or replace function public.complete_venue_discovery_inventory_generation(
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
    or generation.operation_type <> 'wikidata_venue_discovery_inventory'
    or generation.status <> 'running' then
    raise exception 'Discovery generation is not active';
  end if;

  update public.venue_discovery_inventory
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

  update public.venue_discovery_inventory
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

revoke all on function public.complete_venue_discovery_inventory_generation(uuid, jsonb) from public, anon, authenticated;
grant execute on function public.complete_venue_discovery_inventory_generation(uuid, jsonb) to service_role;

create or replace function public.claim_venue_discovery_inventory(
  p_data_source_id uuid,
  p_run_id uuid,
  p_limit integer default 20,
  p_lease_seconds integer default 300,
  p_now timestamptz default now()
)
returns setof public.venue_discovery_inventory
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
    raise exception 'Claim run is not active';
  end if;

  return query
  with eligible as materialized (
    select inventory.id
    from public.venue_discovery_inventory inventory
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
    limit least(greatest(coalesce(p_limit, 20), 1), 500)
  ), claimed as (
    update public.venue_discovery_inventory inventory
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

revoke all on function public.claim_venue_discovery_inventory(uuid, uuid, integer, integer, timestamptz) from public, anon, authenticated;
grant execute on function public.claim_venue_discovery_inventory(uuid, uuid, integer, integer, timestamptz) to service_role;

-- Seed the persisted queue from already-linked Wikidata evidence. The function
-- remains callable so LOCAL validation can prove that bootstrap is idempotent.
select public.bootstrap_venue_discovery_inventory();
