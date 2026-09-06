insert into public.data_sources (key, name, base_url, terms_url, metadata_license)
values (
  'wikipedia',
  'Wikipedia / MediaWiki API',
  'https://www.wikipedia.org',
  'https://foundation.wikimedia.org/wiki/Policy:Terms_of_Use',
  'CC BY-SA; article-specific attribution applies'
)
on conflict (key) do update set
  name = excluded.name,
  base_url = excluded.base_url,
  terms_url = excluded.terms_url,
  metadata_license = excluded.metadata_license;

comment on table public.venue_field_sources is
  'Field-level Venue provenance. Address priority: manual > official_website > wikipedia > wikidata.';
