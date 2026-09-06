-- Treat a missing presentation start date as the same explicit presentation
-- relation so repeated CSV/manual imports remain idempotent.
alter table public.work_presentations
  drop constraint work_presentations_work_id_venue_id_presentation_type_start_key;

alter table public.work_presentations
  add constraint work_presentations_identity_unique
  unique nulls not distinct (work_id, venue_id, presentation_type, start_date);
