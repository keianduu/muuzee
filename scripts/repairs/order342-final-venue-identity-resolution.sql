-- Order 342 guarded Production identity resolution.
--
-- Target project: lqinmolonctddovltujy
-- Approved resolution set:
--   confirmed same entity: Q111132370, Q113080943, Q114642588, Q136418059
--   confirmed distinct entity: Q85882018, Q132496894, Q140275602, Q141540877
--   policy hold/no mutation: Q115203805, Q140197322
--
-- Expected delta:
--   venues +4, venue_field_sources +35, match candidates +4
--   review candidates 10 -> 2
--   source/inventory totals and states unchanged
--   published Venues, media_assets, and storage.objects unchanged at zero
--
-- This file deliberately omits BEGIN/COMMIT. Execute it only through the
-- approved wrapper that starts a transaction, verifies the exact Production
-- target, includes this file, and commits only after all postconditions pass.

do $repair$
declare
  same_entities constant jsonb := '[
    {"qid":"Q111132370","candidate_id":"bd63e28c-0ed0-449e-acd5-050eb0b14bc5","source_id":"635c464d-84a9-4721-b34f-f5f223fb9350","inventory_id":"c4d21672-2ca6-4d3b-b7e6-b87ff16b1971","venue_id":"0134df29-373f-4b71-bede-e0a8909d36d9","matched_candidate_id":"48c1d258-2c02-45d3-8f68-5f80a44f84a0","matched_qid":"Q11634038","checksum":"eb0c99ab89237373f8fc48ab8c15ad799a69b896234021f55bb5e01d76be8fe4"},
    {"qid":"Q113080943","candidate_id":"4141f74e-2b0e-4001-a563-fb19d15d6190","source_id":"757de11b-2e15-462a-acde-d4e58f4756a3","inventory_id":"b1518ea3-4437-4f2a-b332-f31fa254f06d","venue_id":"bac17b7e-a510-4923-9dcd-9641fb3e3a5e","matched_candidate_id":"f77c4045-a7f1-4657-a7f3-b56b24e71bb2","matched_qid":"Q104710289","checksum":"dc1a37b1adfc5b0cf750c5c43746943437ec8a912c806e93e8e8d454efd080de"},
    {"qid":"Q114642588","candidate_id":"b5cb3c98-160b-484f-9d08-786bc4efa7ac","source_id":"def9596e-7558-447b-8fc9-17cf25289e4c","inventory_id":"55f6b9f9-7318-4f6a-b960-661b3193c786","venue_id":"197ad005-f1f6-46fa-9d10-6027a9d2a265","matched_candidate_id":"4df81a88-0109-4fe6-9fac-642093fdc860","matched_qid":"Q21654240","checksum":"c62ecf2fb2a0c798bf0ea3b28eff72f6e59ed8ff1456bfd642ed139c8e66d45a"},
    {"qid":"Q136418059","candidate_id":"3b57dd42-d8a9-4bd5-9e8f-2fbdff46b4d0","source_id":"73698626-23a7-4e5e-ae16-ffdd3615760d","inventory_id":"9cb697b4-d868-4b4e-aef6-a17ff938b22d","venue_id":"0e4aaa10-1ed4-4ec9-b447-8afac30ff6e5","matched_candidate_id":"2491eac6-20b7-4792-9e5a-fcd59d2247e1","matched_qid":"Q135962978","checksum":"7dc33b5fcbdbcf53f8b7789044fe99b7b19638295e41ba5b8db2878ca862a0c4"}
  ]'::jsonb;
  distinct_entities constant jsonb := '[
    {"qid":"Q85882018","candidate_id":"8ef34eaf-7a02-4004-9d42-07f122ffd22c","source_id":"374fb620-9aec-40cc-ae75-54646a238751","inventory_id":"423509e6-f341-4832-861c-83a7f52198d1","old_venue_id":"84cd903e-810c-4c69-b6d9-f240950ed876","matched_candidate_id":"107cc4bd-7102-42a5-a77d-6d7da8f2eb43","matched_qid":"Q11560128","checksum":"b640f32c7eb28dd7059eccc98f3faba462074b7de72a6462898cad30eb9fac6c","new_venue_id":"a7e25027-d187-4371-82a1-856d5da2c20c","new_candidate_id":"0c39d055-d990-42d0-a283-1f4624b204f5","slug":"深沢紅子野の花美術館-q85882018"},
    {"qid":"Q132496894","candidate_id":"e4dea4f8-2536-4bcd-8333-a4239e29ba52","source_id":"3a14d6c5-61e9-4c92-9da3-5579e5d5f08f","inventory_id":"6f4523cb-0608-4310-b3e2-6d5a2717d588","old_venue_id":"c5ba5b52-5333-49c8-874a-6afb4c5b6cd5","matched_candidate_id":"f759c36d-1dce-41b6-b562-120dc13806ef","matched_qid":"Q104696768","checksum":"7cc506a995b5d7ac96659aef1542cdb0cef075810adfee7c67a24b81f26a0688","new_venue_id":"8d5c6d90-0f73-4a1b-823d-74230f0f3db6","new_candidate_id":"bea6e970-e392-421c-a80c-dd4ddd999023","slug":"乃木神社宝物館-q132496894"},
    {"qid":"Q140275602","candidate_id":"3e2fd879-0640-4c6b-82ea-224c4ca81008","source_id":"18b90edc-b928-4f64-b84c-3db0bc34748e","inventory_id":"53015c47-7605-441f-b1e2-85e0000ed488","old_venue_id":"c5ba5b52-5333-49c8-874a-6afb4c5b6cd5","matched_candidate_id":"f759c36d-1dce-41b6-b562-120dc13806ef","matched_qid":"Q104696768","checksum":"fafdc8b569db8f687f89001c94105f162f2c69603e2a7ef007d669ac9eec4339","new_venue_id":"2600ef0c-4d10-4562-a199-e23269d41a2f","new_candidate_id":"0118fb70-f2cf-4ee1-9f55-ccc5f1ff125d","slug":"乃木神社宝物館-q140275602"},
    {"qid":"Q141540877","candidate_id":"63d0ba0a-78da-47d5-b23d-cbe3cd251341","source_id":"2e6ffb39-41b7-4850-bf0f-e0fc153ab1be","inventory_id":"e54208cd-f3ee-4e14-a9cd-36ac96a31210","old_venue_id":"d1c2e3f7-a268-4d8a-bc33-a144dd045019","matched_candidate_id":"d2fcb92a-92d0-436f-b0de-93ee342a3a42","matched_qid":"Q117469053","checksum":"3af3210166dc14b5865dd5608cda83faed20581788883d6c161a505e11ae6474","new_venue_id":"103097b4-0fcd-4734-9fe4-77c0fbed5adb","new_candidate_id":"75e7cca1-c7ec-4295-beb0-93efe43ffbca","slug":"鉱山資料館-q141540877"}
  ]'::jsonb;
  held_entities constant jsonb := '[
    {"qid":"Q115203805","candidate_id":"6ff5964b-8963-45ec-b2e5-2e9038e18aa4","source_id":"074b67f3-110b-41d4-98c0-97aad55dc04c","inventory_id":"ddb5b87b-5b48-47f7-be69-aeb5152cb8ca","venue_id":"b400582d-1af7-4700-9305-e656dc756690","checksum":"15a7ea30fd5abcbde97944bb91ed8fe3bff60fc3e3cf0d544ca149f6128a5f00"},
    {"qid":"Q140197322","candidate_id":"b5ca99ba-a7e8-4782-a57e-4450c51a8a81","source_id":"d22fd667-0621-47a2-afe0-d4fe4018a71e","inventory_id":"46f88854-06c9-4075-a139-08706957d0eb","venue_id":"51e49248-0d95-4139-a7fd-b104d43667ac","checksum":"c8fd0da2c19f1554660db09d1bfe20ae184c2690b46839cb2a1a3deae2dc5ac3"}
  ]'::jsonb;
  protected_venues constant jsonb := '[
    {"id":"0134df29-373f-4b71-bede-e0a8909d36d9","slug":"豊田市小原和紙のふるさと-q11634038","name":"豊田市小原和紙のふるさと"},
    {"id":"0e4aaa10-1ed4-4ec9-b447-8afac30ff6e5","slug":"なかとさ美術館-q135962978","name":"なかとさ美術館"},
    {"id":"197ad005-f1f6-46fa-9d10-6027a9d2a265","slug":"東浦町郷土資料館-q21654240","name":"東浦町郷土資料館"},
    {"id":"84cd903e-810c-4c69-b6d9-f240950ed876","slug":"深沢紅子野の花美術館-q11560128","name":"深沢紅子野の花美術館"},
    {"id":"bac17b7e-a510-4923-9dcd-9641fb3e3a5e","slug":"上石津郷土資料館-q104710289","name":"上石津郷土資料館"},
    {"id":"c5ba5b52-5333-49c8-874a-6afb4c5b6cd5","slug":"乃木神社宝物館-q104696768","name":"乃木神社宝物館"},
    {"id":"d1c2e3f7-a268-4d8a-bc33-a144dd045019","slug":"鉱山資料館-q117469053","name":"鉱山資料館"}
  ]'::jsonb;
  item record;
  source_row public.source_records%rowtype;
  normalized jsonb;
  affected integer;
  already_applied boolean;
  protected_before jsonb := '{}'::jsonb;
  current_venue_hash text;
  current_provenance_hash text;
begin
  lock table public.venues, public.source_records, public.venue_discovery_inventory,
    public.venue_external_match_candidates, public.venue_field_sources,
    public.media_assets in share row exclusive mode;

  select
    (select count(*) from public.venues where id in (
      'a7e25027-d187-4371-82a1-856d5da2c20c',
      '8d5c6d90-0f73-4a1b-823d-74230f0f3db6',
      '2600ef0c-4d10-4562-a199-e23269d41a2f',
      '103097b4-0fcd-4734-9fe4-77c0fbed5adb'
    )) = 4
    and (select count(*) from jsonb_to_recordset(same_entities) as x(candidate_id uuid)
      join public.venue_external_match_candidates c on c.id=x.candidate_id and c.status='matched') = 4
    and (select count(*) from jsonb_to_recordset(distinct_entities) as x(candidate_id uuid)
      join public.venue_external_match_candidates c on c.id=x.candidate_id and c.status='rejected') = 4
    and (select count(*) from jsonb_to_recordset(distinct_entities) as x(new_candidate_id uuid)
      join public.venue_external_match_candidates c on c.id=x.new_candidate_id and c.status='matched') = 4
  into already_applied;

  if already_applied then
    if (select count(*) from public.venues) <> 4946
      or (select count(*) from public.venue_field_sources) <> 46098
      or (select count(*) from public.venue_external_match_candidates) <> 4958
      or (select count(*) from public.venue_external_match_candidates where status='candidate') <> 2
    then raise exception 'Idempotency guard failed: partial or unexpected post-state'; end if;
    if (select count(*)
        from jsonb_to_recordset(same_entities) as x(
          candidate_id uuid, source_id uuid, inventory_id uuid, venue_id uuid,
          matched_candidate_id uuid
        )
        join public.source_records sr on sr.id=x.source_id and sr.venue_id=x.venue_id
        join public.venue_discovery_inventory inv on inv.id=x.inventory_id and inv.linked_venue_id=x.venue_id
        join public.venue_external_match_candidates candidate on candidate.id=x.candidate_id and candidate.status='matched'
        join public.venue_external_match_candidates prior on prior.id=x.matched_candidate_id and prior.status='matched') <> 4
    then raise exception 'Idempotency guard failed: same-entity post-state incomplete'; end if;
    if (select count(*)
        from jsonb_to_recordset(distinct_entities) as x(
          candidate_id uuid, source_id uuid, inventory_id uuid, new_venue_id uuid,
          new_candidate_id uuid, matched_candidate_id uuid
        )
        join public.venues v on v.id=x.new_venue_id and v.publication_status='draft' and v.is_active=true
        join public.source_records sr on sr.id=x.source_id and sr.venue_id=x.new_venue_id
        join public.venue_discovery_inventory inv on inv.id=x.inventory_id and inv.linked_venue_id=x.new_venue_id
        join public.venue_external_match_candidates rejected on rejected.id=x.candidate_id and rejected.status='rejected'
        join public.venue_external_match_candidates candidate on candidate.id=x.new_candidate_id and candidate.venue_id=x.new_venue_id and candidate.status='matched'
        join public.venue_external_match_candidates prior on prior.id=x.matched_candidate_id and prior.status='matched') <> 4
    then raise exception 'Idempotency guard failed: distinct-entity post-state incomplete'; end if;
    if (select count(*)
        from jsonb_to_recordset(held_entities) as x(candidate_id uuid, source_id uuid, inventory_id uuid)
        join public.source_records sr on sr.id=x.source_id and sr.venue_id is null
        join public.venue_discovery_inventory inv on inv.id=x.inventory_id and inv.linked_venue_id is null
        join public.venue_external_match_candidates candidate on candidate.id=x.candidate_id and candidate.status='candidate') <> 2
    then raise exception 'Idempotency guard failed: held-entity state changed'; end if;
    raise notice 'Order 342 final identity resolution is already applied';
    return;
  end if;

  -- Exact Production baseline. A changed state requires a fresh review rather
  -- than silently widening this repair.
  if (select count(*) from public.venues) <> 4942
    or (select count(*) from public.venues where publication_status='published') <> 0
    or (select count(*) from public.source_records) <> 4953
    or (select count(*) from public.venue_field_sources) <> 46063
    or (select count(*) from public.venue_external_match_candidates) <> 4954
    or (select count(*) from public.venue_external_match_candidates where status='candidate') <> 10
    or (select count(*) from public.media_assets) <> 0
    or (select count(*) from storage.objects) <> 0
    or (select count(*) from public.venue_discovery_inventory) <> 4960
    or (select count(*) from public.venue_discovery_inventory where state='processed') <> 4953
    or (select count(*) from public.venue_discovery_inventory where state='invalid') <> 7
    or (select count(*) from public.venue_discovery_inventory where state in ('pending','processing')) <> 0
  then raise exception 'Guard failed: Production baseline changed'; end if;

  for item in
    select * from jsonb_to_recordset(protected_venues)
      as x(id uuid, slug text, name text)
  loop
    if not exists (select 1 from public.venues
      where id=item.id and slug=item.slug and name=item.name
        and publication_status='draft' and is_active=true)
    then raise exception 'Guard failed: protected Canonical identity changed for %', item.id; end if;
    select md5(to_jsonb(v)::text) into current_venue_hash
    from public.venues v where v.id=item.id;
    select md5(coalesce(jsonb_agg(to_jsonb(p) order by p.id)::text,'[]'))
      into current_provenance_hash
    from public.venue_field_sources p where p.venue_id=item.id;
    protected_before := protected_before || jsonb_build_object(
      item.id::text,
      jsonb_build_object('venue', current_venue_hash, 'provenance', current_provenance_hash)
    );
  end loop;

  for item in
    select * from jsonb_to_recordset(same_entities) as x(
      qid text, candidate_id uuid, source_id uuid, inventory_id uuid,
      venue_id uuid, matched_candidate_id uuid, matched_qid text, checksum text
    )
  loop
    if not exists (select 1 from public.source_records
      where id=item.source_id and external_id=item.qid and checksum=item.checksum and venue_id is null)
      or not exists (select 1 from public.venue_discovery_inventory
      where id=item.inventory_id and external_id=item.qid and state='processed'
        and linked_venue_id is null and attempt_count=1)
      or not exists (select 1 from public.venue_external_match_candidates
      where id=item.candidate_id and venue_id=item.venue_id and provider='wikidata'
        and external_id=item.qid and status='candidate')
      or not exists (select 1 from public.venue_external_match_candidates
      where id=item.matched_candidate_id and venue_id=item.venue_id and provider='wikidata'
        and external_id=item.matched_qid and status='matched')
    then raise exception 'Guard failed: same-entity pre-state changed for %', item.qid; end if;
  end loop;

  for item in
    select * from jsonb_to_recordset(distinct_entities) as x(
      qid text, candidate_id uuid, source_id uuid, inventory_id uuid,
      old_venue_id uuid, matched_candidate_id uuid, matched_qid text,
      checksum text, new_venue_id uuid, new_candidate_id uuid, slug text
    )
  loop
    if exists (select 1 from public.venues where id=item.new_venue_id or slug=item.slug)
      or exists (select 1 from public.venue_external_match_candidates where id=item.new_candidate_id)
      or not exists (select 1 from public.source_records
      where id=item.source_id and external_id=item.qid and checksum=item.checksum and venue_id is null)
      or not exists (select 1 from public.venue_discovery_inventory
      where id=item.inventory_id and external_id=item.qid and state='processed'
        and linked_venue_id is null and attempt_count=1)
      or not exists (select 1 from public.venue_external_match_candidates
      where id=item.candidate_id and venue_id=item.old_venue_id and provider='wikidata'
        and external_id=item.qid and status='candidate')
      or not exists (select 1 from public.venue_external_match_candidates
      where id=item.matched_candidate_id and venue_id=item.old_venue_id and provider='wikidata'
        and external_id=item.matched_qid and status='matched')
    then raise exception 'Guard failed: distinct-entity pre-state changed for %', item.qid; end if;
  end loop;

  for item in
    select * from jsonb_to_recordset(held_entities) as x(
      qid text, candidate_id uuid, source_id uuid, inventory_id uuid,
      venue_id uuid, checksum text
    )
  loop
    if not exists (select 1 from public.source_records
      where id=item.source_id and external_id=item.qid and checksum=item.checksum and venue_id is null)
      or not exists (select 1 from public.venue_discovery_inventory
      where id=item.inventory_id and external_id=item.qid and state='processed'
        and linked_venue_id is null and attempt_count=1)
      or not exists (select 1 from public.venue_external_match_candidates
      where id=item.candidate_id and venue_id=item.venue_id and provider='wikidata'
        and external_id=item.qid and status='candidate')
    then raise exception 'Guard failed: held-entity pre-state changed for %', item.qid; end if;
  end loop;

  -- Confirmed same entity: add the second identity without demoting the
  -- already matched identity and without touching Canonical fields/provenance.
  for item in
    select * from jsonb_to_recordset(same_entities) as x(
      qid text, candidate_id uuid, source_id uuid, inventory_id uuid,
      venue_id uuid, matched_candidate_id uuid, matched_qid text, checksum text
    )
  loop
    update public.source_records set venue_id=item.venue_id where id=item.source_id;
    get diagnostics affected = row_count;
    if affected <> 1 then raise exception 'Apply failed: source link %', item.qid; end if;

    update public.venue_discovery_inventory set linked_venue_id=item.venue_id where id=item.inventory_id;
    get diagnostics affected = row_count;
    if affected <> 1 then raise exception 'Apply failed: inventory link %', item.qid; end if;

    update public.venue_external_match_candidates set status='matched' where id=item.candidate_id;
    get diagnostics affected = row_count;
    if affected <> 1 then raise exception 'Apply failed: candidate match %', item.qid; end if;
  end loop;

  -- Confirmed distinct entity: create a Draft Canonical from the already
  -- stored normalized payload. The false cross-link remains as rejected audit
  -- history; the pre-existing Canonical is not updated.
  for item in
    select * from jsonb_to_recordset(distinct_entities) as x(
      qid text, candidate_id uuid, source_id uuid, inventory_id uuid,
      old_venue_id uuid, matched_candidate_id uuid, matched_qid text,
      checksum text, new_venue_id uuid, new_candidate_id uuid, slug text
    )
  loop
    select * into source_row from public.source_records where id=item.source_id;
    normalized := source_row.raw_payload -> 'normalized';
    if normalized ->> 'qid' is distinct from item.qid
      or nullif(normalized ->> 'name','') is null
      or nullif(normalized ->> 'venueType','') is null
    then raise exception 'Guard failed: normalized payload incomplete for %', item.qid; end if;

    insert into public.venues (
      id, slug, name, name_en, aliases, venue_type, country_code, region, city,
      address, postal_code, latitude, longitude, normalized_name,
      normalized_address, official_url, inception_year, opening_hours_text,
      publication_status, is_active, coordinate_source, coordinate_precision,
      coordinate_status, wikidata_match_status, wikidata_match_confidence,
      wikidata_match_reason
    ) values (
      item.new_venue_id, item.slug, normalized ->> 'name', nullif(normalized ->> 'nameEn',''),
      coalesce(array(select jsonb_array_elements_text(coalesce(normalized -> 'aliases','[]'::jsonb))), '{}'::text[]),
      normalized ->> 'venueType', nullif(normalized ->> 'countryCode',''),
      nullif(normalized ->> 'region',''), nullif(normalized ->> 'city',''),
      nullif(normalized ->> 'address',''), nullif(normalized ->> 'postalCode',''),
      nullif(normalized ->> 'latitude','')::numeric, nullif(normalized ->> 'longitude','')::numeric,
      case item.qid
        when 'Q85882018' then '深沢紅子野の花美術館'
        when 'Q132496894' then '乃木神社宝物館'
        when 'Q140275602' then '乃木神社宝物館'
        when 'Q141540877' then '鉱山資料館'
      end,
      case when item.qid='Q85882018' then '0200885岩手県盛岡市紺屋町48' else null end,
      nullif(normalized ->> 'officialUrl',''), nullif(normalized ->> 'inceptionYear','')::integer,
      nullif(normalized ->> 'openingHours',''), 'draft', true,
      case when normalized ->> 'latitude' is not null and normalized ->> 'longitude' is not null then 'wikidata' end,
      case when normalized ->> 'latitude' is not null and normalized ->> 'longitude' is not null then 'exact' end,
      case when normalized ->> 'latitude' is not null and normalized ->> 'longitude' is not null then 'approved' else 'missing' end,
      'matched', 1, 'Created from Wikidata Source A; QID is the stable external identifier'
    );

    insert into public.venue_field_sources (
      venue_id, field_name, source, source_url, source_record_id,
      value_snapshot, generated_by_ai, review_status, is_current
    )
    select item.new_venue_id, field.field_name, 'wikidata',
      'https://www.wikidata.org/wiki/' || item.qid, item.source_id,
      field.value_snapshot, false, 'applied', true
    from (values
      ('name', to_jsonb(normalized ->> 'name')),
      ('name_en', to_jsonb(normalized ->> 'nameEn')),
      ('aliases', normalized -> 'aliases'),
      ('venue_type', to_jsonb(normalized ->> 'venueType')),
      ('country_code', to_jsonb(normalized ->> 'countryCode')),
      ('region', to_jsonb(normalized ->> 'region')),
      ('city', to_jsonb(normalized ->> 'city')),
      ('address', to_jsonb(normalized ->> 'address')),
      ('postal_code', to_jsonb(normalized ->> 'postalCode')),
      ('latitude', normalized -> 'latitude'),
      ('longitude', normalized -> 'longitude'),
      ('official_url', to_jsonb(normalized ->> 'officialUrl')),
      ('inception_year', normalized -> 'inceptionYear'),
      ('opening_hours_text', to_jsonb(normalized ->> 'openingHours'))
    ) as field(field_name, value_snapshot)
    where field.value_snapshot is not null
      and field.value_snapshot <> 'null'::jsonb
      and field.value_snapshot <> '""'::jsonb
      and field.value_snapshot <> '[]'::jsonb;

    update public.source_records set venue_id=item.new_venue_id where id=item.source_id;
    get diagnostics affected = row_count;
    if affected <> 1 then raise exception 'Apply failed: distinct source link %', item.qid; end if;

    update public.venue_discovery_inventory set linked_venue_id=item.new_venue_id where id=item.inventory_id;
    get diagnostics affected = row_count;
    if affected <> 1 then raise exception 'Apply failed: distinct inventory link %', item.qid; end if;

    update public.venue_external_match_candidates set status='rejected' where id=item.candidate_id;
    get diagnostics affected = row_count;
    if affected <> 1 then raise exception 'Apply failed: reject false cross-link %', item.qid; end if;

    insert into public.venue_external_match_candidates (
      id, venue_id, provider, external_id, label_ja, label_en, description,
      official_url, latitude, longitude, image_file_title, confidence,
      match_reasons, status, raw_payload, first_seen_at, last_seen_at
    )
    select item.new_candidate_id, item.new_venue_id, provider, external_id,
      label_ja, label_en, description, official_url, latitude, longitude,
      image_file_title, 1, '["Created from Wikidata Source A"]'::jsonb,
      'matched', raw_payload, first_seen_at, last_seen_at
    from public.venue_external_match_candidates where id=item.candidate_id;
    get diagnostics affected = row_count;
    if affected <> 1 then raise exception 'Apply failed: new matched candidate %', item.qid; end if;
  end loop;

  -- Exact postconditions.
  if (select count(*) from public.venues) <> 4946
    or (select count(*) from public.venues where publication_status='published') <> 0
    or (select count(*) from public.source_records) <> 4953
    or (select count(*) from public.venue_field_sources) <> 46098
    or (select count(*) from public.venue_external_match_candidates) <> 4958
    or (select count(*) from public.venue_external_match_candidates where status='candidate') <> 2
    or (select count(*) from public.media_assets) <> 0
    or (select count(*) from storage.objects) <> 0
    or (select count(*) from public.venue_discovery_inventory) <> 4960
    or (select count(*) from public.venue_discovery_inventory where state='processed') <> 4953
    or (select count(*) from public.venue_discovery_inventory where state='invalid') <> 7
    or (select count(*) from public.venue_discovery_inventory where state in ('pending','processing')) <> 0
  then raise exception 'Postcondition failed: aggregate state mismatch'; end if;

  for item in
    select * from jsonb_to_recordset(protected_venues)
      as x(id uuid, slug text, name text)
  loop
    select md5(to_jsonb(v)::text) into current_venue_hash
    from public.venues v where v.id=item.id;
    select md5(coalesce(jsonb_agg(to_jsonb(p) order by p.id)::text,'[]'))
      into current_provenance_hash
    from public.venue_field_sources p where p.venue_id=item.id;
    if current_venue_hash is distinct from protected_before #>> array[item.id::text,'venue']
      or current_provenance_hash is distinct from protected_before #>> array[item.id::text,'provenance']
    then raise exception 'Postcondition failed: protected Canonical % mutated', item.id; end if;
  end loop;

  if exists (
    select 1
    from public.source_records sr
    join public.venue_discovery_inventory inv
      on inv.data_source_id=sr.data_source_id and inv.external_id=sr.external_id
    where sr.external_id in (
      'Q85882018','Q111132370','Q113080943','Q114642588',
      'Q132496894','Q136418059','Q140275602','Q141540877'
    ) and sr.venue_id is distinct from inv.linked_venue_id
  ) then raise exception 'Postcondition failed: source/inventory ownership mismatch'; end if;

  for item in
    select * from jsonb_to_recordset(held_entities) as x(
      qid text, candidate_id uuid, source_id uuid, inventory_id uuid,
      venue_id uuid, checksum text
    )
  loop
    if not exists (select 1 from public.source_records where id=item.source_id and venue_id is null)
      or not exists (select 1 from public.venue_discovery_inventory where id=item.inventory_id and linked_venue_id is null)
      or not exists (select 1 from public.venue_external_match_candidates where id=item.candidate_id and status='candidate')
    then raise exception 'Postcondition failed: held entity % changed', item.qid; end if;
  end loop;

  raise notice 'Order 342 identity resolution applied: 4 same-entity links, 4 distinct Draft Venues, 2 policy holds';
end
$repair$;
