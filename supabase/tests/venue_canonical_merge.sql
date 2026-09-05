begin;

insert into public.venues (id, slug, name, normalized_name, venue_type, address, publication_status)
values
  ('10000000-0000-0000-0000-000000000001', 'merge-test-source', 'Merge Test Source', 'mergetestsource', 'other', null, 'draft'),
  ('10000000-0000-0000-0000-000000000002', 'merge-test-canonical', 'Merge Test Canonical', 'mergetestcanonical', 'museum', 'Manual address', 'draft');

insert into public.venue_field_sources (venue_id, field_name, source, value_snapshot, review_status, is_current)
values
  ('10000000-0000-0000-0000-000000000001', 'description', 'official_website', to_jsonb('Official description'::text), 'approved', true),
  ('10000000-0000-0000-0000-000000000001', 'opening_note', 'manual', to_jsonb('Manual opening note'::text), 'approved', true),
  ('10000000-0000-0000-0000-000000000002', 'opening_note', 'wikidata', to_jsonb('Wikidata opening note'::text), 'approved', true),
  ('10000000-0000-0000-0000-000000000002', 'address', 'manual', to_jsonb('Manual address'::text), 'approved', true);

update public.venues set description = 'Official description', opening_note = 'Manual opening note' where id = '10000000-0000-0000-0000-000000000001';
update public.venues set opening_note = 'Wikidata opening note' where id = '10000000-0000-0000-0000-000000000002';

insert into public.exhibitions (id, slug, title) values ('20000000-0000-0000-0000-000000000001', 'merge-test-exhibition', 'Merge Test Exhibition');
insert into public.exhibition_occurrences (id, exhibition_id, venue_id, start_date, end_date)
values
  ('30000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', '2026-01-01', '2026-02-01'),
  ('30000000-0000-0000-0000-000000000002', '20000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000002', '2026-01-01', '2026-02-01');

insert into public.works (id, slug, title) values ('40000000-0000-0000-0000-000000000001', 'merge-test-work', 'Merge Test Work');
insert into public.collection_holdings (id, venue_id, work_id)
values
  ('50000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', '40000000-0000-0000-0000-000000000001'),
  ('50000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000002', '40000000-0000-0000-0000-000000000001');

insert into public.media_assets (id, exhibition_id, venue_id, storage_path, rights_status, is_primary)
values ('60000000-0000-0000-0000-000000000001', null, '10000000-0000-0000-0000-000000000001', 'merge-test/source.jpg', 'approved', false);

insert into public.source_records (id, data_source_id, external_id, venue_id, source_url, raw_payload)
select '70000000-0000-0000-0000-000000000001', id, 'merge-test-external-id', '10000000-0000-0000-0000-000000000001', 'https://example.test/source', '{}'::jsonb
from public.data_sources where key = 'art_commons_jpsearch';

select public.merge_venue_into_canonical(
  '10000000-0000-0000-0000-000000000001',
  '10000000-0000-0000-0000-000000000002',
  null, 0.99, array['test'], 'integration_test'
);

do $$
begin
  if (select merged_into_venue_id from public.venues where id = '10000000-0000-0000-0000-000000000001') <> '10000000-0000-0000-0000-000000000002' then raise exception 'soft redirect missing'; end if;
  if (select address from public.venues where id = '10000000-0000-0000-0000-000000000002') <> 'Manual address' then raise exception 'manual field overwritten'; end if;
  if (select description from public.venues where id = '10000000-0000-0000-0000-000000000002') <> 'Official description' then raise exception 'blank canonical field not filled'; end if;
  if (select opening_note from public.venues where id = '10000000-0000-0000-0000-000000000002') <> 'Manual opening note' then raise exception 'higher-priority field was not promoted'; end if;
  if (select count(*) from public.exhibition_occurrences where venue_id = '10000000-0000-0000-0000-000000000002') <> 1 then raise exception 'occurrence dedupe failed'; end if;
  if (select count(*) from public.collection_holdings where venue_id = '10000000-0000-0000-0000-000000000002') <> 1 then raise exception 'holding dedupe failed'; end if;
  if (select count(*) from public.media_assets where venue_id = '10000000-0000-0000-0000-000000000002') <> 1 then raise exception 'media relation not moved'; end if;
  if (select count(*) from public.source_records where venue_id = '10000000-0000-0000-0000-000000000002' and external_id = 'merge-test-external-id') <> 1 then raise exception 'external source record not preserved'; end if;
  if (select count(*) from public.venue_field_sources where venue_id = '10000000-0000-0000-0000-000000000002') <> 4 then raise exception 'provenance history not preserved'; end if;
  if (select source from public.venue_field_sources where venue_id = '10000000-0000-0000-0000-000000000002' and field_name = 'opening_note' and is_current) <> 'manual' then raise exception 'higher-priority provenance was not selected'; end if;
  if (select count(*) from public.venue_merge_audit where source_venue_id = '10000000-0000-0000-0000-000000000001') <> 1 then raise exception 'audit record missing'; end if;
end $$;

-- Idempotency: a second identical request must not move or duplicate data.
select public.merge_venue_into_canonical(
  '10000000-0000-0000-0000-000000000001',
  '10000000-0000-0000-0000-000000000002',
  null, 0.99, array['test'], 'integration_test'
);

do $$
begin
  if (select count(*) from public.venue_merge_audit where source_venue_id = '10000000-0000-0000-0000-000000000001') <> 1 then raise exception 'idempotency audit failed'; end if;
  if exists (
    select 1 from information_schema.table_constraints tc
    join information_schema.constraint_column_usage ccu on ccu.constraint_name = tc.constraint_name and ccu.constraint_schema = tc.constraint_schema
    join information_schema.key_column_usage kcu on kcu.constraint_name = tc.constraint_name and kcu.constraint_schema = tc.constraint_schema
    where tc.constraint_type = 'FOREIGN KEY' and ccu.table_name = 'venues' and ccu.column_name = 'id'
      and kcu.table_name in ('exhibition_occurrences', 'collection_holdings')
      and exists (select 1 from public.venues v where v.id = '10000000-0000-0000-0000-000000000001' and v.merged_into_venue_id is null)
  ) then raise exception 'canonical redirect integrity failed'; end if;
end $$;

rollback;
