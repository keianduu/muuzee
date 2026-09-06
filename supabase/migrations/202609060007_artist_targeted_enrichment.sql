insert into public.data_sources (key, name, base_url, terms_url, metadata_license)
values
  ('apj_daj', 'Art Platform Japan — Dictionary of Artists in Japan', 'https://artplatform.go.jp/artists', 'https://artplatform.go.jp/about/terms', 'See APJ terms'),
  ('getty_ulan', 'Getty Union List of Artist Names', 'https://vocab.getty.edu/ulan', 'https://www.getty.edu/research/tools/vocabularies/obtain/index.html', 'ODC-By 1.0'),
  ('official_artist_image', 'Official Artist Image Sources', 'https://muuzee.local', null, 'Per-source terms; human rights review required')
on conflict (key) do update set
  name = excluded.name,
  base_url = excluded.base_url,
  terms_url = excluded.terms_url,
  metadata_license = excluded.metadata_license;

alter table public.source_image_candidates
  drop constraint if exists source_image_candidates_discovery_source_check;

alter table public.source_image_candidates
  add constraint source_image_candidates_discovery_source_check
  check (discovery_source is null or discovery_source in (
    'wikidata_p18', 'commons_category', 'wikipedia_article',
    'artist_official', 'gallery_official', 'foundation_estate',
    'museum_official', 'official_press', 'open_collection'
  ));

alter table public.source_image_candidates
  add column if not exists source_type text,
  add column if not exists commercial_use text,
  add column if not exists modification_crop text,
  add column if not exists attribution_requirement text,
  add column if not exists valid_until date,
  add column if not exists notes text;

comment on column public.source_image_candidates.commercial_use is
  'Reported source terms only: allowed, forbidden, or unknown. Does not grant Muuzee rights approval.';
comment on column public.source_image_candidates.modification_crop is
  'Reported crop/modification terms only: allowed, forbidden, or unknown.';
