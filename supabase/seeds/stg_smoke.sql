begin;

insert into public.venues (
  id,
  slug,
  name,
  name_en,
  venue_type,
  prefecture,
  city,
  address,
  latitude,
  longitude,
  normalized_name,
  normalized_address,
  country_code,
  description,
  publication_status,
  is_active
) values (
  '30000000-0000-4000-8000-000000000001',
  'stg-smoke-venue',
  'STG Smoke Venue',
  'STG Smoke Venue',
  'museum',
  '東京都',
  'テスト区',
  'テスト町1-1',
  35.681236,
  139.767125,
  'stg smoke venue',
  '東京都テスト区テスト町1-1',
  'JP',
  'STG smoke test専用のsynthetic venueです。',
  'published',
  true
)
on conflict (id) do update set
  slug = excluded.slug,
  name = excluded.name,
  name_en = excluded.name_en,
  venue_type = excluded.venue_type,
  prefecture = excluded.prefecture,
  city = excluded.city,
  address = excluded.address,
  latitude = excluded.latitude,
  longitude = excluded.longitude,
  normalized_name = excluded.normalized_name,
  normalized_address = excluded.normalized_address,
  country_code = excluded.country_code,
  description = excluded.description,
  publication_status = excluded.publication_status,
  is_active = excluded.is_active,
  updated_at = now();

insert into public.artists (
  id,
  slug,
  name,
  name_en,
  nationality_country_code,
  description,
  publication_status
) values (
  '30000000-0000-4000-8000-000000000002',
  'stg-smoke-artist',
  'STG Smoke Artist',
  'STG Smoke Artist',
  'JP',
  'STG smoke test専用のsynthetic artistです。',
  'published'
)
on conflict (id) do update set
  slug = excluded.slug,
  name = excluded.name,
  name_en = excluded.name_en,
  nationality_country_code = excluded.nationality_country_code,
  description = excluded.description,
  publication_status = excluded.publication_status,
  updated_at = now();

insert into public.works (
  id,
  slug,
  title,
  title_ja,
  title_en,
  year_text,
  created_year_from,
  created_year_to,
  description,
  publication_status
) values (
  '30000000-0000-4000-8000-000000000003',
  'stg-smoke-work',
  'STG Smoke Work',
  'STG Smoke Work',
  'STG Smoke Work',
  '2026',
  2026,
  2026,
  'STG smoke test専用のsynthetic workです。',
  'published'
)
on conflict (id) do update set
  slug = excluded.slug,
  title = excluded.title,
  title_ja = excluded.title_ja,
  title_en = excluded.title_en,
  year_text = excluded.year_text,
  created_year_from = excluded.created_year_from,
  created_year_to = excluded.created_year_to,
  description = excluded.description,
  publication_status = excluded.publication_status,
  updated_at = now();

insert into public.exhibitions (
  id,
  slug,
  title,
  title_en,
  description,
  exhibition_type,
  publication_status
) values (
  '30000000-0000-4000-8000-000000000004',
  'stg-smoke-exhibition',
  'STG Smoke Exhibition',
  'STG Smoke Exhibition',
  'STG smoke test専用のsynthetic exhibitionです。',
  '企画展',
  'published'
)
on conflict (id) do update set
  slug = excluded.slug,
  title = excluded.title,
  title_en = excluded.title_en,
  description = excluded.description,
  exhibition_type = excluded.exhibition_type,
  publication_status = excluded.publication_status,
  updated_at = now();

insert into public.exhibition_occurrences (
  id,
  exhibition_id,
  venue_id,
  start_date,
  end_date,
  opening_hours_text,
  closed_days_text,
  relation_status
) values (
  '30000000-0000-4000-8000-000000000005',
  '30000000-0000-4000-8000-000000000004',
  '30000000-0000-4000-8000-000000000001',
  '2026-10-01',
  '2027-12-31',
  '10:00–18:00',
  'テスト日のみ休館',
  'active'
)
on conflict (id) do update set
  exhibition_id = excluded.exhibition_id,
  venue_id = excluded.venue_id,
  start_date = excluded.start_date,
  end_date = excluded.end_date,
  opening_hours_text = excluded.opening_hours_text,
  closed_days_text = excluded.closed_days_text,
  relation_status = excluded.relation_status,
  updated_at = now();

insert into public.exhibition_artists (
  id,
  exhibition_id,
  artist_id,
  role,
  sort_order,
  source_artist_name,
  match_status,
  relation_status
) values (
  '30000000-0000-4000-8000-000000000006',
  '30000000-0000-4000-8000-000000000004',
  '30000000-0000-4000-8000-000000000002',
  '参加作家',
  1,
  'STG Smoke Artist',
  'matched',
  'active'
)
on conflict (id) do update set
  exhibition_id = excluded.exhibition_id,
  artist_id = excluded.artist_id,
  role = excluded.role,
  sort_order = excluded.sort_order,
  source_artist_name = excluded.source_artist_name,
  match_status = excluded.match_status,
  relation_status = excluded.relation_status,
  updated_at = now();

insert into public.work_artists (
  id,
  work_id,
  artist_id,
  role,
  sort_order,
  source,
  visibility_status,
  visibility_overridden,
  hidden_reason
) values (
  '30000000-0000-4000-8000-000000000007',
  '30000000-0000-4000-8000-000000000003',
  '30000000-0000-4000-8000-000000000002',
  'artist',
  1,
  'manual',
  'public',
  true,
  null
)
on conflict (id) do update set
  work_id = excluded.work_id,
  artist_id = excluded.artist_id,
  role = excluded.role,
  sort_order = excluded.sort_order,
  source = excluded.source,
  visibility_status = excluded.visibility_status,
  visibility_overridden = excluded.visibility_overridden,
  hidden_reason = excluded.hidden_reason,
  visibility_updated_at = now();

insert into public.collection_holdings (
  id,
  venue_id,
  work_id,
  holding_type,
  inventory_number,
  source,
  visibility_status,
  visibility_overridden,
  hidden_reason
) values (
  '30000000-0000-4000-8000-000000000008',
  '30000000-0000-4000-8000-000000000001',
  '30000000-0000-4000-8000-000000000003',
  'collection',
  null,
  'manual',
  'public',
  true,
  null
)
on conflict (id) do update set
  venue_id = excluded.venue_id,
  work_id = excluded.work_id,
  holding_type = excluded.holding_type,
  inventory_number = excluded.inventory_number,
  source = excluded.source,
  visibility_status = excluded.visibility_status,
  visibility_overridden = excluded.visibility_overridden,
  hidden_reason = excluded.hidden_reason,
  visibility_updated_at = now(),
  updated_at = now();

insert into public.tags (
  id,
  type,
  name,
  slug
) values (
  '30000000-0000-4000-8000-000000000009',
  'theme',
  'STG Smoke',
  'stg-smoke'
)
on conflict (id) do update set
  type = excluded.type,
  name = excluded.name,
  slug = excluded.slug;

insert into public.exhibition_tags (
  exhibition_id,
  tag_id
) values (
  '30000000-0000-4000-8000-000000000004',
  '30000000-0000-4000-8000-000000000009'
)
on conflict (exhibition_id, tag_id) do nothing;

do $$
declare
  expected_count integer;
begin
  select count(*) into expected_count
  from (
    select id from public.venues where id = '30000000-0000-4000-8000-000000000001'
    union all
    select id from public.artists where id = '30000000-0000-4000-8000-000000000002'
    union all
    select id from public.works where id = '30000000-0000-4000-8000-000000000003'
    union all
    select id from public.exhibitions where id = '30000000-0000-4000-8000-000000000004'
    union all
    select id from public.exhibition_occurrences where id = '30000000-0000-4000-8000-000000000005'
    union all
    select id from public.exhibition_artists where id = '30000000-0000-4000-8000-000000000006'
    union all
    select id from public.work_artists where id = '30000000-0000-4000-8000-000000000007'
    union all
    select id from public.collection_holdings where id = '30000000-0000-4000-8000-000000000008'
    union all
    select id from public.tags where id = '30000000-0000-4000-8000-000000000009'
  ) seeded_entities;

  if expected_count <> 9 then
    raise exception 'STG smoke seed verification failed: expected 9 stable entity/relation rows, found %', expected_count;
  end if;

  if (select count(*) from public.exhibition_tags
      where exhibition_id = '30000000-0000-4000-8000-000000000004'
        and tag_id = '30000000-0000-4000-8000-000000000009') <> 1 then
    raise exception 'STG smoke seed verification failed: expected one exhibition tag relation';
  end if;

  if (select count(*) from public.exhibitions where slug = 'stg-smoke-exhibition') <> 1 then
    raise exception 'STG smoke seed verification failed: public smoke slug is not unique';
  end if;
end $$;

commit;
