-- Repair service_role access for the currently committed public tables and
-- sequences. Future public objects require explicit grants in their creating
-- migration; anon and authenticated exposure remains opt-in.

grant usage on schema public to service_role;
grant select, insert, update, delete on all tables in schema public to service_role;
grant usage, select on all sequences in schema public to service_role;
