begin;

create temporary table order230_counts_before as
select
  (select count(*) from auth.users) as auth_users,
  (select count(*) from public.profiles) as profiles,
  (select count(*) from public.user_preferences) as user_preferences,
  (select count(*) from public.user_saved_items) as saved,
  (select count(*) from public.user_seen_items) as seen,
  (select count(*) from public.user_favorite_items) as favorite,
  (select count(*) from public.user_artwall_settings) as artwall_settings,
  (select count(*) from public.user_artwall_items) as artwall_items,
  (select count(*) from public.exhibitions) as exhibitions,
  (select count(*) from public.artists) as artists,
  (select count(*) from public.venues) as venues,
  (select count(*) from public.works) as works,
  (select count(*) from public.work_artists) as work_artists,
  (select count(*) from public.collection_holdings) as collection_holdings;

create temporary table order230_targets as
select
  (select id from public.exhibitions order by id limit 1 offset 0) as exhibition_id_1,
  (select id from public.exhibitions order by id limit 1 offset 1) as exhibition_id_2,
  (select id from public.exhibitions order by id limit 1 offset 2) as exhibition_id_3,
  (select id from public.exhibitions order by id limit 1 offset 3) as exhibition_id_4,
  (select id from public.artists order by id limit 1 offset 0) as artist_id_1,
  (select id from public.artists order by id limit 1 offset 1) as artist_id_2,
  (select id from public.venues order by id limit 1 offset 0) as venue_id_1,
  (select id from public.venues order by id limit 1 offset 1) as venue_id_2,
  (select id from public.works order by id limit 1 offset 0) as work_id_1;

grant select on table order230_targets to authenticated;

do $$
begin
  if exists (
    select 1 from order230_targets
    where exhibition_id_1 is null
      or exhibition_id_2 is null
      or exhibition_id_3 is null
      or exhibition_id_4 is null
      or artist_id_1 is null
      or artist_id_2 is null
      or venue_id_1 is null
      or venue_id_2 is null
      or work_id_1 is null
  ) then
    raise exception 'Order 230 regression requires existing canonical fixtures';
  end if;
end $$;

do $$
declare
  expected record;
  table_name text;
begin
  for expected in
    select * from (values
      ('profiles', true, false, true, false),
      ('user_preferences', true, false, true, false),
      ('user_saved_items', true, true, false, true),
      ('user_seen_items', true, true, false, true),
      ('user_favorite_items', true, true, false, true),
      ('user_artwall_settings', true, true, true, false),
      ('user_artwall_items', true, true, true, true)
    ) as grants(table_name, can_select, can_insert, can_update, can_delete)
  loop
    if has_table_privilege('authenticated', format('public.%I', expected.table_name), 'SELECT') is distinct from expected.can_select
      or has_table_privilege('authenticated', format('public.%I', expected.table_name), 'INSERT') is distinct from expected.can_insert
      or has_table_privilege('authenticated', format('public.%I', expected.table_name), 'UPDATE') is distinct from expected.can_update
      or has_table_privilege('authenticated', format('public.%I', expected.table_name), 'DELETE') is distinct from expected.can_delete
    then
      raise exception 'Authenticated grant matrix differs for %', expected.table_name;
    end if;
  end loop;

  foreach table_name in array array[
    'profiles',
    'user_preferences',
    'user_saved_items',
    'user_seen_items',
    'user_favorite_items',
    'user_artwall_settings',
    'user_artwall_items'
  ]
  loop
    if has_table_privilege('anon', format('public.%I', table_name), 'SELECT')
      or has_table_privilege('anon', format('public.%I', table_name), 'INSERT')
      or has_table_privilege('anon', format('public.%I', table_name), 'UPDATE')
      or has_table_privilege('anon', format('public.%I', table_name), 'DELETE')
    then
      raise exception 'Anonymous retained a User Data grant on %', table_name;
    end if;

    if not has_table_privilege('service_role', format('public.%I', table_name), 'SELECT')
      or not has_table_privilege('service_role', format('public.%I', table_name), 'INSERT')
      or not has_table_privilege('service_role', format('public.%I', table_name), 'UPDATE')
      or not has_table_privilege('service_role', format('public.%I', table_name), 'DELETE')
    then
      raise exception 'Migration changed service_role privileges on %', table_name;
    end if;
  end loop;
end $$;

create temporary table order230_expected_policies (
  table_name text not null,
  policy_name text not null,
  command text not null,
  needs_using boolean not null,
  needs_check boolean not null
);

insert into order230_expected_policies values
  ('profiles', 'profiles_select_own', 'SELECT', true, false),
  ('profiles', 'profiles_update_own', 'UPDATE', true, true),
  ('user_preferences', 'user_preferences_select_own', 'SELECT', true, false),
  ('user_preferences', 'user_preferences_update_own', 'UPDATE', true, true),
  ('user_saved_items', 'user_saved_items_select_own', 'SELECT', true, false),
  ('user_saved_items', 'user_saved_items_insert_own', 'INSERT', false, true),
  ('user_saved_items', 'user_saved_items_delete_own', 'DELETE', true, false),
  ('user_seen_items', 'user_seen_items_select_own', 'SELECT', true, false),
  ('user_seen_items', 'user_seen_items_insert_own', 'INSERT', false, true),
  ('user_seen_items', 'user_seen_items_delete_own', 'DELETE', true, false),
  ('user_favorite_items', 'user_favorite_items_select_own', 'SELECT', true, false),
  ('user_favorite_items', 'user_favorite_items_insert_own', 'INSERT', false, true),
  ('user_favorite_items', 'user_favorite_items_delete_own', 'DELETE', true, false),
  ('user_artwall_settings', 'user_artwall_settings_select_own', 'SELECT', true, false),
  ('user_artwall_settings', 'user_artwall_settings_insert_own', 'INSERT', false, true),
  ('user_artwall_settings', 'user_artwall_settings_update_own', 'UPDATE', true, true),
  ('user_artwall_items', 'user_artwall_items_select_own', 'SELECT', true, false),
  ('user_artwall_items', 'user_artwall_items_insert_own', 'INSERT', false, true),
  ('user_artwall_items', 'user_artwall_items_update_own', 'UPDATE', true, true),
  ('user_artwall_items', 'user_artwall_items_delete_own', 'DELETE', true, false);

do $$
begin
  if (
    select count(*) from pg_policies
    where schemaname = 'public'
      and tablename in (
        'profiles',
        'user_preferences',
        'user_saved_items',
        'user_seen_items',
        'user_favorite_items',
        'user_artwall_settings',
        'user_artwall_items'
      )
  ) <> 20 then
    raise exception 'Expected exactly 20 User Data policies';
  end if;

  if exists (
    select 1
    from order230_expected_policies expected
    left join pg_policies policy
      on policy.schemaname = 'public'
      and policy.tablename = expected.table_name
      and policy.policyname = expected.policy_name
      and policy.cmd = expected.command
    where policy.policyname is null
  ) then
    raise exception 'A required operation-specific User Data policy is missing';
  end if;

  if exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename in (
        'profiles',
        'user_preferences',
        'user_saved_items',
        'user_seen_items',
        'user_favorite_items',
        'user_artwall_settings',
        'user_artwall_items'
      )
      and (roles <> array['authenticated'::name] or cmd = 'ALL')
  ) then
    raise exception 'User Data policy targets a role other than authenticated or uses FOR ALL';
  end if;

  if exists (
    select 1
    from order230_expected_policies expected
    join pg_policies policy
      on policy.schemaname = 'public'
      and policy.tablename = expected.table_name
      and policy.policyname = expected.policy_name
    where (expected.needs_using and (
        policy.qual is null
        or policy.qual not ilike '%auth.uid()%'
        or policy.qual not ilike '%user_id%'
      ))
      or (not expected.needs_using and policy.qual is not null)
      or (expected.needs_check and (
        policy.with_check is null
        or policy.with_check not ilike '%auth.uid()%'
        or policy.with_check not ilike '%user_id%'
      ))
      or (not expected.needs_check and policy.with_check is not null)
  ) then
    raise exception 'A User Data policy has an incorrect USING/WITH CHECK owner expression';
  end if;

  if (
    select count(*)
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relname in (
        'profiles',
        'user_preferences',
        'user_saved_items',
        'user_seen_items',
        'user_favorite_items',
        'user_artwall_settings',
        'user_artwall_items'
      )
      and c.relrowsecurity
      and not c.relforcerowsecurity
  ) <> 7 then
    raise exception 'User Data RLS must be enabled without FORCE RLS';
  end if;
end $$;

insert into auth.users (id, aud, role, email, created_at, updated_at)
values
  (
    '23000000-0000-4000-8000-000000000001',
    'authenticated',
    'authenticated',
    'order230-a@example.test',
    now(),
    now()
  ),
  (
    '23000000-0000-4000-8000-000000000002',
    'authenticated',
    'authenticated',
    'order230-b@example.test',
    now(),
    now()
  );

do $$
begin
  if (select count(*) from public.profiles where user_id in (
      '23000000-0000-4000-8000-000000000001',
      '23000000-0000-4000-8000-000000000002'
    )) <> 2
    or (select count(*) from public.user_preferences where user_id in (
      '23000000-0000-4000-8000-000000000001',
      '23000000-0000-4000-8000-000000000002'
    )) <> 2
  then
    raise exception 'SECURITY DEFINER Auth bootstrap did not create both Profile/Preferences shells';
  end if;
end $$;

insert into public.user_saved_items (user_id, exhibition_id)
select '23000000-0000-4000-8000-000000000002', exhibition_id_1 from order230_targets;

insert into public.user_seen_items (user_id, exhibition_id)
select '23000000-0000-4000-8000-000000000002', exhibition_id_1 from order230_targets;

insert into public.user_favorite_items (user_id, artist_id)
select '23000000-0000-4000-8000-000000000002', artist_id_1 from order230_targets;

insert into public.user_artwall_settings (user_id, title)
values ('23000000-0000-4000-8000-000000000002', 'User B');

insert into public.user_artwall_items (user_id, exhibition_id, sort_order)
select '23000000-0000-4000-8000-000000000002', exhibition_id_1, 0 from order230_targets;

set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"23000000-0000-4000-8000-000000000001","role":"authenticated"}',
  true
);

do $$
declare
  affected integer;
begin
  if (select auth.uid()) <> '23000000-0000-4000-8000-000000000001'::uuid then
    raise exception 'Authenticated JWT simulation did not set auth.uid()';
  end if;

  if (select count(*) from public.profiles) <> 1
    or (select count(*) from public.profiles where user_id = '23000000-0000-4000-8000-000000000002') <> 0
  then
    raise exception 'Profile SELECT exposed another user';
  end if;

  update public.profiles
  set display_name = 'User A'
  where user_id = '23000000-0000-4000-8000-000000000001';
  get diagnostics affected = row_count;
  if affected <> 1 then
    raise exception 'Owner Profile UPDATE failed';
  end if;

  update public.profiles
  set display_name = 'cross-user'
  where user_id = '23000000-0000-4000-8000-000000000002';
  get diagnostics affected = row_count;
  if affected <> 0 then
    raise exception 'Cross-user Profile UPDATE succeeded';
  end if;

  begin
    insert into public.profiles (user_id)
    values ('23000000-0000-4000-8000-000000000001');
    raise exception 'Authenticated Profile INSERT unexpectedly succeeded';
  exception when insufficient_privilege then null;
  end;

  begin
    delete from public.profiles
    where user_id = '23000000-0000-4000-8000-000000000001';
    raise exception 'Authenticated Profile DELETE unexpectedly succeeded';
  exception when insufficient_privilege then null;
  end;

  if (select count(*) from public.user_preferences) <> 1
    or (select count(*) from public.user_preferences where user_id = '23000000-0000-4000-8000-000000000002') <> 0
  then
    raise exception 'Preferences SELECT exposed another user';
  end if;

  update public.user_preferences
  set city = 'Tokyo'
  where user_id = '23000000-0000-4000-8000-000000000001';
  get diagnostics affected = row_count;
  if affected <> 1 then
    raise exception 'Owner Preferences UPDATE failed';
  end if;

  update public.user_preferences
  set city = 'cross-user'
  where user_id = '23000000-0000-4000-8000-000000000002';
  get diagnostics affected = row_count;
  if affected <> 0 then
    raise exception 'Cross-user Preferences UPDATE succeeded';
  end if;

  begin
    insert into public.user_preferences (user_id)
    values ('23000000-0000-4000-8000-000000000001');
    raise exception 'Authenticated Preferences INSERT unexpectedly succeeded';
  exception when insufficient_privilege then null;
  end;

  begin
    delete from public.user_preferences
    where user_id = '23000000-0000-4000-8000-000000000001';
    raise exception 'Authenticated Preferences DELETE unexpectedly succeeded';
  exception when insufficient_privilege then null;
  end;
end $$;

insert into public.user_saved_items (user_id, exhibition_id)
select '23000000-0000-4000-8000-000000000001', exhibition_id_2 from order230_targets;

do $$
declare
  affected integer;
begin
  if (select count(*) from public.user_saved_items) <> 1
    or (select count(*) from public.user_saved_items where user_id = '23000000-0000-4000-8000-000000000002') <> 0
  then
    raise exception 'Saved SELECT exposed another user';
  end if;

  begin
    insert into public.user_saved_items (user_id, exhibition_id)
    select '23000000-0000-4000-8000-000000000002', exhibition_id_3 from order230_targets;
    raise exception 'Saved accepted another user_id';
  exception when insufficient_privilege then null;
  end;

  delete from public.user_saved_items
  where user_id = '23000000-0000-4000-8000-000000000002';
  get diagnostics affected = row_count;
  if affected <> 0 then
    raise exception 'Saved DELETE removed another user row';
  end if;

  begin
    update public.user_saved_items
    set exhibition_id = (select exhibition_id_3 from order230_targets)
    where user_id = '23000000-0000-4000-8000-000000000001';
    raise exception 'Saved UPDATE unexpectedly succeeded';
  exception when insufficient_privilege then null;
  end;

  delete from public.user_saved_items
  where user_id = '23000000-0000-4000-8000-000000000001';
  get diagnostics affected = row_count;
  if affected <> 1 then
    raise exception 'Owner Saved DELETE failed';
  end if;
end $$;

insert into public.user_saved_items (user_id, exhibition_id)
select '23000000-0000-4000-8000-000000000001', exhibition_id_2 from order230_targets;

insert into public.user_seen_items (user_id, exhibition_id)
select '23000000-0000-4000-8000-000000000001', exhibition_id_2 from order230_targets;

do $$
declare
  affected integer;
begin
  if (select count(*) from public.user_seen_items) <> 1 then
    raise exception 'Seen SELECT exposed another user or hid the owner row';
  end if;

  begin
    insert into public.user_seen_items (user_id, exhibition_id)
    select '23000000-0000-4000-8000-000000000002', exhibition_id_3 from order230_targets;
    raise exception 'Seen accepted another user_id';
  exception when insufficient_privilege then null;
  end;

  delete from public.user_seen_items
  where user_id = '23000000-0000-4000-8000-000000000002';
  get diagnostics affected = row_count;
  if affected <> 0 then
    raise exception 'Seen DELETE removed another user row';
  end if;

  begin
    update public.user_seen_items
    set seen_at = now()
    where user_id = '23000000-0000-4000-8000-000000000001';
    raise exception 'Seen UPDATE unexpectedly succeeded';
  exception when insufficient_privilege then null;
  end;

  delete from public.user_seen_items
  where user_id = '23000000-0000-4000-8000-000000000001';
  get diagnostics affected = row_count;
  if affected <> 1 then
    raise exception 'Owner Seen DELETE failed';
  end if;
end $$;

insert into public.user_seen_items (user_id, exhibition_id)
select '23000000-0000-4000-8000-000000000001', exhibition_id_2 from order230_targets;

insert into public.user_favorite_items (user_id, venue_id)
select '23000000-0000-4000-8000-000000000001', venue_id_2 from order230_targets;

do $$
declare
  affected integer;
begin
  if (select count(*) from public.user_favorite_items) <> 1 then
    raise exception 'Favorite SELECT exposed another user or hid the owner row';
  end if;

  begin
    insert into public.user_favorite_items (user_id, artist_id)
    select '23000000-0000-4000-8000-000000000002', artist_id_2 from order230_targets;
    raise exception 'Favorite accepted another user_id';
  exception when insufficient_privilege then null;
  end;

  delete from public.user_favorite_items
  where user_id = '23000000-0000-4000-8000-000000000002';
  get diagnostics affected = row_count;
  if affected <> 0 then
    raise exception 'Favorite DELETE removed another user row';
  end if;

  begin
    update public.user_favorite_items
    set venue_id = (select venue_id_1 from order230_targets)
    where user_id = '23000000-0000-4000-8000-000000000001';
    raise exception 'Favorite UPDATE unexpectedly succeeded';
  exception when insufficient_privilege then null;
  end;

  delete from public.user_favorite_items
  where user_id = '23000000-0000-4000-8000-000000000001';
  get diagnostics affected = row_count;
  if affected <> 1 then
    raise exception 'Owner Favorite DELETE failed';
  end if;
end $$;

insert into public.user_favorite_items (user_id, venue_id)
select '23000000-0000-4000-8000-000000000001', venue_id_2 from order230_targets;

insert into public.user_artwall_settings (user_id, title)
values ('23000000-0000-4000-8000-000000000001', 'User A')
on conflict (user_id) do update set title = excluded.title;

insert into public.user_artwall_settings (user_id, title)
values ('23000000-0000-4000-8000-000000000001', 'User A updated')
on conflict (user_id) do update set title = excluded.title;

do $$
declare
  affected integer;
begin
  if (select count(*) from public.user_artwall_settings) <> 1
    or (select title from public.user_artwall_settings) <> 'User A updated'
  then
    raise exception 'Owner ArtWall Settings upsert failed or exposed another user';
  end if;

  update public.user_artwall_settings
  set title = 'cross-user'
  where user_id = '23000000-0000-4000-8000-000000000002';
  get diagnostics affected = row_count;
  if affected <> 0 then
    raise exception 'Cross-user ArtWall Settings UPDATE succeeded';
  end if;

  begin
    delete from public.user_artwall_settings
    where user_id = '23000000-0000-4000-8000-000000000001';
    raise exception 'ArtWall Settings DELETE unexpectedly succeeded';
  exception when insufficient_privilege then null;
  end;
end $$;

insert into public.user_artwall_items (user_id, exhibition_id, sort_order)
select '23000000-0000-4000-8000-000000000001', exhibition_id_2, 0 from order230_targets;

do $$
declare
  affected integer;
begin
  if (select count(*) from public.user_artwall_items) <> 1 then
    raise exception 'ArtWall Items SELECT exposed another user or hid the owner row';
  end if;

  update public.user_artwall_items
  set is_visible = false
  where user_id = '23000000-0000-4000-8000-000000000001';
  get diagnostics affected = row_count;
  if affected <> 1 then
    raise exception 'Owner ArtWall Item UPDATE failed';
  end if;

  update public.user_artwall_items
  set is_visible = false
  where user_id = '23000000-0000-4000-8000-000000000002';
  get diagnostics affected = row_count;
  if affected <> 0 then
    raise exception 'Cross-user ArtWall Item UPDATE succeeded';
  end if;

  begin
    insert into public.user_artwall_items (user_id, exhibition_id, sort_order)
    select '23000000-0000-4000-8000-000000000002', exhibition_id_3, 1 from order230_targets;
    raise exception 'ArtWall Items accepted another user_id';
  exception when insufficient_privilege then null;
  end;

  begin
    update public.user_artwall_items
    set user_id = '23000000-0000-4000-8000-000000000002'
    where user_id = '23000000-0000-4000-8000-000000000001';
    raise exception 'ArtWall Items allowed user_id reassignment';
  exception when insufficient_privilege then null;
  end;

  delete from public.user_artwall_items
  where user_id = '23000000-0000-4000-8000-000000000002';
  get diagnostics affected = row_count;
  if affected <> 0 then
    raise exception 'Cross-user ArtWall Item DELETE succeeded';
  end if;

  delete from public.user_artwall_items
  where user_id = '23000000-0000-4000-8000-000000000001';
  get diagnostics affected = row_count;
  if affected <> 1 then
    raise exception 'Owner ArtWall Item DELETE failed';
  end if;
end $$;

insert into public.user_artwall_items (user_id, exhibition_id, sort_order)
select '23000000-0000-4000-8000-000000000001', exhibition_id_2, 0 from order230_targets;

reset role;

do $$
begin
  if (select display_name from public.profiles where user_id = '23000000-0000-4000-8000-000000000002') is not null
    or (select city from public.user_preferences where user_id = '23000000-0000-4000-8000-000000000002') is not null
    or (select title from public.user_artwall_settings where user_id = '23000000-0000-4000-8000-000000000002') <> 'User B'
    or (select is_visible from public.user_artwall_items where user_id = '23000000-0000-4000-8000-000000000002') is distinct from true
  then
    raise exception 'Cross-user attempts changed User B data';
  end if;
end $$;

set local role anon;
select set_config('request.jwt.claims', '{"role":"anon"}', true);

do $$
begin
  if (select auth.uid()) is not null then
    raise exception 'Anonymous JWT simulation produced an auth.uid()';
  end if;

  begin
    perform count(*) from public.profiles;
    raise exception 'Anonymous Profile SELECT unexpectedly succeeded';
  exception when insufficient_privilege then null;
  end;
end $$;

reset role;

delete from auth.users
where id = '23000000-0000-4000-8000-000000000001';

do $$
begin
  if exists (select 1 from public.profiles where user_id = '23000000-0000-4000-8000-000000000001')
    or exists (select 1 from public.user_preferences where user_id = '23000000-0000-4000-8000-000000000001')
    or exists (select 1 from public.user_saved_items where user_id = '23000000-0000-4000-8000-000000000001')
    or exists (select 1 from public.user_seen_items where user_id = '23000000-0000-4000-8000-000000000001')
    or exists (select 1 from public.user_favorite_items where user_id = '23000000-0000-4000-8000-000000000001')
    or exists (select 1 from public.user_artwall_settings where user_id = '23000000-0000-4000-8000-000000000001')
    or exists (select 1 from public.user_artwall_items where user_id = '23000000-0000-4000-8000-000000000001')
  then
    raise exception 'Auth delete did not cascade all User A data';
  end if;

  if not exists (select 1 from public.profiles where user_id = '23000000-0000-4000-8000-000000000002')
    or not exists (select 1 from public.user_preferences where user_id = '23000000-0000-4000-8000-000000000002')
    or not exists (select 1 from public.user_saved_items where user_id = '23000000-0000-4000-8000-000000000002')
    or not exists (select 1 from public.user_seen_items where user_id = '23000000-0000-4000-8000-000000000002')
    or not exists (select 1 from public.user_favorite_items where user_id = '23000000-0000-4000-8000-000000000002')
    or not exists (select 1 from public.user_artwall_settings where user_id = '23000000-0000-4000-8000-000000000002')
    or not exists (select 1 from public.user_artwall_items where user_id = '23000000-0000-4000-8000-000000000002')
  then
    raise exception 'Deleting User A changed User B data';
  end if;
end $$;

delete from auth.users
where id = '23000000-0000-4000-8000-000000000002';

do $$
declare
  before_counts record;
begin
  select * into before_counts from order230_counts_before;
  if before_counts.auth_users <> (select count(*) from auth.users)
    or before_counts.profiles <> (select count(*) from public.profiles)
    or before_counts.user_preferences <> (select count(*) from public.user_preferences)
    or before_counts.saved <> (select count(*) from public.user_saved_items)
    or before_counts.seen <> (select count(*) from public.user_seen_items)
    or before_counts.favorite <> (select count(*) from public.user_favorite_items)
    or before_counts.artwall_settings <> (select count(*) from public.user_artwall_settings)
    or before_counts.artwall_items <> (select count(*) from public.user_artwall_items)
    or before_counts.exhibitions <> (select count(*) from public.exhibitions)
    or before_counts.artists <> (select count(*) from public.artists)
    or before_counts.venues <> (select count(*) from public.venues)
    or before_counts.works <> (select count(*) from public.works)
    or before_counts.work_artists <> (select count(*) from public.work_artists)
    or before_counts.collection_holdings <> (select count(*) from public.collection_holdings)
  then
    raise exception 'Order 230 regression changed existing data counts';
  end if;
end $$;

rollback;
