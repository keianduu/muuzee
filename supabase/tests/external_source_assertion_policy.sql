begin;

do $$
begin
  if (select count(*) from public.data_source_assertion_policies p join public.data_sources d on d.id = p.data_source_id where d.key in ('apj_shuzo', 'tomuco')) <> 8 then
    raise exception 'SHUZO / ToMuCo policy matrix is incomplete';
  end if;
  if exists (
    select 1 from public.data_source_assertion_policies p join public.data_sources d on d.id = p.data_source_id
    where d.key in ('apj_shuzo', 'tomuco') and p.assertion_type in ('work_presentation', 'media')
      and (p.auto_apply or not p.review_required or p.default_visibility <> 'hidden')
  ) then raise exception 'Presentation / media safety policy changed'; end if;
end $$;

insert into public.artists (id, slug, name, publication_status)
values ('91000000-0000-0000-0000-000000000001', 'order659-artist', 'Order 659 Artist', 'draft');

insert into public.venues (id, slug, name, normalized_name, publication_status)
values ('92000000-0000-0000-0000-000000000001', 'order659-venue', 'Order 659 Venue', 'order659venue', 'published');

insert into public.source_records (id, data_source_id, external_id, source_url, raw_payload)
select '93000000-0000-0000-0000-000000000001', id, 'order659-work', 'https://example.test/original', '{"test":true}'::jsonb
from public.data_sources where key = 'apj_shuzo';

insert into public.work_import_candidates (
  id, artist_id, data_source_id, external_id, source_url, title, title_ja,
  source_artist_name, source_venue_name, matched_venue_id, holding_type,
  presentation_type, presentation_status, match_status, raw_payload
)
select
  '94000000-0000-0000-0000-000000000001', '91000000-0000-0000-0000-000000000001', id,
  'order659-work', 'https://example.test/original', 'Order 659 Work', 'Order 659 Work',
  'Order 659 Artist', 'Order 659 Venue', '92000000-0000-0000-0000-000000000001', 'collection',
  'permanent', 'currently_displayed', 'candidate', '{"test":true}'::jsonb
from public.data_sources where key = 'apj_shuzo';

select public.auto_apply_work_candidate('94000000-0000-0000-0000-000000000001');

do $$
declare v_work_id uuid;
begin
  select matched_work_id into v_work_id from public.work_import_candidates where id = '94000000-0000-0000-0000-000000000001';
  if v_work_id is null then raise exception 'deterministic Core 3/3 candidate was not auto applied'; end if;
  if (select visibility_status from public.work_artists where work_id = v_work_id) <> 'public' then raise exception 'new Artist relation is not public'; end if;
  if (select visibility_status from public.collection_holdings where work_id = v_work_id) <> 'public' then raise exception 'new Holding relation is not public'; end if;
  if exists (select 1 from public.work_presentations where work_id = v_work_id) then raise exception 'Presentation was auto-created from candidate evidence'; end if;
  if exists (select 1 from public.media_assets where work_id = v_work_id) then raise exception 'Media workflow changed during relation adoption'; end if;
end $$;

-- Manual hide keeps canonical relations and source evidence.
update public.work_artists set visibility_status = 'hidden', visibility_overridden = true, hidden_reason = 'operator test', visibility_updated_at = now()
where work_id = (select matched_work_id from public.work_import_candidates where id = '94000000-0000-0000-0000-000000000001');
update public.collection_holdings set visibility_status = 'hidden', visibility_overridden = true, hidden_reason = 'operator test', visibility_updated_at = now()
where work_id = (select matched_work_id from public.work_import_candidates where id = '94000000-0000-0000-0000-000000000001');

update public.work_import_candidates
set source_url = 'https://example.test/refreshed', holding_type = 'deposit'
where id = '94000000-0000-0000-0000-000000000001';
update public.source_records set source_url = 'https://example.test/refreshed'
where id = '93000000-0000-0000-0000-000000000001';
select public.auto_apply_work_candidate('94000000-0000-0000-0000-000000000001');

do $$
declare v_work_id uuid;
begin
  select matched_work_id into v_work_id from public.work_import_candidates where id = '94000000-0000-0000-0000-000000000001';
  if (select visibility_status from public.work_artists where work_id = v_work_id) <> 'hidden' then raise exception 'Artist manual hide did not survive resync'; end if;
  if (select visibility_status from public.collection_holdings where work_id = v_work_id) <> 'hidden' then raise exception 'Holding manual hide did not survive resync'; end if;
  if (select holding_type from public.collection_holdings where work_id = v_work_id) <> 'deposit' then raise exception 'safe source refresh did not update holding type'; end if;
  if (select source_url from public.collection_holdings where work_id = v_work_id) <> 'https://example.test/refreshed' then raise exception 'safe source refresh did not update provenance URL'; end if;
  if not exists (select 1 from public.source_records where id = '93000000-0000-0000-0000-000000000001') then raise exception 'Hide deleted source evidence'; end if;
end $$;

-- Manual re-enable is also an override and survives later sync.
update public.collection_holdings set visibility_status = 'public', visibility_overridden = true, hidden_reason = null, visibility_updated_at = now()
where work_id = (select matched_work_id from public.work_import_candidates where id = '94000000-0000-0000-0000-000000000001');
select public.auto_apply_work_candidate('94000000-0000-0000-0000-000000000001');

do $$
begin
  if not exists (
    select 1 from public.collection_holdings
    where work_id = (select matched_work_id from public.work_import_candidates where id = '94000000-0000-0000-0000-000000000001')
      and visibility_status = 'public' and visibility_overridden
  ) then raise exception 'manual re-enable did not survive resync'; end if;
end $$;

-- Ambiguous candidates are retained but never applied.
insert into public.source_records (id, data_source_id, external_id, source_url, raw_payload)
select '93000000-0000-0000-0000-000000000002', id, 'order659-ambiguous', 'https://example.test/ambiguous', '{}'::jsonb
from public.data_sources where key = 'apj_shuzo';
insert into public.work_import_candidates (
  id, artist_id, data_source_id, external_id, source_url, title, source_artist_name,
  source_venue_name, matched_venue_id, holding_type, match_status, raw_payload
)
select '94000000-0000-0000-0000-000000000002', '91000000-0000-0000-0000-000000000001', id,
  'order659-ambiguous', 'https://example.test/ambiguous', 'Ambiguous Work', 'Order 659 Artist',
  'Order 659 Venue', '92000000-0000-0000-0000-000000000001', 'collection', 'ambiguous', '{}'::jsonb
from public.data_sources where key = 'apj_shuzo';
select public.auto_apply_work_candidate('94000000-0000-0000-0000-000000000002');

do $$
declare v_work_id uuid;
begin
  if (select matched_work_id from public.work_import_candidates where id = '94000000-0000-0000-0000-000000000002') is not null then raise exception 'ambiguous candidate was auto applied'; end if;
  select matched_work_id into v_work_id from public.work_import_candidates where id = '94000000-0000-0000-0000-000000000001';
  delete from public.collection_holdings where work_id = v_work_id;
  if not exists (select 1 from public.work_artists where work_id = v_work_id) then raise exception 'relation Remove deleted unrelated Artist relation'; end if;
  if not exists (select 1 from public.source_records where id = '93000000-0000-0000-0000-000000000001') then raise exception 'relation Remove deleted source record'; end if;
end $$;

rollback;
