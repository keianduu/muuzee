begin;

create temporary table order251_counts_before as
select
  (select count(*) from auth.users) as auth_users,
  (select count(*) from public.profiles) as profiles,
  (select count(*) from public.user_preferences) as preferences,
  (select count(*) from public.user_saved_items) as saved,
  (select count(*) from public.user_seen_items) as seen,
  (select count(*) from public.user_favorite_items) as favorite,
  (select count(*) from public.user_artwall_settings) as artwall_settings,
  (select count(*) from public.user_artwall_items) as artwall_items,
  (select count(*) from public.artists) as artists,
  (select count(*) from public.exhibitions) as exhibitions,
  (select count(*) from public.venues) as venues,
  (select count(*) from public.works) as works,
  (select count(*) from public.work_artists) as work_artists,
  (select count(*) from public.collection_holdings) as collection_holdings;

do $$
begin
  if not exists (
    select 1 from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relname = 'user_legal_consents'
      and c.relrowsecurity
      and not c.relforcerowsecurity
  ) then
    raise exception 'user_legal_consents must have non-forced RLS enabled';
  end if;

  if has_table_privilege('anon', 'public.user_legal_consents', 'SELECT')
    or has_table_privilege('anon', 'public.user_legal_consents', 'INSERT')
    or has_table_privilege('anon', 'public.user_legal_consents', 'UPDATE')
    or has_table_privilege('anon', 'public.user_legal_consents', 'DELETE')
  then
    raise exception 'anon must have no user_legal_consents privileges';
  end if;

  if not has_table_privilege('authenticated', 'public.user_legal_consents', 'SELECT')
    or has_table_privilege('authenticated', 'public.user_legal_consents', 'INSERT')
    or has_table_privilege('authenticated', 'public.user_legal_consents', 'UPDATE')
    or has_table_privilege('authenticated', 'public.user_legal_consents', 'DELETE')
  then
    raise exception 'authenticated must have SELECT-only table privileges';
  end if;

  if not has_table_privilege('service_role', 'public.user_legal_consents', 'SELECT')
    or not has_table_privilege('service_role', 'public.user_legal_consents', 'INSERT')
    or not has_table_privilege('service_role', 'public.user_legal_consents', 'UPDATE')
    or not has_table_privilege('service_role', 'public.user_legal_consents', 'DELETE')
  then
    raise exception 'service_role must retain the trusted writer privileges';
  end if;

  if (
    select count(*) from pg_policies
    where schemaname = 'public'
      and tablename = 'user_legal_consents'
      and policyname = 'user_legal_consents_select_own'
      and cmd = 'SELECT'
      and roles = array['authenticated'::name]
      and qual ilike '%auth.uid()%'
      and qual ilike '%user_id%'
  ) <> 1 then
    raise exception 'owner SELECT policy is missing or malformed';
  end if;
end $$;

insert into auth.users (id, aud, role, email, created_at, updated_at)
values
  ('25100000-0000-4000-8000-000000000001', 'authenticated', 'authenticated', 'order251-a@example.test', now(), now()),
  ('25100000-0000-4000-8000-000000000002', 'authenticated', 'authenticated', 'order251-b@example.test', now(), now());

insert into public.user_legal_consents (
  id, user_id, consent_type, document_version, consented_at
)
values
  ('25110000-0000-4000-8000-000000000001', '25100000-0000-4000-8000-000000000001', 'terms', 'terms-2026-09', '2026-09-28T00:00:00Z'),
  ('25110000-0000-4000-8000-000000000002', '25100000-0000-4000-8000-000000000002', 'privacy', 'privacy-2026-09', '2026-09-28T00:01:00Z');

set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"25100000-0000-4000-8000-000000000001","role":"authenticated"}',
  true
);

do $$
begin
  if (select count(*) from public.user_legal_consents) <> 1
    or not exists (
      select 1 from public.user_legal_consents
      where user_id = '25100000-0000-4000-8000-000000000001'
    )
  then
    raise exception 'owner SELECT or cross-user isolation failed';
  end if;

  begin
    insert into public.user_legal_consents (user_id, consent_type, document_version, consented_at)
    values ('25100000-0000-4000-8000-000000000001', 'terms', 'direct-write', now());
    raise exception 'authenticated INSERT unexpectedly succeeded';
  exception when insufficient_privilege then null;
  end;

  begin
    update public.user_legal_consents set document_version = 'changed';
    raise exception 'authenticated UPDATE unexpectedly succeeded';
  exception when insufficient_privilege then null;
  end;

  begin
    delete from public.user_legal_consents;
    raise exception 'authenticated DELETE unexpectedly succeeded';
  exception when insufficient_privilege then null;
  end;
end $$;

reset role;
select set_config('request.jwt.claims', '', true);

set local role anon;
do $$
begin
  begin
    perform * from public.user_legal_consents;
    raise exception 'anon SELECT unexpectedly succeeded';
  exception when insufficient_privilege then null;
  end;
end $$;
reset role;

do $$
begin
  begin
    insert into public.user_legal_consents (user_id, consent_type, document_version, consented_at)
    values ('25100000-0000-4000-8000-000000000001', 'marketing', 'invalid', now());
    raise exception 'consent_type check unexpectedly accepted an invalid value';
  exception when check_violation then null;
  end;

  begin
    insert into public.user_legal_consents (user_id, consent_type, document_version, consented_at)
    values ('25100000-0000-4000-8000-000000000001', 'terms', 'terms-2026-09', now());
    raise exception 'consent unique constraint unexpectedly accepted a duplicate';
  exception when unique_violation then null;
  end;
end $$;

delete from auth.users where id = '25100000-0000-4000-8000-000000000002';

do $$
begin
  if exists (
    select 1 from public.user_legal_consents
    where user_id = '25100000-0000-4000-8000-000000000002'
  ) then
    raise exception 'Auth user delete did not cascade to consent rows';
  end if;
end $$;

insert into auth.users (id, aud, role, email, created_at, updated_at)
values (
  '25100000-0000-4000-8000-000000000003',
  'authenticated',
  'authenticated',
  'order251-b@example.test',
  now(),
  now()
);

do $$
begin
  if exists (
    select 1 from public.user_legal_consents
    where user_id = '25100000-0000-4000-8000-000000000003'
  ) then
    raise exception 'same-email re-registration restored old consent history';
  end if;
end $$;

delete from auth.users where id = '25100000-0000-4000-8000-000000000003';

do $$
begin
  if exists (
    select 1 from order251_counts_before before
    where before.auth_users <> (select count(*) from auth.users) - 1
      or before.profiles <> (select count(*) from public.profiles) - 1
      or before.preferences <> (select count(*) from public.user_preferences) - 1
      or before.saved <> (select count(*) from public.user_saved_items)
      or before.seen <> (select count(*) from public.user_seen_items)
      or before.favorite <> (select count(*) from public.user_favorite_items)
      or before.artwall_settings <> (select count(*) from public.user_artwall_settings)
      or before.artwall_items <> (select count(*) from public.user_artwall_items)
      or before.artists <> (select count(*) from public.artists)
      or before.exhibitions <> (select count(*) from public.exhibitions)
      or before.venues <> (select count(*) from public.venues)
      or before.works <> (select count(*) from public.works)
      or before.work_artists <> (select count(*) from public.work_artists)
      or before.collection_holdings <> (select count(*) from public.collection_holdings)
  ) then
    raise exception 'Order 251 regression changed unrelated existing data';
  end if;
end $$;

rollback;
