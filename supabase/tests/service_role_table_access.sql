begin;

do $$
declare
  table_row record;
  sequence_row record;
begin
  for table_row in
    select c.relname
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relkind in ('r', 'p')
  loop
    if not has_table_privilege('service_role', format('public.%I', table_row.relname), 'SELECT')
      or not has_table_privilege('service_role', format('public.%I', table_row.relname), 'INSERT')
      or not has_table_privilege('service_role', format('public.%I', table_row.relname), 'UPDATE')
      or not has_table_privilege('service_role', format('public.%I', table_row.relname), 'DELETE')
    then
      raise exception 'service_role is missing server DML privileges on public.%', table_row.relname;
    end if;
  end loop;

  for sequence_row in
    select c.relname
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relkind = 'S'
  loop
    if not has_sequence_privilege('service_role', format('public.%I', sequence_row.relname), 'USAGE')
      or not has_sequence_privilege('service_role', format('public.%I', sequence_row.relname), 'SELECT')
    then
      raise exception 'service_role is missing required privileges on public sequence %', sequence_row.relname;
    end if;
  end loop;
end $$;

rollback;
