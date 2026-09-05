\pset pager off
\echo '=== Venue totals ==='
select
  count(*) as total,
  count(*) filter (where publication_status = 'published') as published,
  count(*) filter (where publication_status = 'draft') as draft,
  count(*) filter (where exists (
    select 1 from public.venue_external_match_candidates candidate
    where candidate.venue_id = venues.id
      and candidate.provider = 'wikidata'
      and candidate.status = 'needs_review'
  )) as needs_review
from public.venues;

\echo '=== Venue types ==='
select venue_type, count(*) as venues
from public.venues
group by venue_type
order by venue_type;

\echo '=== Master field coverage ==='
with coverage(field_name, filled) as (
  select 'name', count(*) filter (where nullif(btrim(name), '') is not null) from public.venues union all
  select 'name_en', count(*) filter (where nullif(btrim(name_en), '') is not null) from public.venues union all
  select 'aliases', count(*) filter (where cardinality(aliases) > 0) from public.venues union all
  select 'venue_type', count(*) filter (where nullif(btrim(venue_type), '') is not null) from public.venues union all
  select 'country_code', count(*) filter (where nullif(btrim(country_code), '') is not null) from public.venues union all
  select 'region', count(*) filter (where nullif(btrim(region), '') is not null) from public.venues union all
  select 'prefecture', count(*) filter (where nullif(btrim(prefecture), '') is not null) from public.venues union all
  select 'city', count(*) filter (where nullif(btrim(city), '') is not null) from public.venues union all
  select 'address', count(*) filter (where nullif(btrim(address), '') is not null) from public.venues union all
  select 'postal_code', count(*) filter (where nullif(btrim(postal_code), '') is not null) from public.venues union all
  select 'coordinates', count(*) filter (where latitude is not null and longitude is not null) from public.venues union all
  select 'official_url', count(*) filter (where nullif(btrim(official_url), '') is not null) from public.venues union all
  select 'inception_year', count(*) filter (where inception_year is not null) from public.venues union all
  select 'opening_hours', count(*) filter (where nullif(btrim(opening_hours_text), '') is not null) from public.venues union all
  select 'closed_days', count(*) filter (where nullif(btrim(closed_days_text), '') is not null) from public.venues union all
  select 'access', count(*) filter (where nullif(btrim(access_text), '') is not null) from public.venues union all
  select 'description', count(*) filter (where nullif(btrim(description), '') is not null) from public.venues
), totals as (select count(*)::numeric as total from public.venues)
select field_name, filled, (total - filled)::bigint as missing,
       round(filled * 100.0 / nullif(total, 0), 1) as coverage_percent
from coverage cross join totals
order by field_name;

\echo '=== Completeness config (Name, Address, Coordinates, Description, approved primary Image, Opening Hours) ==='
with scored as (
  select venue.id,
    (case when nullif(btrim(name), '') is not null then 1 else 0 end +
     case when nullif(btrim(address), '') is not null then 1 else 0 end +
     case when latitude is not null and longitude is not null then 1 else 0 end +
     case when nullif(btrim(description), '') is not null then 1 else 0 end +
     case when exists (select 1 from public.media_assets asset where asset.venue_id = venue.id and asset.is_primary) then 1 else 0 end +
     case when nullif(btrim(opening_hours_text), '') is not null then 1 else 0 end) as filled
  from public.venues venue
)
select round(avg(round(filled * 100.0 / 6)), 1) as average_completeness_percent,
       round(avg(filled), 2) as average_fields_filled,
       6 as configured_fields
from scored;

\echo '=== Image coverage ==='
with wikidata_records as (
  select id, venue_id, external_id as qid, raw_payload #>> '{normalized,imageFileTitle}' as p18
  from public.source_records
  where data_source_id = (select id from public.data_sources where key = 'wikidata')
    and venue_id is not null
    and external_id ~ '^Q[0-9]+$'
), commons_candidates as (
  select wikidata.venue_id, candidate.*
  from wikidata_records wikidata
  join public.source_records record
   on record.venue_id = wikidata.venue_id
   and record.data_source_id = (select id from public.data_sources where key = 'wikimedia_commons')
   and record.external_id like 'venue:' || wikidata.venue_id::text || ':' || wikidata.qid || ':%'
  join public.source_image_candidates candidate on candidate.source_record_id = record.id
  where candidate.provider = 'wikimedia_commons'
)
select
  (select count(*) from wikidata_records where nullif(p18, '') is not null) as p18_records,
  count(distinct venue_id) as venues_with_commons_candidate,
  count(distinct venue_id) filter (where rights_status = 'needs_review') as rights_unconfirmed,
  (select count(distinct venue_id) from public.media_assets where venue_id is not null and rights_status = 'approved') as approved_image_venues,
  (select count(*) from public.venues) - count(distinct venue_id) as venues_without_candidate
from commons_candidates;

\echo '=== Reported licenses (human review remains required) ==='
select coalesce(candidate.license_short_name, 'Unknown') as reported_license, count(*) as candidates
from public.source_image_candidates candidate
join public.source_records record on record.id = candidate.source_record_id
where candidate.provider = 'wikimedia_commons'
  and record.data_source_id = (select id from public.data_sources where key = 'wikimedia_commons')
  and exists (
    select 1 from public.source_records wikidata
    where wikidata.venue_id = record.venue_id
      and wikidata.data_source_id = (select id from public.data_sources where key = 'wikidata')
      and wikidata.external_id ~ '^Q[0-9]+$'
      and record.external_id like 'venue:' || wikidata.venue_id::text || ':' || wikidata.external_id || ':%'
  )
group by coalesce(candidate.license_short_name, 'Unknown')
order by candidates desc, reported_license;

\echo '=== Wikidata review reasons ==='
select reason.value #>> '{}' as reason, count(*) as candidates
from public.venue_external_match_candidates candidate
cross join lateral jsonb_array_elements(candidate.match_reasons) reason(value)
where candidate.provider = 'wikidata' and candidate.status = 'needs_review'
group by reason.value
order by candidates desc, reason;

\echo '=== Venues linked to more than one Wikidata QID (manual identity review) ==='
select venue.id, venue.name, string_agg(record.external_id, ', ' order by record.external_id) as qids
from public.source_records record
join public.venues venue on venue.id = record.venue_id
where record.data_source_id = (select id from public.data_sources where key = 'wikidata')
  and record.external_id ~ '^Q[0-9]+$'
group by venue.id, venue.name
having count(*) > 1
order by venue.name;

\echo '=== Needs Review duplicate candidates (human decision required) ==='
select
  venue.id as venue_a_id,
  venue.name as venue_a_name,
  venue.name_en as venue_a_name_en,
  venue.official_url as venue_a_url,
  venue.latitude as venue_a_latitude,
  venue.longitude as venue_a_longitude,
  venue.address as venue_a_address,
  candidate.external_id as venue_b_qid,
  candidate.label_ja as venue_b_name,
  candidate.label_en as venue_b_name_en,
  candidate.official_url as venue_b_url,
  candidate.latitude as venue_b_latitude,
  candidate.longitude as venue_b_longitude,
  candidate.confidence,
  candidate.match_reasons as reasons
from public.venue_external_match_candidates candidate
join public.venues venue on venue.id = candidate.venue_id
where candidate.provider = 'wikidata' and candidate.status = 'needs_review'
order by candidate.confidence desc, venue.name, candidate.external_id;

\echo '=== Potential duplicates (Source-A-created Venue compared with pre-existing Venue; never auto-merged) ==='
with source_a_created as (
  select distinct candidate.venue_id
  from public.venue_external_match_candidates candidate
  where candidate.provider = 'wikidata'
    and candidate.status = 'matched'
    and candidate.match_reasons ? 'Created from Wikidata Source A'
), qids as (
  select record.venue_id, record.external_id as qid
  from public.source_records record
  where record.data_source_id = (select id from public.data_sources where key = 'wikidata')
    and record.venue_id is not null
    and record.external_id ~ '^Q[0-9]+$'
), prepared as (
  select venue.*,
    lower(regexp_replace(coalesce(venue.name, ''), '[^[:alnum:]]', '', 'g')) as match_name,
    lower(regexp_replace(coalesce(venue.name_en, ''), '[^[:alnum:]]', '', 'g')) as match_name_en,
    lower(regexp_replace(coalesce(venue.address, ''), '[^[:alnum:]]', '', 'g')) as match_address,
    lower(regexp_replace(split_part(regexp_replace(coalesce(venue.official_url, ''), '^https?://(www\\.)?', '', 'i'), '/', 1), ':.*$', '')) as match_domain,
    qids.qid,
    source_a_created.venue_id is not null as source_a_created
  from public.venues venue
  left join qids on qids.venue_id = venue.id
  left join source_a_created on source_a_created.venue_id = venue.id
), pairs as (
  select
    imported.id as venue_a_id, imported.name as venue_a_name, imported.name_en as venue_a_name_en,
    imported.official_url as venue_a_url, imported.latitude as venue_a_latitude,
    imported.longitude as venue_a_longitude, imported.address as venue_a_address, imported.qid as venue_a_qid,
    existing.id as venue_b_id, existing.name as venue_b_name, existing.name_en as venue_b_name_en,
    existing.official_url as venue_b_url, existing.latitude as venue_b_latitude,
    existing.longitude as venue_b_longitude, existing.address as venue_b_address, existing.qid as venue_b_qid,
    array_remove(array[
      case when imported.qid is not null and imported.qid = existing.qid then 'Wikidata QID exact' end,
      case when imported.match_name <> '' and imported.match_name = existing.match_name then 'normalized name exact' end,
      case when imported.match_name_en <> '' and imported.match_name_en = existing.match_name_en then 'name_en exact' end,
      case when imported.match_domain <> '' and imported.match_domain = existing.match_domain then 'official domain exact' end,
      case when imported.match_address <> '' and imported.match_address = existing.match_address then 'address exact' end,
      case when imported.latitude is not null and imported.longitude is not null and existing.latitude is not null and existing.longitude is not null
             and abs(imported.latitude - existing.latitude) <= 0.005 and abs(imported.longitude - existing.longitude) <= 0.005
        then 'coordinates within approximately 500m' end
    ], null) as reasons
  from prepared imported
  join prepared existing on imported.id <> existing.id
  where imported.source_a_created and not existing.source_a_created
), scored as (
  select *,
    (case when 'Wikidata QID exact' = any(reasons) then 1.00 else 0 end +
     case when 'normalized name exact' = any(reasons) then 0.65 else 0 end +
     case when 'name_en exact' = any(reasons) then 0.25 else 0 end +
     case when 'official domain exact' = any(reasons) then 0.50 else 0 end +
     case when 'address exact' = any(reasons) then 0.45 else 0 end +
     case when 'coordinates within approximately 500m' = any(reasons) then 0.20 else 0 end) as confidence
  from pairs
)
select * from scored
where confidence >= 0.60
order by confidence desc, venue_a_name, venue_b_name;
