-- Source Application Policy
-- External source values flow directly into the Venue master according to
-- field provenance priority. Candidate rows are only unresolved identity
-- choices; they are not a field-by-field review queue.

update public.venues
set wikidata_match_status = 'candidate'
where wikidata_match_status = 'needs_review';

update public.venue_external_match_candidates
set status = 'candidate'
where status = 'needs_review';

alter table public.venues drop constraint if exists venues_wikidata_match_status_check;
alter table public.venues add constraint venues_wikidata_match_status_check
  check (wikidata_match_status in ('unmatched', 'candidate', 'matched', 'rejected'));

alter table public.venue_external_match_candidates drop constraint if exists venue_external_match_candidates_status_check;
alter table public.venue_external_match_candidates add constraint venue_external_match_candidates_status_check
  check (status in ('candidate', 'matched', 'rejected'));

comment on column public.venues.wikidata_match_status is
  'External identity link state only. candidate means multiple source identities require selection; it is not a publication or field-review state.';

comment on column public.venue_field_sources.review_status is
  'Provenance history metadata retained for compatibility. It does not gate whether the current Master field is usable; publication_status controls product use.';

comment on function public.venue_source_priority(text) is
  'Field source precedence: Manual > Official Website > Trusted API > Wikidata.';
