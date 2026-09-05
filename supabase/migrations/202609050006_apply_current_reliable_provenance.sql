-- Current canonical values from attributable sources are already applied Master
-- data under the Source Priority policy. Human review is reserved for ambiguity.
update public.venue_field_sources
set review_status = 'applied'
where is_current = true
  and review_status = 'unreviewed'
  and source in ('official_website', 'trusted_api', 'wikidata');

update public.artist_field_sources
set review_status = 'applied'
where is_current = true
  and review_status = 'unreviewed'
  and source in ('official_website', 'trusted_api', 'wikidata');

update public.work_field_sources
set review_status = 'applied'
where is_current = true
  and review_status = 'unreviewed'
  and source in ('official_website', 'trusted_api', 'wikidata');
