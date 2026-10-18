with
fixture_venues as (
  select ('32590000-0000-4325-8325-1' || lpad(i::text, 11, '0'))::uuid as id
  from generate_series(1, 56) fixture(i)
),
fixture_artists as (
  select ('32590000-0000-4325-8325-2' || lpad(i::text, 11, '0'))::uuid as id
  from generate_series(1, 56) fixture(i)
),
fixture_works as (
  select ('32590000-0000-4325-8325-3' || lpad(i::text, 11, '0'))::uuid as id
  from generate_series(1, 56) fixture(i)
),
fixture_exhibitions as (
  select ('32590000-0000-4325-8325-4' || lpad(i::text, 11, '0'))::uuid as id
  from generate_series(1, 56) fixture(i)
),
fixture_source_records as (
  select ('32590000-0000-4325-8325-01' || lpad(sequence::text, 10, '0'))::uuid as id
  from (
    select i as sequence from generate_series(1, 12) fixture(i)
    union all select 100 + i from generate_series(1, 12) fixture(i)
    union all select 200 + i from generate_series(1, 12) fixture(i)
    union all select 300 + i from generate_series(1, 12) fixture(i)
  ) fixture_sequences
),
fixture_image_candidates as (
  select ('32590000-0000-4325-8325-02' || lpad(sequence::text, 10, '0'))::uuid as id
  from (values (1),(2),(3),(101),(102),(103),(201),(202),(203),(301),(302),(303)) fixture_sequences(sequence)
),
fixture_media as (
  select ('32590000-0000-4325-8325-03' || lpad(sequence::text, 10, '0'))::uuid as id
  from (
    select i as sequence from generate_series(1, 6) fixture(i)
    union all select 100 + i from generate_series(1, 6) fixture(i)
    union all select 200 + i from generate_series(1, 6) fixture(i)
    union all select 300 + i from generate_series(1, 6) fixture(i)
  ) fixture_sequences
)
select json_build_object(
  'dataSources', (select count(*) from public.data_sources where id = '32590000-0000-4325-8325-000000000001' or key = 'muuzee_stg_admin_review_fixture'),
  'dataSourceExact', (select count(*) from public.data_sources where id = '32590000-0000-4325-8325-000000000001' and key = 'muuzee_stg_admin_review_fixture'),
  'venues', (select count(*) from public.venues where id in (select id from fixture_venues)),
  'artists', (select count(*) from public.artists where id in (select id from fixture_artists)),
  'works', (select count(*) from public.works where id in (select id from fixture_works)),
  'exhibitions', (select count(*) from public.exhibitions where id in (select id from fixture_exhibitions)),
  'sourceRecords', (
    select count(*) from public.source_records
    where id in (select id from fixture_source_records)
       or data_source_id = '32590000-0000-4325-8325-000000000001'
  ),
  'imageCandidates', (
    select count(*) from public.source_image_candidates
    where id in (select id from fixture_image_candidates)
       or source_record_id in (select id from fixture_source_records)
  ),
  'mediaAssets', (
    select count(*) from public.media_assets
    where id in (select id from fixture_media)
       or exhibition_id in (select id from fixture_exhibitions)
       or venue_id in (select id from fixture_venues)
       or artist_id in (select id from fixture_artists)
       or work_id in (select id from fixture_works)
  ),
  'approvedMediaAssets', (
    select count(*) from public.media_assets
    where id in (select id from fixture_media)
      and rights_status = 'approved'
      and rights_checked_at is not null
  ),
  'candidateRightsStates', (
    select count(distinct rights_status) from public.source_image_candidates
    where id in (select id from fixture_image_candidates)
  ),
  'occurrences', (
    select count(*) from public.exhibition_occurrences
    where exhibition_id in (select id from fixture_exhibitions)
       or venue_id in (select id from fixture_venues)
  ),
  'exhibitionArtists', (
    select count(*) from public.exhibition_artists
    where exhibition_id in (select id from fixture_exhibitions)
       or artist_id in (select id from fixture_artists)
  ),
  'venueMentions', (
    select count(*) from public.exhibition_venue_mentions
    where exhibition_id in (select id from fixture_exhibitions)
       or source_record_id in (select id from fixture_source_records)
  ),
  'artistMentions', (
    select count(*) from public.exhibition_artist_mentions
    where exhibition_id in (select id from fixture_exhibitions)
       or source_record_id in (select id from fixture_source_records)
  ),
  'workArtists', (
    select count(*) from public.work_artists
    where work_id in (select id from fixture_works)
       or artist_id in (select id from fixture_artists)
  ),
  'collectionHoldings', (
    select count(*) from public.collection_holdings
    where work_id in (select id from fixture_works)
       or venue_id in (select id from fixture_venues)
  ),
  'workPresentations', (
    select count(*) from public.work_presentations
    where work_id in (select id from fixture_works)
       or venue_id in (select id from fixture_venues)
  )
)::text;
