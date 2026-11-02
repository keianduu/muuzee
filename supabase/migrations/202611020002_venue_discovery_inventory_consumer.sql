create or replace function public.process_venue_discovery_inventory_candidate(
  p_inventory_id uuid,
  p_run_id uuid,
  p_linked_venue_id uuid default null,
  p_now timestamptz default now()
)
returns public.venue_discovery_inventory
language plpgsql
security definer
set search_path = public
as $$
declare
  settled public.venue_discovery_inventory%rowtype;
begin
  update public.venue_discovery_inventory inventory
  set
    state = 'processed',
    claimed_run_id = null,
    lease_expires_at = null,
    next_attempt_at = null,
    last_error = null,
    linked_venue_id = p_linked_venue_id,
    processed_at = coalesce(p_now, now())
  where inventory.id = p_inventory_id
    and inventory.state = 'processing'
    and inventory.claimed_run_id = p_run_id
  returning inventory.* into settled;

  if settled.id is null then
    raise exception 'Inventory claim ownership mismatch';
  end if;

  return settled;
end;
$$;

revoke all on function public.process_venue_discovery_inventory_candidate(uuid, uuid, uuid, timestamptz)
  from public, anon, authenticated, service_role;
grant execute on function public.process_venue_discovery_inventory_candidate(uuid, uuid, uuid, timestamptz)
  to service_role;

create or replace function public.invalidate_venue_discovery_inventory_candidate(
  p_inventory_id uuid,
  p_run_id uuid,
  p_reason text,
  p_now timestamptz default now()
)
returns public.venue_discovery_inventory
language plpgsql
security definer
set search_path = public
as $$
declare
  settled public.venue_discovery_inventory%rowtype;
begin
  update public.venue_discovery_inventory inventory
  set
    state = 'invalid',
    claimed_run_id = null,
    lease_expires_at = null,
    next_attempt_at = null,
    last_error = left(coalesce(nullif(btrim(p_reason), ''), 'Candidate is no longer a valid Japan Venue'), 500),
    processed_at = coalesce(p_now, now())
  where inventory.id = p_inventory_id
    and inventory.state = 'processing'
    and inventory.claimed_run_id = p_run_id
  returning inventory.* into settled;

  if settled.id is null then
    raise exception 'Inventory claim ownership mismatch';
  end if;

  return settled;
end;
$$;

revoke all on function public.invalidate_venue_discovery_inventory_candidate(uuid, uuid, text, timestamptz)
  from public, anon, authenticated, service_role;
grant execute on function public.invalidate_venue_discovery_inventory_candidate(uuid, uuid, text, timestamptz)
  to service_role;

create or replace function public.retry_venue_discovery_inventory_candidate(
  p_inventory_id uuid,
  p_run_id uuid,
  p_error text,
  p_now timestamptz default now()
)
returns public.venue_discovery_inventory
language plpgsql
security definer
set search_path = public
as $$
declare
  settled public.venue_discovery_inventory%rowtype;
  effective_now timestamptz := coalesce(p_now, now());
begin
  update public.venue_discovery_inventory inventory
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
    last_error = left(coalesce(nullif(btrim(p_error), ''), 'Transient inventory processing failure'), 500),
    processed_at = null
  where inventory.id = p_inventory_id
    and inventory.state = 'processing'
    and inventory.claimed_run_id = p_run_id
  returning inventory.* into settled;

  if settled.id is null then
    raise exception 'Inventory claim ownership mismatch';
  end if;

  return settled;
end;
$$;

revoke all on function public.retry_venue_discovery_inventory_candidate(uuid, uuid, text, timestamptz)
  from public, anon, authenticated, service_role;
grant execute on function public.retry_venue_discovery_inventory_candidate(uuid, uuid, text, timestamptz)
  to service_role;

create or replace function public.release_venue_discovery_inventory_claims(
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
  update public.venue_discovery_inventory inventory
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
    last_error = left(coalesce(nullif(btrim(p_error), ''), 'Controlled importer interruption'), 500),
    processed_at = null
  where inventory.state = 'processing'
    and inventory.claimed_run_id = p_run_id;

  get diagnostics affected = row_count;
  return affected;
end;
$$;

revoke all on function public.release_venue_discovery_inventory_claims(uuid, text, timestamptz)
  from public, anon, authenticated, service_role;
grant execute on function public.release_venue_discovery_inventory_claims(uuid, text, timestamptz)
  to service_role;
