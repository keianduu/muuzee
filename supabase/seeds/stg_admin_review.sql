\set ON_ERROR_STOP on

begin;

insert into public.data_sources (
  id,
  key,
  name,
  base_url,
  terms_url,
  metadata_license
) values (
  '32590000-0000-4325-8325-000000000001',
  'muuzee_stg_admin_review_fixture',
  'Muuzee STG Admin Review Fixture',
  :'fixture_base_url',
  null,
  'Synthetic Muuzee QA fixture; LOCAL/STG only'
)
on conflict (id) do update set
  key = excluded.key,
  name = excluded.name,
  base_url = excluded.base_url,
  terms_url = excluded.terms_url,
  metadata_license = excluded.metadata_license;

insert into public.venues (
  id,
  slug,
  name,
  name_en,
  name_native,
  venue_type,
  postal_code,
  prefecture,
  city,
  address,
  latitude,
  longitude,
  normalized_name,
  normalized_address,
  official_url,
  country_code,
  description,
  access_text,
  opening_hours_text,
  closed_days_text,
  publication_status,
  is_active,
  manual_priority_tier,
  tier_reason,
  tier_calculated_at,
  image_search_status
)
select
  ('32590000-0000-4325-8325-1' || lpad(i::text, 11, '0'))::uuid,
  'order3259-stg-qa-venue-' || lpad(i::text, 2, '0'),
  case
    when i = 55 then '[STG QA] Venue 55 | 非常に長い名称を持つ国際現代美術文化交流研究展示複合施設・Tier E'
    else '[STG QA] Venue ' || lpad(i::text, 2, '0') || ' | ' ||
      case ((i - 1) % 5)
        when 0 then 'Museum'
        when 1 then 'Gallery'
        when 2 then 'Art Space'
        when 3 then 'Commercial Space'
        else 'Other'
      end || '・Tier ' || (array['A','B','C','D','E'])[((i - 1) % 5) + 1]
  end,
  case when i % 2 = 1 then 'STG QA Venue ' || lpad(i::text, 2, '0') else null end,
  case when i % 3 = 1 then 'STG QA 会場 ' || lpad(i::text, 2, '0') else null end,
  (array['museum','gallery','art_space','commercial_space','other'])[((i - 1) % 5) + 1],
  case when i % 4 <> 0 then '100-' || lpad(i::text, 4, '0') else null end,
  case when i % 3 <> 0 then '東京都' else null end,
  case when i % 3 <> 0 then 'QA区' else null end,
  case
    when i = 54 then '東京都QA区とても長い地名と建物名を含む一丁目二番三号 STG Admin Review Fixture Annex East Wing 54F'
    when i % 3 <> 0 then '東京都QA区レビュー' || i || '丁目' || i || '番地'
    else null
  end,
  case when i % 4 <> 0 then 35.60 + i::numeric / 1000 else null end,
  case when i % 4 <> 0 then 139.60 + i::numeric / 1000 else null end,
  'stg qa venue ' || lpad(i::text, 2, '0'),
  case when i % 3 <> 0 then '東京都qa区レビュー' || i || '丁目' || i || '番地' else null end,
  case when i % 4 <> 0 then :'fixture_base_url' || '/fixtures/order3259-venue-' || lpad(i::text, 2, '0') else null end,
  'JP',
  case
    when i = 53 then repeat('STG Admin Review用の長文説明です。状態差とDrawer内の折り返しを確認します。', 10)
    when i % 5 <> 0 then '[STG QA] Venue ' || lpad(i::text, 2, '0') || ' のsynthetic descriptionです。'
    else null
  end,
  case when i % 4 in (1, 2) then 'QA駅から徒歩' || ((i % 9) + 1) || '分' else null end,
  case when i % 6 in (1, 2, 3) then '10:00–18:00（STG QA）' else null end,
  case when i % 4 in (1, 3) then '月曜日・fixture maintenance day' else null end,
  case
    when i in (1, 5) then 'published'
    when i in (4, 8) then 'archived'
    when i % 2 = 0 then 'ready'
    else 'draft'
  end,
  true,
  (array['A','B','C','D','E'])[((i - 1) % 5) + 1],
  'Order 325.9 deterministic Admin review fixture',
  '2026-10-16T00:00:00Z'::timestamptz,
  case
    when i in (1,2,3,4,5,6) then 'approved_image_exists'
    when i in (7,8) then 'image_candidate_found'
    else 'no_image_candidate'
  end
from generate_series(1, 56) as fixture(i)
on conflict (id) do update set
  slug = excluded.slug,
  name = excluded.name,
  name_en = excluded.name_en,
  name_native = excluded.name_native,
  venue_type = excluded.venue_type,
  postal_code = excluded.postal_code,
  prefecture = excluded.prefecture,
  city = excluded.city,
  address = excluded.address,
  latitude = excluded.latitude,
  longitude = excluded.longitude,
  normalized_name = excluded.normalized_name,
  normalized_address = excluded.normalized_address,
  official_url = excluded.official_url,
  country_code = excluded.country_code,
  description = excluded.description,
  access_text = excluded.access_text,
  opening_hours_text = excluded.opening_hours_text,
  closed_days_text = excluded.closed_days_text,
  publication_status = excluded.publication_status,
  is_active = excluded.is_active,
  manual_priority_tier = excluded.manual_priority_tier,
  tier_reason = excluded.tier_reason,
  tier_calculated_at = excluded.tier_calculated_at,
  image_search_status = excluded.image_search_status,
  updated_at = now();

insert into public.artists (
  id,
  slug,
  name,
  name_en,
  name_native,
  name_kana,
  aliases,
  birth_year,
  death_year,
  nationality_country_code,
  description,
  style_summary,
  official_url,
  publication_status,
  manual_priority_tier,
  tier_reason,
  tier_calculated_at
)
select
  ('32590000-0000-4325-8325-2' || lpad(i::text, 11, '0'))::uuid,
  'order3259-stg-qa-artist-' || lpad(i::text, 2, '0'),
  case
    when i = 1 then '[STG QA] Artist Zeta | Tier A・Name Only'
    when i = 2 then '[STG QA] Artist Alpha | Tier C・50%'
    when i in (20, 23) then '[STG QA] Artist Tie | Tier B・50%'
    when i = 55 then '[STG QA] Artist 55 | 非常に長い作家名を持つ国際的な架空共同制作アーティスト・コレクティブ'
    else '[STG QA] Artist ' || lpad(i::text, 2, '0') || ' | Tier ' || (array['A','B','C'])[((i - 1) % 3) + 1]
  end,
  case
    when i in (20,23) then 'STG QA Artist Tie'
    when i % 4 in (2,3,0) then 'STG QA Artist ' || lpad(i::text, 2, '0')
    else null
  end,
  case when i % 5 = 0 then 'STG QA Native Artist ' || lpad(i::text, 2, '0') else null end,
  case when i % 6 = 0 then 'ステージング キューエー アーティスト ' || lpad(i::text, 2, '0') else null end,
  case when i % 7 = 0 then array['STG QA alias ' || i, 'Fixture Artist ' || i] else '{}'::text[] end,
  case when i % 3 <> 1 then 1900 + i else null end,
  case when i % 6 = 0 then 1960 + i else null end,
  case
    when i in (20,23) then null
    when i % 4 in (3,0) then (array['JP','FR','US','DE'])[((i - 1) % 4) + 1]
    else null
  end,
  case
    when i = 54 then repeat('STG Admin Review用Artist長文説明です。BiographyとDrawerの折り返しを確認します。', 9)
    when i % 3 = 0 then '[STG QA] Artist ' || lpad(i::text, 2, '0') || ' のsynthetic biographyです。'
    else null
  end,
  case when i % 5 = 0 then 'Synthetic review practice / multidisciplinary' else null end,
  case when i % 4 = 0 then :'fixture_base_url' || '/fixtures/order3259-artist-' || lpad(i::text, 2, '0') else null end,
  case
    when i in (1, 5) then 'published'
    when i in (4, 8) then 'archived'
    when i % 2 = 0 then 'ready'
    else 'draft'
  end,
  case
    when i = 1 then 'A'
    when i = 2 then 'C'
    when i in (20,23) then 'B'
    else (array['A','B','C'])[((i - 1) % 3) + 1]
  end,
  'Order 325.9 deterministic canonical-sort fixture',
  '2026-10-16T00:00:00Z'::timestamptz
from generate_series(1, 56) as fixture(i)
on conflict (id) do update set
  slug = excluded.slug,
  name = excluded.name,
  name_en = excluded.name_en,
  name_native = excluded.name_native,
  name_kana = excluded.name_kana,
  aliases = excluded.aliases,
  birth_year = excluded.birth_year,
  death_year = excluded.death_year,
  nationality_country_code = excluded.nationality_country_code,
  description = excluded.description,
  style_summary = excluded.style_summary,
  official_url = excluded.official_url,
  publication_status = excluded.publication_status,
  manual_priority_tier = excluded.manual_priority_tier,
  tier_reason = excluded.tier_reason,
  tier_calculated_at = excluded.tier_calculated_at,
  updated_at = now();

insert into public.works (
  id,
  slug,
  title,
  title_ja,
  title_en,
  title_original,
  original_language,
  year_text,
  created_year_from,
  created_year_to,
  description,
  medium,
  dimensions,
  publication_status
)
select
  ('32590000-0000-4325-8325-3' || lpad(i::text, 11, '0'))::uuid,
  'order3259-stg-qa-work-' || lpad(i::text, 2, '0'),
  case
    when i = 55 then '[STG QA] Work 55 | 非常に長い作品名による一覧セルとDetail Drawerの複数行折り返しを確認するための架空作品'
    else '[STG QA] Work ' || lpad(i::text, 2, '0') || ' | ' ||
      case (i % 5)
        when 1 then 'Japanese Title'
        when 2 then 'English Title Only'
        when 3 then 'Original Title Only'
        when 4 then 'Legacy Title Fallback'
        else 'Relation Review'
      end
  end,
  case when i % 5 in (1,0) then '[STG QA] 作品 ' || lpad(i::text, 2, '0') else null end,
  case when i % 5 = 2 then '[STG QA] Work ' || lpad(i::text, 2, '0') || ' English Only' else null end,
  case when i % 5 = 3 then '[STG QA] Opus ' || lpad(i::text, 2, '0') else null end,
  case when i % 5 = 3 then 'fr' else null end,
  case when i % 4 = 1 then (1900 + i)::text || '頃' else null end,
  case when i % 4 in (2,3) then 1900 + i else null end,
  case when i % 4 = 3 then 1905 + i else case when i % 4 = 2 then 1900 + i else null end end,
  case
    when i = 54 then repeat('STG Admin Review用Work長文説明です。作品情報とRelation sectionの表示を確認します。', 9)
    when i % 3 <> 0 then '[STG QA] Work ' || lpad(i::text, 2, '0') || ' のsynthetic descriptionです。'
    else null
  end,
  case when i % 3 in (1,2) then 'Synthetic mixed media on fixture board' else null end,
  case when i % 4 in (1,2) then (20 + i)::text || ' × ' || (30 + i)::text || ' cm' else null end,
  case
    when i in (1, 5) then 'published'
    when i in (4, 8) then 'archived'
    when i % 2 = 0 then 'ready'
    else 'draft'
  end
from generate_series(1, 56) as fixture(i)
on conflict (id) do update set
  slug = excluded.slug,
  title = excluded.title,
  title_ja = excluded.title_ja,
  title_en = excluded.title_en,
  title_original = excluded.title_original,
  original_language = excluded.original_language,
  year_text = excluded.year_text,
  created_year_from = excluded.created_year_from,
  created_year_to = excluded.created_year_to,
  description = excluded.description,
  medium = excluded.medium,
  dimensions = excluded.dimensions,
  publication_status = excluded.publication_status,
  updated_at = now();

insert into public.exhibitions (
  id,
  slug,
  title,
  title_en,
  description,
  exhibition_type,
  official_url,
  publication_status
)
select
  ('32590000-0000-4325-8325-4' || lpad(i::text, 11, '0'))::uuid,
  'order3259-stg-qa-exhibition-' || lpad(i::text, 2, '0'),
  case
    when i = 1 then '[STG QA] Exhibition 01 | 開催中・多数Artist・公開可能'
    when i = 2 then '[STG QA] Exhibition 02 | 開催予定・Draft'
    when i = 3 then '[STG QA] Exhibition 03 | 終了済み・Ready'
    when i = 4 then '[STG QA] Exhibition 04 | 会期不明・Archived'
    when i = 5 then '[STG QA] Exhibition 05 | 開始日のみ'
    when i = 6 then '[STG QA] Exhibition 06 | 終了日のみ'
    when i = 7 then '[STG QA] Exhibition 07 | 1日開催・画像候補1件'
    when i = 8 then '[STG QA] Exhibition 08 | Venue未解決mentionのみ'
    when i = 9 then '[STG QA] Exhibition 09 | Artist未解決mentionのみ'
    when i = 10 then '[STG QA] Exhibition 10 | 画像候補複数'
    when i = 16 then '[STG QA] Exhibition 16 | Venueなし・会期なし'
    when i = 55 then '[STG QA] Exhibition 55 | 非常に長い展覧会タイトルによる一覧セルとDetail Drawerの複数行折り返しを確認するための架空国際展'
    else '[STG QA] Exhibition ' || lpad(i::text, 2, '0') || ' | Schedule / Relation Review'
  end,
  case when i % 2 = 0 then 'STG QA Exhibition ' || lpad(i::text, 2, '0') else null end,
  case
    when i = 54 then repeat('STG Admin Review用Exhibition長文説明です。会期・Relation・画像状態を含むDetail表示を確認します。', 10)
    when i % 3 <> 0 then '[STG QA] Exhibition ' || lpad(i::text, 2, '0') || ' のsynthetic descriptionです。'
    else null
  end,
  (array['企画展','常設展','巡回展','その他'])[((i - 1) % 4) + 1],
  case when i % 4 <> 0 then :'fixture_base_url' || '/fixtures/order3259-exhibition-' || lpad(i::text, 2, '0') else null end,
  case
    when i in (1, 5) then 'published'
    when i in (4, 8) then 'archived'
    when i % 2 = 0 then 'ready'
    else 'draft'
  end
from generate_series(1, 56) as fixture(i)
on conflict (id) do update set
  slug = excluded.slug,
  title = excluded.title,
  title_en = excluded.title_en,
  description = excluded.description,
  exhibition_type = excluded.exhibition_type,
  official_url = excluded.official_url,
  publication_status = excluded.publication_status,
  updated_at = now();

with fixture_records as (
  select 'venue'::text as owner_type, i as owner_index, i as record_sequence from generate_series(1, 12) as fixture(i)
  union all
  select 'artist', i, 100 + i from generate_series(1, 12) as fixture(i)
  union all
  select 'work', i, 200 + i from generate_series(1, 12) as fixture(i)
  union all
  select 'exhibition', i, 300 + i from generate_series(1, 12) as fixture(i)
)
insert into public.source_records (
  id,
  data_source_id,
  external_id,
  source_url,
  raw_payload,
  checksum,
  fetched_at,
  venue_id,
  artist_id,
  work_id,
  exhibition_id,
  last_seen_at,
  last_changed_at
)
select
  ('32590000-0000-4325-8325-01' || lpad(record_sequence::text, 10, '0'))::uuid,
  '32590000-0000-4325-8325-000000000001'::uuid,
  'order3259-' || owner_type || '-' || lpad(owner_index::text, 2, '0'),
  :'fixture_base_url' || '/fixtures/order3259-source-' || owner_type || '-' || lpad(owner_index::text, 2, '0'),
  jsonb_build_object('fixture', true, 'order', '325.9', 'ownerType', owner_type, 'ownerIndex', owner_index),
  md5('order3259-' || owner_type || '-' || owner_index),
  '2026-10-16T00:00:00Z'::timestamptz,
  case when owner_type = 'venue' then ('32590000-0000-4325-8325-1' || lpad(owner_index::text, 11, '0'))::uuid end,
  case when owner_type = 'artist' then ('32590000-0000-4325-8325-2' || lpad(owner_index::text, 11, '0'))::uuid end,
  case when owner_type = 'work' then ('32590000-0000-4325-8325-3' || lpad(owner_index::text, 11, '0'))::uuid end,
  case when owner_type = 'exhibition' then ('32590000-0000-4325-8325-4' || lpad(owner_index::text, 11, '0'))::uuid end,
  '2026-10-16T00:00:00Z'::timestamptz,
  '2026-10-16T00:00:00Z'::timestamptz
from fixture_records
on conflict (id) do update set
  data_source_id = excluded.data_source_id,
  external_id = excluded.external_id,
  source_url = excluded.source_url,
  raw_payload = excluded.raw_payload,
  checksum = excluded.checksum,
  fetched_at = excluded.fetched_at,
  venue_id = excluded.venue_id,
  artist_id = excluded.artist_id,
  work_id = excluded.work_id,
  exhibition_id = excluded.exhibition_id,
  last_seen_at = excluded.last_seen_at,
  last_changed_at = excluded.last_changed_at;

with candidate_matrix(owner_type, owner_index, candidate_index, candidate_sequence, source_sequence, image_variant, rights_status) as (
  values
    ('venue', 7, 1, 1, 7, 'a', 'approved'),
    ('venue', 8, 1, 2, 8, 'b', 'needs_review'),
    ('venue', 8, 2, 3, 8, 'c', 'rejected'),
    ('artist', 7, 1, 101, 107, 'b', 'approved'),
    ('artist', 8, 1, 102, 108, 'c', 'needs_review'),
    ('artist', 8, 2, 103, 108, 'd', 'rejected'),
    ('work', 7, 1, 201, 207, 'c', 'approved'),
    ('work', 8, 1, 202, 208, 'd', 'needs_review'),
    ('work', 8, 2, 203, 208, 'a', 'rejected'),
    ('exhibition', 7, 1, 301, 307, 'd', 'approved'),
    ('exhibition', 8, 1, 302, 308, 'a', 'needs_review'),
    ('exhibition', 8, 2, 303, 308, 'b', 'rejected')
)
insert into public.source_image_candidates (
  id,
  source_record_id,
  image_url,
  thumbnail_url,
  provider,
  stable_identifier,
  source_url,
  author,
  credit,
  license_short_name,
  license_url,
  usage_terms,
  rights_status,
  candidate_entity_id,
  candidate_entity_label,
  candidate_match_confidence,
  candidate_match_threshold,
  candidate_kind,
  discovery_source,
  source_type,
  commercial_use,
  modification_crop,
  attribution_requirement,
  review_status,
  is_active,
  notes,
  first_seen_at,
  last_seen_at
)
select
  ('32590000-0000-4325-8325-02' || lpad(candidate_sequence::text, 10, '0'))::uuid,
  ('32590000-0000-4325-8325-01' || lpad(source_sequence::text, 10, '0'))::uuid,
  :'fixture_base_url' || '/fixtures/order3259-review-' || image_variant || '.svg',
  :'fixture_base_url' || '/fixtures/order3259-review-' || image_variant || '.svg',
  'muuzee_stg_admin_review_fixture',
  'order3259-' || owner_type || '-' || owner_index || '-candidate-' || candidate_index,
  :'fixture_base_url' || '/fixtures/order3259-review-' || image_variant || '.svg',
  'Muuzee QA Fixture',
  '[STG QA] Synthetic fixture ' || upper(image_variant),
  'CC0 1.0',
  'https://creativecommons.org/publicdomain/zero/1.0/',
  'Synthetic asset generated for Muuzee Admin QA.',
  rights_status,
  ('32590000-0000-4325-8325-' ||
    case owner_type when 'venue' then '1' when 'artist' then '2' when 'work' then '3' else '4' end ||
    lpad(owner_index::text, 11, '0')),
  '[STG QA] ' || initcap(owner_type) || ' ' || lpad(owner_index::text, 2, '0'),
  case when candidate_index = 1 then 0.91 else 0.63 end,
  0.70,
  case when candidate_index = 1 then 'probable' else 'reference' end,
  'open_collection',
  'open_collection',
  case when rights_status = 'approved' then 'allowed' else 'unknown' end,
  case when rights_status = 'approved' then 'allowed' else 'unknown' end,
  'not_required',
  case when rights_status = 'rejected' then 'rejected' else 'unreviewed' end,
  true,
  'Order 325.9 deterministic candidate state.',
  '2026-10-16T00:00:00Z'::timestamptz,
  '2026-10-16T00:00:00Z'::timestamptz
from candidate_matrix
on conflict (id) do update set
  source_record_id = excluded.source_record_id,
  image_url = excluded.image_url,
  thumbnail_url = excluded.thumbnail_url,
  provider = excluded.provider,
  stable_identifier = excluded.stable_identifier,
  source_url = excluded.source_url,
  author = excluded.author,
  credit = excluded.credit,
  license_short_name = excluded.license_short_name,
  license_url = excluded.license_url,
  usage_terms = excluded.usage_terms,
  rights_status = excluded.rights_status,
  candidate_entity_id = excluded.candidate_entity_id,
  candidate_entity_label = excluded.candidate_entity_label,
  candidate_match_confidence = excluded.candidate_match_confidence,
  candidate_match_threshold = excluded.candidate_match_threshold,
  candidate_kind = excluded.candidate_kind,
  discovery_source = excluded.discovery_source,
  source_type = excluded.source_type,
  commercial_use = excluded.commercial_use,
  modification_crop = excluded.modification_crop,
  attribution_requirement = excluded.attribution_requirement,
  review_status = excluded.review_status,
  is_active = excluded.is_active,
  notes = excluded.notes,
  first_seen_at = excluded.first_seen_at,
  last_seen_at = excluded.last_seen_at;

with media_matrix(owner_type, owner_index, media_sequence) as (
  values
    ('venue',1,1),('venue',2,2),('venue',3,3),('venue',4,4),('venue',5,5),('venue',6,6),
    ('artist',4,101),('artist',5,102),('artist',6,103),('artist',9,104),('artist',10,105),('artist',11,106),
    ('work',1,201),('work',2,202),('work',3,203),('work',4,204),('work',5,205),('work',6,206),
    ('exhibition',1,301),('exhibition',2,302),('exhibition',3,303),('exhibition',4,304),('exhibition',5,305),('exhibition',6,306)
)
insert into public.media_assets (
  id,
  exhibition_id,
  venue_id,
  artist_id,
  work_id,
  kind,
  storage_path,
  original_filename,
  source_type,
  source_url,
  credit,
  usage_note,
  reported_license,
  reported_license_url,
  reported_author,
  reported_usage_terms,
  rights_status,
  rights_checked_at,
  is_primary
)
select
  ('32590000-0000-4325-8325-03' || lpad(media_sequence::text, 10, '0'))::uuid,
  case when owner_type = 'exhibition' then ('32590000-0000-4325-8325-4' || lpad(owner_index::text, 11, '0'))::uuid end,
  case when owner_type = 'venue' then ('32590000-0000-4325-8325-1' || lpad(owner_index::text, 11, '0'))::uuid end,
  case when owner_type = 'artist' then ('32590000-0000-4325-8325-2' || lpad(owner_index::text, 11, '0'))::uuid end,
  case when owner_type = 'work' then ('32590000-0000-4325-8325-3' || lpad(owner_index::text, 11, '0'))::uuid end,
  'image',
  'stg-admin-review/' || owner_type || 's/' ||
    ('32590000-0000-4325-8325-' || case owner_type when 'venue' then '1' when 'artist' then '2' when 'work' then '3' else '4' end || lpad(owner_index::text, 11, '0')) ||
    '/primary.png',
  'order3259-synthetic-primary.png',
  'other',
  :'fixture_base_url' || '/fixtures/order3259-review-' || (array['a','b','c','d'])[((media_sequence - 1) % 4) + 1] || '.svg',
  '[STG QA] Synthetic primary image',
  'Order 325.9 Admin Review Fixture; LOCAL/STG only.',
  'CC0 1.0',
  'https://creativecommons.org/publicdomain/zero/1.0/',
  'Muuzee QA Fixture',
  'Synthetic asset generated for Muuzee Admin QA.',
  case when media_sequence % 2 = 1 then 'approved' else 'needs_review' end,
  case when media_sequence % 2 = 1 then '2026-10-16T00:00:00Z'::timestamptz else null end,
  true
from media_matrix
on conflict (id) do update set
  exhibition_id = excluded.exhibition_id,
  venue_id = excluded.venue_id,
  artist_id = excluded.artist_id,
  work_id = excluded.work_id,
  kind = excluded.kind,
  storage_path = excluded.storage_path,
  original_filename = excluded.original_filename,
  source_type = excluded.source_type,
  source_url = excluded.source_url,
  credit = excluded.credit,
  usage_note = excluded.usage_note,
  reported_license = excluded.reported_license,
  reported_license_url = excluded.reported_license_url,
  reported_author = excluded.reported_author,
  reported_usage_terms = excluded.reported_usage_terms,
  rights_status = excluded.rights_status,
  rights_checked_at = excluded.rights_checked_at,
  is_primary = excluded.is_primary,
  updated_at = now();

with occurrence_rows as (
  select
    i,
    case when i <= 14 then 1 else 2 + ((i - 15) % 54) end as venue_index
  from generate_series(1, 56) as fixture(i)
  where i not in (8, 16)
)
insert into public.exhibition_occurrences (
  id,
  exhibition_id,
  venue_id,
  start_date,
  end_date,
  opening_hours_text,
  closed_days_text,
  ticket_url,
  source_record_id,
  source_venue_name,
  match_method,
  match_confidence,
  relation_status,
  last_seen_at,
  visibility_status,
  visibility_overridden
)
select
  ('32590000-0000-4325-8325-5' || lpad(i::text, 11, '0'))::uuid,
  ('32590000-0000-4325-8325-4' || lpad(i::text, 11, '0'))::uuid,
  ('32590000-0000-4325-8325-1' || lpad(venue_index::text, 11, '0'))::uuid,
  case (i % 8)
    when 1 then '2025-01-01'::date
    when 2 then '2036-01-15'::date
    when 3 then '2020-01-01'::date
    when 4 then null
    when 5 then '2025-06-01'::date
    when 6 then null
    when 7 then '2036-02-14'::date
    else '2024-01-01'::date
  end,
  case (i % 8)
    when 1 then '2035-12-31'::date
    when 2 then '2036-06-30'::date
    when 3 then '2020-12-31'::date
    when 4 then null
    when 5 then null
    when 6 then '2035-12-31'::date
    when 7 then '2036-02-14'::date
    else '2035-12-31'::date
  end,
  case when i % 3 <> 0 then '10:00–18:00（STG QA）' else null end,
  case when i % 4 = 0 then 'Fixture maintenance day' else null end,
  case when i % 5 = 0 then :'fixture_base_url' || '/fixtures/order3259-ticket-' || i else null end,
  case when i <= 12 then ('32590000-0000-4325-8325-01' || lpad((300 + i)::text, 10, '0'))::uuid else null end,
  '[STG QA] Venue ' || lpad(venue_index::text, 2, '0'),
  'fixture_exact_uuid',
  1,
  case when i = 15 then 'stale' else 'active' end,
  '2026-10-16T00:00:00Z'::timestamptz,
  case when i = 15 then 'hidden' else 'public' end,
  i = 15
from occurrence_rows
on conflict (id) do update set
  exhibition_id = excluded.exhibition_id,
  venue_id = excluded.venue_id,
  start_date = excluded.start_date,
  end_date = excluded.end_date,
  opening_hours_text = excluded.opening_hours_text,
  closed_days_text = excluded.closed_days_text,
  ticket_url = excluded.ticket_url,
  source_record_id = excluded.source_record_id,
  source_venue_name = excluded.source_venue_name,
  match_method = excluded.match_method,
  match_confidence = excluded.match_confidence,
  relation_status = excluded.relation_status,
  last_seen_at = excluded.last_seen_at,
  visibility_status = excluded.visibility_status,
  visibility_overridden = excluded.visibility_overridden,
  updated_at = now();

with relation_rows as (
  select 1 as exhibition_index, artist_index, artist_index as relation_sequence
  from generate_series(1, 14) as artists(artist_index)
  union all
  select i, 2 + ((i - 2) % 53), 100 + i
  from generate_series(2, 55) as fixture(i)
  where i % 3 <> 0
)
insert into public.exhibition_artists (
  id,
  exhibition_id,
  artist_id,
  role,
  sort_order,
  source_artist_name,
  match_status,
  source_record_id,
  relation_status,
  last_seen_at
)
select
  ('32590000-0000-4325-8325-6' || lpad(relation_sequence::text, 11, '0'))::uuid,
  ('32590000-0000-4325-8325-4' || lpad(exhibition_index::text, 11, '0'))::uuid,
  ('32590000-0000-4325-8325-2' || lpad(artist_index::text, 11, '0'))::uuid,
  case when exhibition_index = 1 then '参加作家' else 'artist' end,
  artist_index,
  '[STG QA] Artist ' || lpad(artist_index::text, 2, '0'),
  'matched',
  case when exhibition_index <= 12 then ('32590000-0000-4325-8325-01' || lpad((300 + exhibition_index)::text, 10, '0'))::uuid else null end,
  'active',
  '2026-10-16T00:00:00Z'::timestamptz
from relation_rows
on conflict (id) do update set
  exhibition_id = excluded.exhibition_id,
  artist_id = excluded.artist_id,
  role = excluded.role,
  sort_order = excluded.sort_order,
  source_artist_name = excluded.source_artist_name,
  match_status = excluded.match_status,
  source_record_id = excluded.source_record_id,
  relation_status = excluded.relation_status,
  last_seen_at = excluded.last_seen_at,
  updated_at = now();

insert into public.exhibition_venue_mentions (
  id,
  exhibition_id,
  source_record_id,
  source_venue_name,
  normalized_name,
  candidate_venue_ids,
  match_method,
  match_status,
  resolution_status,
  match_reason,
  is_active,
  last_seen_at,
  resolution_diagnostics
) values
  (
    '32590000-0000-4325-8325-040000000001',
    '32590000-0000-4325-8325-400000000008',
    '32590000-0000-4325-8325-010000000308',
    '[STG QA] Unresolved Venue Mention',
    'stg qa unresolved venue mention',
    '{}',
    'fixture_no_match',
    'unresolved',
    'pending',
    'No canonical fixture Venue selected.',
    true,
    '2026-10-16T00:00:00Z',
    '{"fixture":true,"order":"325.9"}'
  ),
  (
    '32590000-0000-4325-8325-040000000002',
    '32590000-0000-4325-8325-400000000010',
    '32590000-0000-4325-8325-010000000310',
    '[STG QA] Ambiguous Venue Mention',
    'stg qa ambiguous venue mention',
    array['32590000-0000-4325-8325-100000000002'::uuid,'32590000-0000-4325-8325-100000000003'::uuid],
    'fixture_ambiguous',
    'ambiguous',
    'ambiguous',
    'Two deterministic fixture candidates.',
    true,
    '2026-10-16T00:00:00Z',
    '{"fixture":true,"order":"325.9"}'
  )
on conflict (id) do update set
  exhibition_id = excluded.exhibition_id,
  source_record_id = excluded.source_record_id,
  source_venue_name = excluded.source_venue_name,
  normalized_name = excluded.normalized_name,
  candidate_venue_ids = excluded.candidate_venue_ids,
  match_method = excluded.match_method,
  match_status = excluded.match_status,
  resolution_status = excluded.resolution_status,
  match_reason = excluded.match_reason,
  is_active = excluded.is_active,
  last_seen_at = excluded.last_seen_at,
  resolution_diagnostics = excluded.resolution_diagnostics,
  updated_at = now();

insert into public.exhibition_artist_mentions (
  id,
  exhibition_id,
  source_record_id,
  source_artist_name,
  normalized_name,
  role,
  extraction_method,
  match_status,
  candidate_artist_ids,
  match_reason,
  resolution_status,
  is_active,
  last_seen_at,
  resolution_diagnostics
) values
  (
    '32590000-0000-4325-8325-050000000001',
    '32590000-0000-4325-8325-400000000009',
    '32590000-0000-4325-8325-010000000309',
    '[STG QA] Unresolved Artist Mention',
    'stg qa unresolved artist mention',
    '参加作家',
    'structured_source',
    'unmatched',
    '{}',
    'No canonical fixture Artist selected.',
    'pending',
    true,
    '2026-10-16T00:00:00Z',
    '{"fixture":true,"order":"325.9"}'
  ),
  (
    '32590000-0000-4325-8325-050000000002',
    '32590000-0000-4325-8325-400000000010',
    '32590000-0000-4325-8325-010000000310',
    '[STG QA] Ambiguous Artist Mention',
    'stg qa ambiguous artist mention',
    '参加作家',
    'structured_source',
    'candidate',
    array['32590000-0000-4325-8325-200000000002'::uuid,'32590000-0000-4325-8325-200000000003'::uuid],
    'Two deterministic fixture candidates.',
    'ambiguous',
    true,
    '2026-10-16T00:00:00Z',
    '{"fixture":true,"order":"325.9"}'
  )
on conflict (id) do update set
  exhibition_id = excluded.exhibition_id,
  source_record_id = excluded.source_record_id,
  source_artist_name = excluded.source_artist_name,
  normalized_name = excluded.normalized_name,
  role = excluded.role,
  extraction_method = excluded.extraction_method,
  match_status = excluded.match_status,
  candidate_artist_ids = excluded.candidate_artist_ids,
  match_reason = excluded.match_reason,
  resolution_status = excluded.resolution_status,
  is_active = excluded.is_active,
  last_seen_at = excluded.last_seen_at,
  resolution_diagnostics = excluded.resolution_diagnostics,
  updated_at = now();

with relation_rows as (
  select i as work_index, 1 as artist_index, i as relation_sequence
  from generate_series(1, 14) as fixture(i)
  union all
  select 1, i, 100 + i from generate_series(2, 4) as artists(i)
  union all
  select i, 2 + ((i - 15) % 53), 200 + i
  from generate_series(15, 55) as fixture(i)
)
insert into public.work_artists (
  id,
  work_id,
  artist_id,
  role,
  sort_order,
  source,
  source_url,
  source_record_id,
  verified_at,
  visibility_status,
  visibility_overridden
)
select
  ('32590000-0000-4325-8325-7' || lpad(relation_sequence::text, 11, '0'))::uuid,
  ('32590000-0000-4325-8325-3' || lpad(work_index::text, 11, '0'))::uuid,
  ('32590000-0000-4325-8325-2' || lpad(artist_index::text, 11, '0'))::uuid,
  case when work_index = 1 and artist_index > 1 then 'collaborating_artist' else 'artist' end,
  artist_index,
  'manual',
  :'fixture_base_url' || '/fixtures/order3259-source-work-' || lpad(work_index::text, 2, '0'),
  case when work_index <= 12 then ('32590000-0000-4325-8325-01' || lpad((200 + work_index)::text, 10, '0'))::uuid else null end,
  '2026-10-16T00:00:00Z'::timestamptz,
  case when work_index = 15 then 'hidden' else 'public' end,
  true
from relation_rows
on conflict (id) do update set
  work_id = excluded.work_id,
  artist_id = excluded.artist_id,
  role = excluded.role,
  sort_order = excluded.sort_order,
  source = excluded.source,
  source_url = excluded.source_url,
  source_record_id = excluded.source_record_id,
  verified_at = excluded.verified_at,
  visibility_status = excluded.visibility_status,
  visibility_overridden = excluded.visibility_overridden,
  visibility_updated_at = now();

with relation_rows as (
  select i as work_index, 1 as venue_index, i as relation_sequence
  from generate_series(1, 14) as fixture(i)
  union all
  select 1, i, 100 + i from generate_series(2, 3) as venues(i)
  union all
  select i, 2 + ((i - 15) % 53), 200 + i
  from generate_series(15, 55) as fixture(i)
)
insert into public.collection_holdings (
  id,
  venue_id,
  work_id,
  holding_type,
  inventory_number,
  source_url,
  verified_at,
  source,
  source_record_id,
  visibility_status,
  visibility_overridden
)
select
  ('32590000-0000-4325-8325-8' || lpad(relation_sequence::text, 11, '0'))::uuid,
  ('32590000-0000-4325-8325-1' || lpad(venue_index::text, 11, '0'))::uuid,
  ('32590000-0000-4325-8325-3' || lpad(work_index::text, 11, '0'))::uuid,
  (array['collection','long_term_loan','deposit','other'])[((work_index - 1) % 4) + 1],
  case when work_index % 4 = 0 then 'STG-QA-' || lpad(relation_sequence::text, 4, '0') else null end,
  :'fixture_base_url' || '/fixtures/order3259-source-work-' || lpad(work_index::text, 2, '0'),
  '2026-10-16T00:00:00Z'::timestamptz,
  'manual',
  case when work_index <= 12 then ('32590000-0000-4325-8325-01' || lpad((200 + work_index)::text, 10, '0'))::uuid else null end,
  case when work_index = 15 then 'hidden' else 'public' end,
  true
from relation_rows
on conflict (id) do update set
  venue_id = excluded.venue_id,
  work_id = excluded.work_id,
  holding_type = excluded.holding_type,
  inventory_number = excluded.inventory_number,
  source_url = excluded.source_url,
  verified_at = excluded.verified_at,
  source = excluded.source,
  source_record_id = excluded.source_record_id,
  visibility_status = excluded.visibility_status,
  visibility_overridden = excluded.visibility_overridden,
  visibility_updated_at = now(),
  updated_at = now();

with presentation_rows(work_index, venue_index, presentation_type, presentation_status, start_date, end_date, relation_sequence) as (
  values
    (1,1,'permanent','currently_displayed',null::date,null::date,1),
    (1,2,'temporary','not_displayed','2025-01-01'::date,'2025-12-31'::date,2),
    (1,3,'unknown','unknown',null::date,null::date,3),
    (2,1,'permanent','currently_displayed',null::date,null::date,4),
    (3,1,'temporary','currently_displayed','2026-01-01'::date,'2030-12-31'::date,5),
    (4,1,'temporary','not_displayed','2020-01-01'::date,'2020-12-31'::date,6),
    (5,1,'unknown','unknown',null::date,null::date,7),
    (6,1,'permanent','currently_displayed',null::date,null::date,8),
    (7,1,'temporary','currently_displayed','2026-10-01'::date,'2027-03-31'::date,9),
    (8,1,'temporary','not_displayed','2024-01-01'::date,'2024-12-31'::date,10),
    (9,1,'unknown','unknown',null::date,null::date,11),
    (10,1,'permanent','currently_displayed',null::date,null::date,12)
)
insert into public.work_presentations (
  id,
  work_id,
  venue_id,
  presentation_type,
  status,
  start_date,
  end_date,
  source,
  source_url,
  source_record_id,
  verified_at
)
select
  ('32590000-0000-4325-8325-9' || lpad(relation_sequence::text, 11, '0'))::uuid,
  ('32590000-0000-4325-8325-3' || lpad(work_index::text, 11, '0'))::uuid,
  ('32590000-0000-4325-8325-1' || lpad(venue_index::text, 11, '0'))::uuid,
  presentation_type,
  presentation_status,
  start_date,
  end_date,
  'manual',
  :'fixture_base_url' || '/fixtures/order3259-presentation-' || relation_sequence,
  case when work_index <= 12 then ('32590000-0000-4325-8325-01' || lpad((200 + work_index)::text, 10, '0'))::uuid else null end,
  '2026-10-16T00:00:00Z'::timestamptz
from presentation_rows
on conflict (id) do update set
  work_id = excluded.work_id,
  venue_id = excluded.venue_id,
  presentation_type = excluded.presentation_type,
  status = excluded.status,
  start_date = excluded.start_date,
  end_date = excluded.end_date,
  source = excluded.source,
  source_url = excluded.source_url,
  source_record_id = excluded.source_record_id,
  verified_at = excluded.verified_at,
  updated_at = now();

do $$
declare
  actual integer;
begin
  select count(*) into actual from public.venues where id = any(array(select ('32590000-0000-4325-8325-1' || lpad(i::text,11,'0'))::uuid from generate_series(1,56) fixture(i)));
  if actual <> 56 then raise exception 'Order 325.9 Venue count mismatch: %', actual; end if;
  select count(*) into actual from public.artists where id = any(array(select ('32590000-0000-4325-8325-2' || lpad(i::text,11,'0'))::uuid from generate_series(1,56) fixture(i)));
  if actual <> 56 then raise exception 'Order 325.9 Artist count mismatch: %', actual; end if;
  select count(*) into actual from public.works where id = any(array(select ('32590000-0000-4325-8325-3' || lpad(i::text,11,'0'))::uuid from generate_series(1,56) fixture(i)));
  if actual <> 56 then raise exception 'Order 325.9 Work count mismatch: %', actual; end if;
  select count(*) into actual from public.exhibitions where id = any(array(select ('32590000-0000-4325-8325-4' || lpad(i::text,11,'0'))::uuid from generate_series(1,56) fixture(i)));
  if actual <> 56 then raise exception 'Order 325.9 Exhibition count mismatch: %', actual; end if;
  select count(*) into actual from public.venues where id = any(array(select ('32590000-0000-4325-8325-1' || lpad(i::text,11,'0'))::uuid from generate_series(1,56) fixture(i))) and publication_status in ('draft', 'ready');
  if actual <> 52 then raise exception 'Order 325.9 Venue unpublished count mismatch: %', actual; end if;
  select count(*) into actual from public.artists where id = any(array(select ('32590000-0000-4325-8325-2' || lpad(i::text,11,'0'))::uuid from generate_series(1,56) fixture(i))) and publication_status in ('draft', 'ready');
  if actual <> 52 then raise exception 'Order 325.9 Artist unpublished count mismatch: %', actual; end if;
  select count(*) into actual from public.works where id = any(array(select ('32590000-0000-4325-8325-3' || lpad(i::text,11,'0'))::uuid from generate_series(1,56) fixture(i))) and publication_status in ('draft', 'ready');
  if actual <> 52 then raise exception 'Order 325.9 Work unpublished count mismatch: %', actual; end if;
  select count(*) into actual from public.exhibitions where id = any(array(select ('32590000-0000-4325-8325-4' || lpad(i::text,11,'0'))::uuid from generate_series(1,56) fixture(i))) and publication_status in ('draft', 'ready');
  if actual <> 52 then raise exception 'Order 325.9 Exhibition unpublished count mismatch: %', actual; end if;
  select count(*) into actual from public.source_records where data_source_id = '32590000-0000-4325-8325-000000000001';
  if actual <> 48 then raise exception 'Order 325.9 Source Record count mismatch: %', actual; end if;
  select count(*) into actual from public.source_image_candidates where id::text like '32590000-0000-4325-8325-02%';
  if actual <> 12 then raise exception 'Order 325.9 Image Candidate count mismatch: %', actual; end if;
  select count(*) into actual from public.media_assets where id::text like '32590000-0000-4325-8325-03%';
  if actual <> 24 then raise exception 'Order 325.9 Media count mismatch: %', actual; end if;
  select count(*) into actual from public.exhibition_occurrences where exhibition_id = any(array(select ('32590000-0000-4325-8325-4' || lpad(i::text,11,'0'))::uuid from generate_series(1,56) fixture(i)));
  if actual <> 54 then raise exception 'Order 325.9 Occurrence count mismatch: %', actual; end if;
  select count(*) into actual from public.exhibition_artists where exhibition_id = any(array(select ('32590000-0000-4325-8325-4' || lpad(i::text,11,'0'))::uuid from generate_series(1,56) fixture(i)));
  if actual <> 50 then raise exception 'Order 325.9 Exhibition Artist count mismatch: %', actual; end if;
  select count(*) into actual from public.work_artists where work_id = any(array(select ('32590000-0000-4325-8325-3' || lpad(i::text,11,'0'))::uuid from generate_series(1,56) fixture(i)));
  if actual <> 58 then raise exception 'Order 325.9 Work Artist count mismatch: %', actual; end if;
  select count(*) into actual from public.collection_holdings where work_id = any(array(select ('32590000-0000-4325-8325-3' || lpad(i::text,11,'0'))::uuid from generate_series(1,56) fixture(i)));
  if actual <> 57 then raise exception 'Order 325.9 Holding count mismatch: %', actual; end if;
  select count(*) into actual from public.work_presentations where work_id = any(array(select ('32590000-0000-4325-8325-3' || lpad(i::text,11,'0'))::uuid from generate_series(1,56) fixture(i)));
  if actual <> 12 then raise exception 'Order 325.9 Presentation count mismatch: %', actual; end if;
  select count(*) into actual from public.exhibition_artists where exhibition_id = '32590000-0000-4325-8325-400000000001';
  if actual < 12 then raise exception 'Order 325.9 Cluster B missing: % Artists', actual; end if;
  select count(*) into actual from public.exhibition_occurrences where venue_id = '32590000-0000-4325-8325-100000000001';
  if actual < 12 then raise exception 'Order 325.9 Cluster A missing: % Exhibitions', actual; end if;
  select count(*) into actual from public.work_artists where artist_id = '32590000-0000-4325-8325-200000000001';
  if actual < 12 then raise exception 'Order 325.9 Cluster C missing: % Works', actual; end if;
  select count(*) into actual from public.collection_holdings where venue_id = '32590000-0000-4325-8325-100000000001';
  if actual < 12 then raise exception 'Order 325.9 Cluster D missing: % Works', actual; end if;
end;
$$;

commit;
