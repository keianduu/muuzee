-- Wikidata Venue Importer v1
-- Source A keeps raw claims in source_records and only adds the normalized
-- opening/inception year needed by the Venue master.

alter table public.venues
  add column if not exists inception_year integer
    check (inception_year is null or inception_year between -10000 and 9999);

comment on column public.venues.inception_year is
  'Opening or inception year when explicitly supplied by a trusted source; field provenance identifies the source.';
