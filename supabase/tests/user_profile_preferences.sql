begin;

create temporary table order200_counts_before as
select
  (select count(*) from auth.users) as auth_users,
  (select count(*) from public.exhibitions) as exhibitions,
  (select count(*) from public.artists) as artists,
  (select count(*) from public.venues) as venues,
  (select count(*) from public.works) as works,
  (select count(*) from public.work_artists) as work_artists,
  (select count(*) from public.collection_holdings) as collection_holdings;

insert into auth.users (
  id,
  aud,
  role,
  email,
  created_at,
  updated_at
)
values (
  '20000000-0000-0000-0000-000000000001',
  'authenticated',
  'authenticated',
  'order200@example.test',
  now(),
  now()
);

do $$
begin
  if (select count(*) from public.profiles where user_id = '20000000-0000-0000-0000-000000000001') <> 1 then
    raise exception 'Auth bootstrap did not create exactly one Profile';
  end if;
  if (select count(*) from public.user_preferences where user_id = '20000000-0000-0000-0000-000000000001') <> 1 then
    raise exception 'Auth bootstrap did not create exactly one Preferences row';
  end if;
  if exists (
    select 1
    from public.user_preferences
    where user_id = '20000000-0000-0000-0000-000000000001'
      and (notification_enabled or newsletter_enabled)
  ) then
    raise exception 'Preferences defaults are not false';
  end if;
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'profiles'
      and column_name = 'email'
  ) then
    raise exception 'Profile duplicates Auth email';
  end if;
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'profiles'
      and column_name in ('display_name', 'avatar_object_path')
      and is_nullable <> 'YES'
  ) then
    raise exception 'Profile presentation fields must be nullable';
  end if;
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'user_preferences'
      and column_name in ('country_code', 'region', 'prefecture', 'city')
      and is_nullable <> 'YES'
  ) then
    raise exception 'Preferences location fields must be nullable';
  end if;
  if (select count(*) from information_schema.columns where table_schema = 'public' and table_name = 'profiles') <> 5
    or (select count(*) from information_schema.columns where table_schema = 'public' and table_name = 'user_preferences') <> 9
  then
    raise exception 'User Data tables differ from the Target v1 column set';
  end if;
  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.profiles'::regclass
      and confrelid = 'auth.users'::regclass
      and contype = 'f'
      and confdeltype = 'c'
  ) or not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.user_preferences'::regclass
      and confrelid = 'auth.users'::regclass
      and contype = 'f'
      and confdeltype = 'c'
  ) then
    raise exception 'Auth foreign keys must use ON DELETE CASCADE';
  end if;

  insert into public.profiles (user_id)
  values ('20000000-0000-0000-0000-000000000001')
  on conflict (user_id) do nothing;
  insert into public.user_preferences (user_id)
  values ('20000000-0000-0000-0000-000000000001')
  on conflict (user_id) do nothing;

  if (select count(*) from public.profiles where user_id = '20000000-0000-0000-0000-000000000001') <> 1
    or (select count(*) from public.user_preferences where user_id = '20000000-0000-0000-0000-000000000001') <> 1
  then
    raise exception 'Bootstrap insert path is not idempotent';
  end if;

  update public.profiles
  set display_name = 'Order 200 User',
      updated_at = '2000-01-01 00:00:00+00'
  where user_id = '20000000-0000-0000-0000-000000000001';
  if (select updated_at from public.profiles where user_id = '20000000-0000-0000-0000-000000000001') = '2000-01-01 00:00:00+00' then
    raise exception 'Profile updated_at trigger did not run';
  end if;

  update public.user_preferences
  set city = 'Test City',
      updated_at = '2000-01-01 00:00:00+00'
  where user_id = '20000000-0000-0000-0000-000000000001';
  if (select updated_at from public.user_preferences where user_id = '20000000-0000-0000-0000-000000000001') = '2000-01-01 00:00:00+00' then
    raise exception 'Preferences updated_at trigger did not run';
  end if;

  if not exists (
    select 1 from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relname = 'profiles' and c.relrowsecurity
  ) or not exists (
    select 1 from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relname = 'user_preferences' and c.relrowsecurity
  ) then
    raise exception 'RLS is not enabled on both User Data tables';
  end if;

  if exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename in ('profiles', 'user_preferences')
  ) then
    raise exception 'Order 200 must not create owner policies';
  end if;

  if not exists (
    select 1
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = 'bootstrap_user_profile_preferences'
      and p.prosecdef
      and coalesce(p.proconfig, '{}'::text[]) @> array['search_path=""']::text[]
  ) then
    raise exception 'Auth bootstrap function security boundary is incorrect';
  end if;
end $$;

delete from auth.users
where id = '20000000-0000-0000-0000-000000000001';

insert into auth.users (
  id,
  aud,
  role,
  email,
  created_at,
  updated_at
)
values (
  '20000000-0000-0000-0000-000000000002',
  'authenticated',
  'authenticated',
  'order200-backfill@example.test',
  now(),
  now()
);

delete from public.profiles
where user_id = '20000000-0000-0000-0000-000000000002';

delete from public.user_preferences
where user_id = '20000000-0000-0000-0000-000000000002';

insert into public.profiles (user_id)
select id
from auth.users
on conflict (user_id) do nothing;

insert into public.user_preferences (user_id)
select id
from auth.users
on conflict (user_id) do nothing;

do $$
begin
  if (select count(*) from public.profiles where user_id = '20000000-0000-0000-0000-000000000002') <> 1
    or (select count(*) from public.user_preferences where user_id = '20000000-0000-0000-0000-000000000002') <> 1
  then
    raise exception 'Existing Auth user backfill did not create both shells';
  end if;
end $$;

delete from auth.users
where id = '20000000-0000-0000-0000-000000000002';

do $$
declare
  before_counts record;
begin
  if exists (select 1 from public.profiles where user_id = '20000000-0000-0000-0000-000000000001') then
    raise exception 'Auth delete did not cascade to Profile';
  end if;
  if exists (select 1 from public.user_preferences where user_id = '20000000-0000-0000-0000-000000000001') then
    raise exception 'Auth delete did not cascade to Preferences';
  end if;

  select * into before_counts from order200_counts_before;
  if before_counts.auth_users <> (select count(*) from auth.users)
    or before_counts.exhibitions <> (select count(*) from public.exhibitions)
    or before_counts.artists <> (select count(*) from public.artists)
    or before_counts.venues <> (select count(*) from public.venues)
    or before_counts.works <> (select count(*) from public.works)
    or before_counts.work_artists <> (select count(*) from public.work_artists)
    or before_counts.collection_holdings <> (select count(*) from public.collection_holdings)
  then
    raise exception 'Focused regression changed Auth, Master or Relation counts';
  end if;
end $$;

rollback;
