-- Order 342 guarded Production repair plan.
--
-- IMPORTANT: This artifact is intentionally unexecuted. It is prepared for a
-- separate Human-approved Production apply step after pre-repair review.
-- Target project: lqinmolonctddovltujy
-- Expected delta: venues +1, venue_field_sources +11, match candidates +1.
-- Source records and Inventory totals/states remain unchanged; publication and
-- media remain unchanged.

begin;

do $repair$
declare
  original_venue_id constant uuid := '1e3178be-3cac-4ce0-8bc9-3e22cf98530c';
  new_venue_id constant uuid := 'd8a2abb8-1ccc-455d-a997-a119447ea525';
  q11511727_source_id constant uuid := 'b449534d-9944-4cf4-a5e7-cd731d09b7f2';
  q11511731_source_id constant uuid := 'f1907a73-83ac-4801-a0f7-48f0ca8714a8';
  q11511727_inventory_id constant uuid := '7cd42ce8-e949-4070-bc31-2fd9ded25145';
  q11511731_inventory_id constant uuid := '77df0900-2efd-4441-bf57-0566347705c2';
  wrong_candidate_id constant uuid := '5aa8e617-325b-408b-acf9-18bbc71d8e69';
  restore_fields constant text[] := array[
    'name', 'name_en', 'venue_type', 'country_code', 'region',
    'latitude', 'longitude', 'official_url', 'inception_year'
  ];
  q11511727_source public.source_records%rowtype;
  q11511731_source public.source_records%rowtype;
  original_venue public.venues%rowtype;
  q11511727_normalized jsonb;
  q11511731_normalized jsonb;
  restored_values jsonb;
  affected integer;
begin
  -- All guards run before the first mutation. Any mismatch aborts the entire
  -- transaction so the artifact cannot silently target a changed Production state.
  select * into q11511727_source
  from public.source_records
  where id = q11511727_source_id
    and external_id = 'Q11511727'
    and venue_id = original_venue_id
    and checksum = 'c37bbc65fd8fefa3a439b218c648d08469ec4795e02e75634cfa165aed92f80a';
  if not found then raise exception 'Guard failed: Q11511727 source record changed'; end if;

  select * into q11511731_source
  from public.source_records
  where id = q11511731_source_id
    and external_id = 'Q11511731'
    and venue_id = original_venue_id
    and checksum = '5f11598d628d9346a7b4f6425b4564f63f6931b939a15205875ca7749484fe25';
  if not found then raise exception 'Guard failed: Q11511731 source record changed'; end if;

  if (select count(*) from public.source_records where external_id = 'Q11511731') <> 1 then
    raise exception 'Guard failed: unexpected Q11511731 source record cardinality';
  end if;

  select * into original_venue from public.venues where id = original_venue_id;
  if not found
    or original_venue.slug <> '旭川市博物館-q11511727'
    or original_venue.name <> '旭川市大雪クリスタルホール'
    or original_venue.name_en is distinct from 'Asahikawa Taisetsu Crystal Hall'
    or original_venue.aliases is distinct from array['旭川市博物館','旭川市音楽堂','旭川市国際会議場','大雪クリスタルホール','Taisetsu Crystal Hall']::text[]
    or original_venue.postal_code is distinct from '070-8003'
    or original_venue.latitude is distinct from 43.759722222222
    or original_venue.longitude is distinct from 142.35083333333
    or original_venue.official_url is distinct from 'https://www.city.asahikawa.hokkaido.jp/kurashi/329/348/357/'
    or original_venue.inception_year is distinct from 1993
    or original_venue.wikidata_match_status <> 'matched'
    or original_venue.wikidata_match_confidence is distinct from 0.95
    or original_venue.wikidata_match_reason is distinct from 'normalized name exact match; official domain exact match; Japan location signal'
    or original_venue.publication_status <> 'draft'
    or original_venue.is_active is not true
  then
    raise exception 'Guard failed: affected Canonical Venue changed';
  end if;

  if (select count(*) from public.venues where publication_status = 'published') <> 0 then
    raise exception 'Guard failed: Production published Venue count is no longer zero';
  end if;
  if (select count(*) from public.media_assets where venue_id = original_venue_id) <> 0 then
    raise exception 'Guard failed: affected Venue now has media';
  end if;
  if exists (
    select 1 from public.venues
    where id = new_venue_id or slug = '旭川市大雪クリスタルホール-q11511731'
  ) then
    raise exception 'Guard failed: Q11511731 Canonical Venue already exists';
  end if;

  if not exists (
    select 1 from public.venue_discovery_inventory
    where id = q11511727_inventory_id
      and external_id = 'Q11511727'
      and state = 'processed'
      and linked_venue_id = original_venue_id
      and attempt_count = 1
  ) then raise exception 'Guard failed: Q11511727 Inventory changed'; end if;

  if not exists (
    select 1 from public.venue_discovery_inventory
    where id = q11511731_inventory_id
      and external_id = 'Q11511731'
      and state = 'processed'
      and linked_venue_id = original_venue_id
      and attempt_count = 1
  ) then raise exception 'Guard failed: Q11511731 Inventory changed'; end if;

  if (select count(*) from public.venue_external_match_candidates
      where provider = 'wikidata' and external_id = 'Q11511731') <> 1
    or not exists (
      select 1 from public.venue_external_match_candidates
      where id = wrong_candidate_id
        and venue_id = original_venue_id
        and provider = 'wikidata'
        and external_id = 'Q11511731'
        and status = 'matched'
        and confidence = 0.95
        and match_reasons = '["normalized name exact match", "official domain exact match", "Japan location signal"]'::jsonb
    )
  then raise exception 'Guard failed: wrong matched candidate changed'; end if;

  q11511727_normalized := q11511727_source.raw_payload -> 'normalized';
  q11511731_normalized := q11511731_source.raw_payload -> 'normalized';
  if q11511727_normalized ->> 'qid' <> 'Q11511727'
    or q11511727_normalized ->> 'name' <> '旭川市博物館'
    or q11511731_normalized ->> 'qid' <> 'Q11511731'
    or q11511731_normalized ->> 'name' <> '旭川市大雪クリスタルホール'
  then raise exception 'Guard failed: stored normalized payload changed'; end if;

  select jsonb_object_agg(field_name, value_snapshot)
  into restored_values
  from public.venue_field_sources
  where venue_id = original_venue_id
    and source_record_id = q11511727_source_id
    and field_name = any(restore_fields)
    and is_current = false
    and review_status = 'applied';
  if jsonb_object_length(coalesce(restored_values, '{}'::jsonb)) <> 9 then
    raise exception 'Guard failed: exact pre-collision provenance is incomplete';
  end if;

  if (select count(*) from public.venue_field_sources
      where venue_id = original_venue_id
        and source_record_id = q11511731_source_id
        and is_current = true
        and review_status = 'applied') <> 11
  then raise exception 'Guard failed: collision provenance cardinality changed'; end if;

  if not exists (
    select 1 from public.venue_field_sources
    where venue_id = original_venue_id
      and source_record_id = q11511727_source_id
      and field_name = 'address'
      and is_current = true
      and value_snapshot = to_jsonb('北海道旭川市神楽3条7丁目大雪クリスタルホール内'::text)
  ) then raise exception 'Guard failed: unaffected address provenance changed'; end if;

  -- Restore the nine overwritten fields from their exact pre-collision
  -- provenance snapshots. aliases/postal_code had no prior provenance rows;
  -- clear the collision-only values using the stored Q11511727 normalized payload.
  update public.venues
  set name = restored_values ->> 'name',
      name_en = restored_values ->> 'name_en',
      aliases = coalesce(array(
        select jsonb_array_elements_text(coalesce(q11511727_normalized -> 'aliases', '[]'::jsonb))
      ), '{}'::text[]),
      venue_type = restored_values ->> 'venue_type',
      country_code = restored_values ->> 'country_code',
      region = restored_values ->> 'region',
      postal_code = nullif(q11511727_normalized ->> 'postalCode', ''),
      latitude = (restored_values ->> 'latitude')::numeric,
      longitude = (restored_values ->> 'longitude')::numeric,
      official_url = restored_values ->> 'official_url',
      inception_year = (restored_values ->> 'inception_year')::integer,
      normalized_name = '旭川市博物館',
      coordinate_source = 'wikidata',
      coordinate_precision = 'exact',
      coordinate_status = 'approved',
      wikidata_match_status = 'matched',
      wikidata_match_confidence = 1,
      wikidata_match_reason = 'Created from Wikidata Source A; QID is the stable external identifier',
      enriched_at = null
  where id = original_venue_id;

  -- Retain the collision rows on the original Venue as rejected audit history.
  update public.venue_field_sources
  set is_current = false,
      review_status = 'rejected'
  where venue_id = original_venue_id
    and source_record_id = q11511731_source_id
    and is_current = true;
  get diagnostics affected = row_count;
  if affected <> 11 then raise exception 'Repair failed: expected 11 collision provenance rows'; end if;

  update public.venue_field_sources
  set is_current = true,
      review_status = 'applied'
  where venue_id = original_venue_id
    and source_record_id = q11511727_source_id
    and field_name = any(restore_fields)
    and is_current = false;
  get diagnostics affected = row_count;
  if affected <> 9 then raise exception 'Repair failed: expected 9 restored provenance rows'; end if;

  insert into public.venues (
    id, slug, name, name_en, aliases, venue_type, country_code, region, city,
    address, postal_code, latitude, longitude, normalized_name,
    normalized_address, official_url, inception_year, opening_hours_text,
    publication_status, is_active, coordinate_source, coordinate_precision,
    coordinate_status, wikidata_match_status, wikidata_match_confidence,
    wikidata_match_reason
  ) values (
    new_venue_id,
    '旭川市大雪クリスタルホール-q11511731',
    q11511731_normalized ->> 'name',
    nullif(q11511731_normalized ->> 'nameEn', ''),
    coalesce(array(
      select jsonb_array_elements_text(coalesce(q11511731_normalized -> 'aliases', '[]'::jsonb))
    ), '{}'::text[]),
    q11511731_normalized ->> 'venueType',
    nullif(q11511731_normalized ->> 'countryCode', ''),
    nullif(q11511731_normalized ->> 'region', ''),
    nullif(q11511731_normalized ->> 'city', ''),
    nullif(q11511731_normalized ->> 'address', ''),
    nullif(q11511731_normalized ->> 'postalCode', ''),
    (q11511731_normalized ->> 'latitude')::numeric,
    (q11511731_normalized ->> 'longitude')::numeric,
    '旭川市大雪クリスタルホール',
    null,
    nullif(q11511731_normalized ->> 'officialUrl', ''),
    (q11511731_normalized ->> 'inceptionYear')::integer,
    nullif(q11511731_normalized ->> 'openingHours', ''),
    'draft', true, 'wikidata', 'exact', 'approved', 'matched', 1,
    'Created from Wikidata Source A; QID is the stable external identifier'
  );

  insert into public.venue_field_sources (
    venue_id, field_name, source, source_url, source_record_id,
    value_snapshot, generated_by_ai, review_status, is_current
  )
  select new_venue_id, field_name, 'wikidata',
         'https://www.wikidata.org/wiki/Q11511731', q11511731_source_id,
         value_snapshot, false, 'applied', true
  from (values
    ('name', to_jsonb(q11511731_normalized ->> 'name')),
    ('name_en', to_jsonb(q11511731_normalized ->> 'nameEn')),
    ('aliases', q11511731_normalized -> 'aliases'),
    ('venue_type', to_jsonb(q11511731_normalized ->> 'venueType')),
    ('country_code', to_jsonb(q11511731_normalized ->> 'countryCode')),
    ('region', to_jsonb(q11511731_normalized ->> 'region')),
    ('city', to_jsonb(q11511731_normalized ->> 'city')),
    ('address', to_jsonb(q11511731_normalized ->> 'address')),
    ('postal_code', to_jsonb(q11511731_normalized ->> 'postalCode')),
    ('latitude', q11511731_normalized -> 'latitude'),
    ('longitude', q11511731_normalized -> 'longitude'),
    ('official_url', to_jsonb(q11511731_normalized ->> 'officialUrl')),
    ('inception_year', q11511731_normalized -> 'inceptionYear'),
    ('opening_hours_text', to_jsonb(q11511731_normalized ->> 'openingHours'))
  ) fields(field_name, value_snapshot)
  where value_snapshot is not null
    and value_snapshot <> 'null'::jsonb
    and value_snapshot <> '""'::jsonb
    and value_snapshot <> '[]'::jsonb;
  get diagnostics affected = row_count;
  if affected <> 11 then raise exception 'Repair failed: expected 11 new provenance rows'; end if;

  update public.source_records
  set venue_id = new_venue_id
  where id = q11511731_source_id and venue_id = original_venue_id;
  get diagnostics affected = row_count;
  if affected <> 1 then raise exception 'Repair failed: source relink cardinality'; end if;

  update public.venue_discovery_inventory
  set linked_venue_id = new_venue_id
  where id = q11511731_inventory_id
    and state = 'processed'
    and linked_venue_id = original_venue_id;
  get diagnostics affected = row_count;
  if affected <> 1 then raise exception 'Repair failed: Inventory relink cardinality'; end if;

  update public.venue_external_match_candidates
  set status = 'rejected'
  where id = wrong_candidate_id
    and venue_id = original_venue_id
    and external_id = 'Q11511731'
    and status = 'matched';
  get diagnostics affected = row_count;
  if affected <> 1 then raise exception 'Repair failed: wrong candidate rejection cardinality'; end if;

  insert into public.venue_external_match_candidates (
    venue_id, provider, external_id, label_ja, label_en, description,
    official_url, latitude, longitude, image_file_title, confidence,
    match_reasons, status, raw_payload, first_seen_at, last_seen_at
  )
  select new_venue_id, provider, external_id, label_ja, label_en, description,
         official_url, latitude, longitude, image_file_title, 1,
         '["Created from Wikidata Source A"]'::jsonb, 'matched', raw_payload,
         first_seen_at, last_seen_at
  from public.venue_external_match_candidates
  where id = wrong_candidate_id;

  -- In-transaction postconditions. A failed postcondition rolls everything back.
  if not exists (
    select 1 from public.source_records
    where id = q11511731_source_id and venue_id = new_venue_id
  ) or not exists (
    select 1 from public.venue_discovery_inventory
    where id = q11511731_inventory_id and state = 'processed' and linked_venue_id = new_venue_id
  ) or (select count(*) from public.venue_field_sources
        where venue_id = new_venue_id and is_current = true) <> 11
    or (select count(*) from public.venue_external_match_candidates
        where venue_id = new_venue_id and external_id = 'Q11511731' and status = 'matched') <> 1
  then raise exception 'Repair failed: final postconditions not satisfied'; end if;
end
$repair$;

commit;
