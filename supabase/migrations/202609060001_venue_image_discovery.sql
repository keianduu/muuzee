alter table public.source_image_candidates
  add column if not exists discovery_source text;

alter table public.source_image_candidates
  drop constraint if exists source_image_candidates_discovery_source_check;

alter table public.source_image_candidates
  add constraint source_image_candidates_discovery_source_check
  check (discovery_source is null or discovery_source in ('wikidata_p18', 'commons_category', 'wikipedia_article'));

update public.source_image_candidates
set discovery_source = 'wikidata_p18'
where discovery_source is null
  and provider = 'wikimedia_commons'
  and candidate_entity_id is not null;

alter table public.venues
  drop constraint if exists venues_image_search_status_check;

alter table public.venues
  add constraint venues_image_search_status_check
  check (image_search_status in (
    'no_entity_candidate', 'no_image_candidate', 'image_candidate_found', 'image_candidate_kept',
    'image_candidate_rejected', 'approved_image_exists', 'qid_missing', 'no_image_found',
    'p18_found', 'commons_candidate_found', 'wikipedia_candidate_found'
  ));

comment on column public.source_image_candidates.discovery_source is
  'Discovery route for the Commons file. Priority: Wikidata P18, Commons category, Wikipedia article.';
