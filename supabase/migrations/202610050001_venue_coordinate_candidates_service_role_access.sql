-- venue_coordinate_candidates was created after the repository-wide
-- service_role permission repair. Future public objects require explicit grants.

grant select, insert, update, delete
on table public.venue_coordinate_candidates
to service_role;
