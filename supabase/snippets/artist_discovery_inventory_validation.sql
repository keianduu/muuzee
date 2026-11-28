-- LOCAL-only transactional validation for Order 343 Phase A.
-- Every synthetic row is rolled back at the end of this file.

begin;

do $$
declare
  source_id uuid;
  run_id uuid;
  second_run_id uuid;
  inventory_id uuid;
  second_inventory_id uuid;
  collision_artist_id uuid;
  result jsonb;
  mutation_count bigint;
  claimed_run uuid;
begin
  select id into source_id from public.data_sources where key = 'wikidata';
  if source_id is null then raise exception 'Wikidata source missing'; end if;

  insert into public.import_runs (data_source_id, operation_type, status)
  values (source_id, 'order343_local_validation', 'running') returning id into run_id;
  insert into public.import_runs (data_source_id, operation_type, status)
  values (source_id, 'order343_local_validation_resume', 'running') returning id into second_run_id;

  -- Indexed same-name and alias collisions must become review work, never an
  -- automatic cross-QID link.
  insert into public.artists (slug, name, name_en, aliases, birth_year, publication_status)
  values (
    'order343-validation-existing',
    'Order 343 Same Name',
    'Order 343 Same Name',
    array['Order 343 Alias'],
    1900,
    'draft'
  ) returning id into collision_artist_id;

  insert into public.source_records (
    data_source_id, external_id, artist_id, source_url, raw_payload, checksum
  ) values (
    source_id, 'Q990000010', collision_artist_id,
    'https://www.wikidata.org/wiki/Q990000010', '{}'::jsonb, repeat('f', 64)
  );

  insert into public.artist_discovery_inventory (data_source_id, external_id)
  values (source_id, 'Q990000001') returning id into inventory_id;

  perform public.claim_artist_discovery_inventory(source_id, run_id, 1, 300, now());
  result := public.apply_wikidata_artist_inventory_batch(
    run_id,
    jsonb_build_array(jsonb_build_object(
      'inventoryId', inventory_id,
      'externalId', 'Q990000001',
      'checksum', repeat('a', 64),
      'payload', jsonb_build_object(
        'qid', 'Q990000001',
        'normalized', jsonb_build_object(
          'qid', 'Q990000001',
          'name', 'Order 343 New Artist',
          'nameEn', 'Order 343 New Artist',
          'aliases', jsonb_build_array('New Alias'),
          'birthYear', 1950,
          'deathYear', null,
          'imageFileTitle', 'Portrait.jpg',
          'commonsCategory', 'Order 343 portraits'
        )
      )
    ))
  );
  if result ->> 'created' is distinct from '1'
    or result ->> 'imageDiscoveryExecuted' is distinct from 'false' then
    raise exception 'New Artist atomic settlement failed: %', result;
  end if;
  if not exists (
    select 1 from public.source_records sr
    join public.artist_discovery_inventory inventory
      on inventory.linked_artist_id = sr.artist_id
    where inventory.id = inventory_id
      and sr.external_id = 'Q990000001'
      and inventory.state = 'processed'
  ) then raise exception 'Canonical/source/inventory ownership mismatch'; end if;
  if not exists (
    select 1 from public.artist_field_sources provenance
    join public.artist_discovery_inventory inventory
      on inventory.linked_artist_id = provenance.artist_id
    where inventory.id = inventory_id and provenance.field_name = 'name' and provenance.is_current
  ) then raise exception 'Artist provenance missing'; end if;

  -- Reprocessing the same QID is idempotent and uses the exact source link.
  update public.artist_discovery_inventory
  set state = 'pending', processed_at = null
  where id = inventory_id;
  perform public.claim_artist_discovery_inventory(source_id, run_id, 1, 300, now());
  result := public.apply_wikidata_artist_inventory_batch(
    run_id,
    jsonb_build_array(jsonb_build_object(
      'inventoryId', inventory_id,
      'externalId', 'Q990000001',
      'checksum', repeat('b', 64),
      'payload', jsonb_build_object(
        'qid', 'Q990000001',
        'normalized', jsonb_build_object(
          'qid', 'Q990000001', 'name', 'Order 343 New Artist', 'aliases', '[]'::jsonb
        )
      )
    ))
  );
  if result ->> 'exactSource' is distinct from '1' then
    raise exception 'Exact QID idempotency failed: %', result;
  end if;
  select count(*) into mutation_count from public.artists where slug = 'artist-q990000001';
  if mutation_count <> 1 then raise exception 'Duplicate Canonical Artist created'; end if;

  -- Same-name with conflicting birth data is isolated for review and the
  -- existing Canonical/source ownership is unchanged.
  insert into public.artist_discovery_inventory (data_source_id, external_id)
  values (source_id, 'Q990000002') returning id into second_inventory_id;
  perform public.claim_artist_discovery_inventory(source_id, run_id, 1, 300, now());
  result := public.apply_wikidata_artist_inventory_batch(
    run_id,
    jsonb_build_array(jsonb_build_object(
      'inventoryId', second_inventory_id,
      'externalId', 'Q990000002',
      'checksum', repeat('c', 64),
      'payload', jsonb_build_object(
        'qid', 'Q990000002',
        'normalized', jsonb_build_object(
          'qid', 'Q990000002',
          'name', 'Order 343 Same Name',
          'aliases', jsonb_build_array('Order 343 Alias'),
          'birthYear', 1901
        )
      )
    ))
  );
  if result ->> 'review' is distinct from '1' then raise exception 'Identity collision was not isolated'; end if;
  if not exists (
    select 1 from public.artist_external_match_candidates
    where artist_id = collision_artist_id and external_id = 'Q990000002'
      and match_reasons @> '["birth year conflict"]'::jsonb
  ) then raise exception 'Birth conflict evidence missing'; end if;
  if not exists (
    select 1 from public.source_records
    where data_source_id = source_id and external_id = 'Q990000002' and artist_id is null
  ) then raise exception 'Review source should remain unlinked'; end if;
  if not exists (
    select 1 from public.source_records
    where data_source_id = source_id and external_id = 'Q990000010' and artist_id = collision_artist_id
  ) then raise exception 'Existing cross-QID source was modified'; end if;

  -- Unknown provider schemas fail closed before any mutation in the batch.
  insert into public.artist_discovery_inventory (data_source_id, external_id)
  values (source_id, 'Q990000003') returning id into inventory_id;
  insert into public.artist_discovery_inventory (data_source_id, external_id)
  values (source_id, 'Q990000004') returning id into second_inventory_id;
  perform public.claim_artist_discovery_inventory(source_id, run_id, 2, 300, now());
  begin
    perform public.apply_wikidata_artist_inventory_batch(
      run_id,
      jsonb_build_array(
        jsonb_build_object(
          'inventoryId', inventory_id,
          'externalId', 'Q990000003',
          'checksum', repeat('d', 64),
          'payload', jsonb_build_object('qid', 'Q990000003', 'normalized', jsonb_build_object('qid', 'Q990000003', 'name', 'Rollback Artist', 'aliases', '[]'::jsonb))
        ),
        jsonb_build_object(
          'inventoryId', second_inventory_id,
          'externalId', 'Q990000004',
          'checksum', repeat('e', 64),
          'payload', jsonb_build_object('unexpected', true)
        )
      )
    );
    raise exception 'Unknown provider schema unexpectedly succeeded';
  exception
    when others then
      if sqlerrm = 'Unknown provider schema unexpectedly succeeded' then raise; end if;
  end;
  if exists (
    select 1 from public.source_records
    where data_source_id = source_id and external_id in ('Q990000003', 'Q990000004')
  ) then raise exception 'Partial settlement escaped rollback'; end if;

  -- Expired leases can be reclaimed by a new active run.
  update public.artist_discovery_inventory
  set lease_expires_at = now() - interval '1 second'
  where id = inventory_id;
  perform public.claim_artist_discovery_inventory(source_id, second_run_id, 1, 300, now());
  select claimed_run_id into claimed_run
  from public.artist_discovery_inventory where id = inventory_id;
  if claimed_run is distinct from second_run_id then raise exception 'Expired lease was not reclaimed'; end if;

  perform public.release_artist_discovery_inventory_claims(run_id, 'validation cleanup', now());
  perform public.release_artist_discovery_inventory_claims(second_run_id, 'validation cleanup', now());
end;
$$;

rollback;
