-- Read-only validation for the Muuzee Master Data Architecture.

-- Relation orphans (all values must be zero).
select 'exhibition_occurrences.exhibition' as check_name, count(*) as issue_count
from public.exhibition_occurrences r left join public.exhibitions e on e.id = r.exhibition_id where e.id is null
union all select 'exhibition_occurrences.venue', count(*)
from public.exhibition_occurrences r left join public.venues v on v.id = r.venue_id where v.id is null
union all select 'exhibition_artists.exhibition', count(*)
from public.exhibition_artists r left join public.exhibitions e on e.id = r.exhibition_id where e.id is null
union all select 'exhibition_artists.artist', count(*)
from public.exhibition_artists r left join public.artists a on a.id = r.artist_id where a.id is null
union all select 'work_artists.work', count(*)
from public.work_artists r left join public.works w on w.id = r.work_id where w.id is null
union all select 'work_artists.artist', count(*)
from public.work_artists r left join public.artists a on a.id = r.artist_id where a.id is null
union all select 'collection_holdings.venue', count(*)
from public.collection_holdings r left join public.venues v on v.id = r.venue_id where v.id is null
union all select 'collection_holdings.work', count(*)
from public.collection_holdings r left join public.works w on w.id = r.work_id where w.id is null
union all select 'work_presentations.venue', count(*)
from public.work_presentations r left join public.venues v on v.id = r.venue_id where v.id is null
union all select 'work_presentations.work', count(*)
from public.work_presentations r left join public.works w on w.id = r.work_id where w.id is null
union all select 'work_import_candidates.artist', count(*)
from public.work_import_candidates r left join public.artists a on a.id = r.artist_id where a.id is null;

-- Duplicate relations / external IDs / holdings (returns no rows when valid).
select 'exhibition_artists' as relation, exhibition_id::text as owner, artist_id::text as related, count(*)
from public.exhibition_artists group by exhibition_id, artist_id having count(*) > 1
union all select 'work_artists', work_id::text, artist_id::text, count(*)
from public.work_artists group by work_id, artist_id having count(*) > 1
union all select 'source_records_external_id', data_source_id::text, external_id, count(*)
from public.source_records group by data_source_id, external_id having count(*) > 1
union all select 'collection_holdings', venue_id::text, work_id::text || ':' || coalesce(inventory_number, ''), count(*)
from public.collection_holdings group by venue_id, work_id, inventory_number having count(*) > 1
union all select 'work_presentations', work_id::text, venue_id::text || ':' || presentation_type || ':' || coalesce(start_date::text, ''), count(*)
from public.work_presentations group by work_id, venue_id, presentation_type, start_date having count(*) > 1;

-- Media owners and source/provenance owners (all values must be zero).
select 'media_assets_invalid_owner_count' as check_name, count(*) as issue_count
from public.media_assets where num_nonnulls(exhibition_id, venue_id, artist_id, work_id) <> 1
union all select 'source_records_multiple_owners', count(*)
from public.source_records where num_nonnulls(exhibition_id, venue_id, artist_id, work_id) > 1
union all select 'venue_field_sources_orphan', count(*)
from public.venue_field_sources s left join public.venues v on v.id = s.venue_id where v.id is null
union all select 'artist_field_sources_orphan', count(*)
from public.artist_field_sources s left join public.artists a on a.id = s.artist_id where a.id is null
union all select 'work_field_sources_orphan', count(*)
from public.work_field_sources s left join public.works w on w.id = s.work_id where w.id is null
union all select 'exhibition_field_sources_orphan', count(*)
from public.exhibition_field_sources s left join public.exhibitions e on e.id = s.exhibition_id where e.id is null;
