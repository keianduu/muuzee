\set ON_ERROR_STOP on

begin;

delete from public.source_image_candidates
where id in (
  select ('32590000-0000-4325-8325-02' || lpad(sequence::text,10,'0'))::uuid
  from (values (1),(2),(3),(101),(102),(103),(201),(202),(203),(301),(302),(303)) fixture(sequence)
)
or source_record_id in (
  select ('32590000-0000-4325-8325-01' || lpad(sequence::text,10,'0'))::uuid
  from (
    select i as sequence from generate_series(1,12) fixture(i)
    union all select 100 + i from generate_series(1,12) fixture(i)
    union all select 200 + i from generate_series(1,12) fixture(i)
    union all select 300 + i from generate_series(1,12) fixture(i)
  ) fixture_sequences
);

delete from public.exhibition_artist_mentions
where exhibition_id = any(array(select ('32590000-0000-4325-8325-4' || lpad(i::text,11,'0'))::uuid from generate_series(1,56) fixture(i)))
   or source_record_id in (
     select ('32590000-0000-4325-8325-01' || lpad(sequence::text,10,'0'))::uuid
     from (
       select i as sequence from generate_series(1,12) fixture(i)
       union all select 100 + i from generate_series(1,12) fixture(i)
       union all select 200 + i from generate_series(1,12) fixture(i)
       union all select 300 + i from generate_series(1,12) fixture(i)
     ) fixture_sequences
   );

delete from public.exhibition_venue_mentions
where exhibition_id = any(array(select ('32590000-0000-4325-8325-4' || lpad(i::text,11,'0'))::uuid from generate_series(1,56) fixture(i)))
   or source_record_id in (
     select ('32590000-0000-4325-8325-01' || lpad(sequence::text,10,'0'))::uuid
     from (
       select i as sequence from generate_series(1,12) fixture(i)
       union all select 100 + i from generate_series(1,12) fixture(i)
       union all select 200 + i from generate_series(1,12) fixture(i)
       union all select 300 + i from generate_series(1,12) fixture(i)
     ) fixture_sequences
   );

delete from public.exhibition_artists
where exhibition_id = any(array(select ('32590000-0000-4325-8325-4' || lpad(i::text,11,'0'))::uuid from generate_series(1,56) fixture(i)))
   or artist_id = any(array(select ('32590000-0000-4325-8325-2' || lpad(i::text,11,'0'))::uuid from generate_series(1,56) fixture(i)));

delete from public.exhibition_occurrences
where exhibition_id = any(array(select ('32590000-0000-4325-8325-4' || lpad(i::text,11,'0'))::uuid from generate_series(1,56) fixture(i)))
   or venue_id = any(array(select ('32590000-0000-4325-8325-1' || lpad(i::text,11,'0'))::uuid from generate_series(1,56) fixture(i)));

delete from public.work_presentations
where work_id = any(array(select ('32590000-0000-4325-8325-3' || lpad(i::text,11,'0'))::uuid from generate_series(1,56) fixture(i)))
   or venue_id = any(array(select ('32590000-0000-4325-8325-1' || lpad(i::text,11,'0'))::uuid from generate_series(1,56) fixture(i)));

delete from public.collection_holdings
where work_id = any(array(select ('32590000-0000-4325-8325-3' || lpad(i::text,11,'0'))::uuid from generate_series(1,56) fixture(i)))
   or venue_id = any(array(select ('32590000-0000-4325-8325-1' || lpad(i::text,11,'0'))::uuid from generate_series(1,56) fixture(i)));

delete from public.work_artists
where work_id = any(array(select ('32590000-0000-4325-8325-3' || lpad(i::text,11,'0'))::uuid from generate_series(1,56) fixture(i)))
   or artist_id = any(array(select ('32590000-0000-4325-8325-2' || lpad(i::text,11,'0'))::uuid from generate_series(1,56) fixture(i)));

delete from public.media_assets
where exhibition_id = any(array(select ('32590000-0000-4325-8325-4' || lpad(i::text,11,'0'))::uuid from generate_series(1,56) fixture(i)))
   or venue_id = any(array(select ('32590000-0000-4325-8325-1' || lpad(i::text,11,'0'))::uuid from generate_series(1,56) fixture(i)))
   or artist_id = any(array(select ('32590000-0000-4325-8325-2' || lpad(i::text,11,'0'))::uuid from generate_series(1,56) fixture(i)))
   or work_id = any(array(select ('32590000-0000-4325-8325-3' || lpad(i::text,11,'0'))::uuid from generate_series(1,56) fixture(i)));

delete from public.source_records
where data_source_id = '32590000-0000-4325-8325-000000000001'
   or id in (
     select ('32590000-0000-4325-8325-01' || lpad(sequence::text,10,'0'))::uuid
     from (
       select i as sequence from generate_series(1,12) fixture(i)
       union all select 100 + i from generate_series(1,12) fixture(i)
       union all select 200 + i from generate_series(1,12) fixture(i)
       union all select 300 + i from generate_series(1,12) fixture(i)
     ) fixture_sequences
   );

delete from public.exhibitions
where id = any(array(select ('32590000-0000-4325-8325-4' || lpad(i::text,11,'0'))::uuid from generate_series(1,56) fixture(i)));

delete from public.works
where id = any(array(select ('32590000-0000-4325-8325-3' || lpad(i::text,11,'0'))::uuid from generate_series(1,56) fixture(i)));

delete from public.artists
where id = any(array(select ('32590000-0000-4325-8325-2' || lpad(i::text,11,'0'))::uuid from generate_series(1,56) fixture(i)));

delete from public.venues
where id = any(array(select ('32590000-0000-4325-8325-1' || lpad(i::text,11,'0'))::uuid from generate_series(1,56) fixture(i)));

delete from public.data_sources
where id = '32590000-0000-4325-8325-000000000001'
   or key = 'muuzee_stg_admin_review_fixture';

do $$
declare
  residue integer;
begin
  select
    (select count(*) from public.data_sources where id = '32590000-0000-4325-8325-000000000001' or key = 'muuzee_stg_admin_review_fixture') +
    (select count(*) from public.venues where id = any(array(select ('32590000-0000-4325-8325-1' || lpad(i::text,11,'0'))::uuid from generate_series(1,56) fixture(i)))) +
    (select count(*) from public.artists where id = any(array(select ('32590000-0000-4325-8325-2' || lpad(i::text,11,'0'))::uuid from generate_series(1,56) fixture(i)))) +
    (select count(*) from public.works where id = any(array(select ('32590000-0000-4325-8325-3' || lpad(i::text,11,'0'))::uuid from generate_series(1,56) fixture(i)))) +
    (select count(*) from public.exhibitions where id = any(array(select ('32590000-0000-4325-8325-4' || lpad(i::text,11,'0'))::uuid from generate_series(1,56) fixture(i)))) +
    (select count(*) from public.source_records where data_source_id = '32590000-0000-4325-8325-000000000001' or id::text like '32590000-0000-4325-8325-01%') +
    (select count(*) from public.source_image_candidates where id::text like '32590000-0000-4325-8325-02%' or source_record_id::text like '32590000-0000-4325-8325-01%') +
    (select count(*) from public.media_assets
      where id::text like '32590000-0000-4325-8325-03%'
         or exhibition_id = any(array(select ('32590000-0000-4325-8325-4' || lpad(i::text,11,'0'))::uuid from generate_series(1,56) fixture(i)))
         or venue_id = any(array(select ('32590000-0000-4325-8325-1' || lpad(i::text,11,'0'))::uuid from generate_series(1,56) fixture(i)))
         or artist_id = any(array(select ('32590000-0000-4325-8325-2' || lpad(i::text,11,'0'))::uuid from generate_series(1,56) fixture(i)))
         or work_id = any(array(select ('32590000-0000-4325-8325-3' || lpad(i::text,11,'0'))::uuid from generate_series(1,56) fixture(i)))) +
    (select count(*) from public.exhibition_occurrences
      where exhibition_id = any(array(select ('32590000-0000-4325-8325-4' || lpad(i::text,11,'0'))::uuid from generate_series(1,56) fixture(i)))
         or venue_id = any(array(select ('32590000-0000-4325-8325-1' || lpad(i::text,11,'0'))::uuid from generate_series(1,56) fixture(i)))) +
    (select count(*) from public.exhibition_artists
      where exhibition_id = any(array(select ('32590000-0000-4325-8325-4' || lpad(i::text,11,'0'))::uuid from generate_series(1,56) fixture(i)))
         or artist_id = any(array(select ('32590000-0000-4325-8325-2' || lpad(i::text,11,'0'))::uuid from generate_series(1,56) fixture(i)))) +
    (select count(*) from public.exhibition_venue_mentions
      where exhibition_id = any(array(select ('32590000-0000-4325-8325-4' || lpad(i::text,11,'0'))::uuid from generate_series(1,56) fixture(i)))
         or source_record_id::text like '32590000-0000-4325-8325-01%') +
    (select count(*) from public.exhibition_artist_mentions
      where exhibition_id = any(array(select ('32590000-0000-4325-8325-4' || lpad(i::text,11,'0'))::uuid from generate_series(1,56) fixture(i)))
         or source_record_id::text like '32590000-0000-4325-8325-01%') +
    (select count(*) from public.work_artists
      where work_id = any(array(select ('32590000-0000-4325-8325-3' || lpad(i::text,11,'0'))::uuid from generate_series(1,56) fixture(i)))
         or artist_id = any(array(select ('32590000-0000-4325-8325-2' || lpad(i::text,11,'0'))::uuid from generate_series(1,56) fixture(i)))) +
    (select count(*) from public.collection_holdings
      where work_id = any(array(select ('32590000-0000-4325-8325-3' || lpad(i::text,11,'0'))::uuid from generate_series(1,56) fixture(i)))
         or venue_id = any(array(select ('32590000-0000-4325-8325-1' || lpad(i::text,11,'0'))::uuid from generate_series(1,56) fixture(i)))) +
    (select count(*) from public.work_presentations
      where work_id = any(array(select ('32590000-0000-4325-8325-3' || lpad(i::text,11,'0'))::uuid from generate_series(1,56) fixture(i)))
         or venue_id = any(array(select ('32590000-0000-4325-8325-1' || lpad(i::text,11,'0'))::uuid from generate_series(1,56) fixture(i))))
  into residue;
  if residue <> 0 then raise exception 'Order 325.9 cleanup residue: %', residue; end if;
end;
$$;

commit;
