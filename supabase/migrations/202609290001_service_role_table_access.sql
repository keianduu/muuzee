-- Hosted migrations run through a database login whose default privileges do
-- not implicitly grant PostgREST's service_role access to new public tables.
-- Keep the trusted server boundary explicit without opening any anon access.

grant usage on schema public to service_role;
grant select, insert, update, delete on all tables in schema public to service_role;
grant usage, select on all sequences in schema public to service_role;

alter default privileges in schema public
  grant select, insert, update, delete on tables to service_role;

alter default privileges in schema public
  grant usage, select on sequences to service_role;
