begin;

insert into public.artists (id, slug, name, publication_status)
values ('95000000-0000-0000-0000-000000000001', 'order659-backfill-artist', 'Order 659 Backfill Artist', 'draft');

insert into public.venues (id, slug, name, normalized_name, publication_status)
values ('95000000-0000-0000-0000-000000000002', 'order659-backfill-venue', 'Order 659 Backfill Venue', 'order659backfillvenue', 'published');

insert into public.data_sources (id, key, name, base_url)
values ('95000000-0000-0000-0000-000000000003', 'order659_review_source', 'Order 659 Review Source', 'https://example.test');

insert into public.data_source_assertion_policies
  (data_source_id, assertion_type, enabled, auto_apply, default_visibility, review_required)
values
  ('95000000-0000-0000-0000-000000000003', 'work_artist', true, false, 'public', true);

insert into public.works (id, slug, title, publication_status)
select id, slug, title, 'draft'
from (values
  ('96000000-0000-0000-0000-000000000001'::uuid, 'order659-backfill-work-1', 'Order 659 Backfill Work 1'),
  ('96000000-0000-0000-0000-000000000002'::uuid, 'order659-backfill-work-2', 'Order 659 Backfill Work 2'),
  ('96000000-0000-0000-0000-000000000003'::uuid, 'order659-backfill-work-3', 'Order 659 Backfill Work 3'),
  ('96000000-0000-0000-0000-000000000004'::uuid, 'order659-backfill-work-4', 'Order 659 Backfill Work 4'),
  ('96000000-0000-0000-0000-000000000005'::uuid, 'order659-backfill-work-5', 'Order 659 Backfill Work 5'),
  ('96000000-0000-0000-0000-000000000006'::uuid, 'order659-backfill-work-6', 'Order 659 Backfill Work 6'),
  ('96000000-0000-0000-0000-000000000007'::uuid, 'order659-backfill-work-7', 'Order 659 Backfill Work 7')
) as fixture(id, slug, title);

insert into public.work_artists
  (id, work_id, artist_id, source, visibility_status, visibility_overridden, hidden_reason)
values
  ('97000000-0000-0000-0000-000000000001', '96000000-0000-0000-0000-000000000001', '95000000-0000-0000-0000-000000000001', 'manual', 'hidden', false, 'legacy'),
  ('97000000-0000-0000-0000-000000000002', '96000000-0000-0000-0000-000000000002', '95000000-0000-0000-0000-000000000001', 'apj_shuzo', 'hidden', false, 'legacy'),
  ('97000000-0000-0000-0000-000000000003', '96000000-0000-0000-0000-000000000003', '95000000-0000-0000-0000-000000000001', null, 'public', false, 'legacy'),
  ('97000000-0000-0000-0000-000000000004', '96000000-0000-0000-0000-000000000004', '95000000-0000-0000-0000-000000000001', 'unknown_source', 'public', false, 'legacy'),
  ('97000000-0000-0000-0000-000000000005', '96000000-0000-0000-0000-000000000005', '95000000-0000-0000-0000-000000000001', 'apj_shuzo', 'hidden', true, 'operator hide'),
  ('97000000-0000-0000-0000-000000000006', '96000000-0000-0000-0000-000000000006', '95000000-0000-0000-0000-000000000001', 'unknown_source', 'public', true, null),
  ('97000000-0000-0000-0000-000000000007', '96000000-0000-0000-0000-000000000007', '95000000-0000-0000-0000-000000000001', 'order659_review_source', 'public', false, 'legacy');

insert into public.collection_holdings
  (id, work_id, venue_id, source, visibility_status, visibility_overridden, hidden_reason)
values
  ('98000000-0000-0000-0000-000000000001', '96000000-0000-0000-0000-000000000001', '95000000-0000-0000-0000-000000000002', 'manual', 'hidden', false, 'legacy'),
  ('98000000-0000-0000-0000-000000000002', '96000000-0000-0000-0000-000000000002', '95000000-0000-0000-0000-000000000002', 'tomuco', 'hidden', false, 'legacy'),
  ('98000000-0000-0000-0000-000000000003', '96000000-0000-0000-0000-000000000003', '95000000-0000-0000-0000-000000000002', null, 'public', false, 'legacy'),
  ('98000000-0000-0000-0000-000000000004', '96000000-0000-0000-0000-000000000004', '95000000-0000-0000-0000-000000000002', 'unknown_source', 'public', false, 'legacy'),
  ('98000000-0000-0000-0000-000000000005', '96000000-0000-0000-0000-000000000005', '95000000-0000-0000-0000-000000000002', 'tomuco', 'hidden', true, 'operator hide'),
  ('98000000-0000-0000-0000-000000000006', '96000000-0000-0000-0000-000000000006', '95000000-0000-0000-0000-000000000002', 'unknown_source', 'public', true, null);

create temporary table order659_counts_before as
select
  (select count(*) from public.works) as works,
  (select count(*) from public.artists) as artists,
  (select count(*) from public.venues) as venues,
  (select count(*) from public.work_artists) as work_artists,
  (select count(*) from public.collection_holdings) as collection_holdings;

create temporary table order659_relation_ids_before as
select 'artist'::text as kind, id, work_id, artist_id as target_id
from public.work_artists
union all
select 'holding', id, work_id, venue_id
from public.collection_holdings;

select public.reconcile_relation_visibility_defaults();

do $$
declare
  before_counts record;
begin
  select * into before_counts from order659_counts_before;
  if before_counts.works <> (select count(*) from public.works)
    or before_counts.artists <> (select count(*) from public.artists)
    or before_counts.venues <> (select count(*) from public.venues)
    or before_counts.work_artists <> (select count(*) from public.work_artists)
    or before_counts.collection_holdings <> (select count(*) from public.collection_holdings)
  then raise exception 'Backfill changed entity or relation row counts'; end if;

  if exists (
    select 1 from order659_relation_ids_before b
    where not exists (
      select 1 from public.work_artists wa
      where b.kind = 'artist' and wa.id = b.id and wa.work_id = b.work_id and wa.artist_id = b.target_id
      union all
      select 1 from public.collection_holdings ch
      where b.kind = 'holding' and ch.id = b.id and ch.work_id = b.work_id and ch.venue_id = b.target_id
    )
  ) then raise exception 'Backfill changed or deleted a relation ID'; end if;

  if not exists (select 1 from public.work_artists where id = '97000000-0000-0000-0000-000000000001' and visibility_status = 'public' and not visibility_overridden and hidden_reason is null)
    then raise exception 'Manual legacy Artist relation did not become Public'; end if;
  if not exists (select 1 from public.work_artists where id = '97000000-0000-0000-0000-000000000002' and visibility_status = 'public' and not visibility_overridden and hidden_reason is null)
    then raise exception 'SHUZO Artist relation did not become Public'; end if;
  if not exists (select 1 from public.collection_holdings where id = '98000000-0000-0000-0000-000000000002' and visibility_status = 'public' and not visibility_overridden and hidden_reason is null)
    then raise exception 'ToMuCo Holding relation did not become Public'; end if;

  if exists (select 1 from public.work_artists where id in ('97000000-0000-0000-0000-000000000003', '97000000-0000-0000-0000-000000000004') and visibility_status <> 'hidden')
    then raise exception 'Source-less or unknown Artist relation remained Public'; end if;
  if exists (select 1 from public.work_artists where id = '97000000-0000-0000-0000-000000000007' and visibility_status <> 'hidden')
    then raise exception 'Review-required Artist relation remained Public'; end if;
  if exists (select 1 from public.collection_holdings where id in ('98000000-0000-0000-0000-000000000003', '98000000-0000-0000-0000-000000000004') and visibility_status <> 'hidden')
    then raise exception 'Source-less or unknown Holding relation remained Public'; end if;

  if not exists (select 1 from public.work_artists where id = '97000000-0000-0000-0000-000000000005' and visibility_status = 'hidden' and visibility_overridden and hidden_reason = 'operator hide')
    then raise exception 'Manual Artist hide was changed'; end if;
  if not exists (select 1 from public.collection_holdings where id = '98000000-0000-0000-0000-000000000005' and visibility_status = 'hidden' and visibility_overridden and hidden_reason = 'operator hide')
    then raise exception 'Manual Holding hide was changed'; end if;
  if not exists (select 1 from public.work_artists where id = '97000000-0000-0000-0000-000000000006' and visibility_status = 'public' and visibility_overridden)
    then raise exception 'Manual Artist Public was changed'; end if;
  if not exists (select 1 from public.collection_holdings where id = '98000000-0000-0000-0000-000000000006' and visibility_status = 'public' and visibility_overridden)
    then raise exception 'Manual Holding Public was changed'; end if;

  if (select column_default from information_schema.columns where table_schema = 'public' and table_name = 'work_artists' and column_name = 'visibility_status') <> '''hidden''::text'
    then raise exception 'work_artists schema default is not hidden'; end if;
  if (select column_default from information_schema.columns where table_schema = 'public' and table_name = 'collection_holdings' and column_name = 'visibility_status') <> '''hidden''::text'
    then raise exception 'collection_holdings schema default is not hidden'; end if;
end $$;

rollback;
