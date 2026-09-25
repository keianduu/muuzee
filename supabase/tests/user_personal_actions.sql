begin;

create temporary table order210_counts_before as
select
  (select count(*) from auth.users) as auth_users,
  (select count(*) from public.profiles) as profiles,
  (select count(*) from public.user_preferences) as user_preferences,
  (select count(*) from public.exhibitions) as exhibitions,
  (select count(*) from public.artists) as artists,
  (select count(*) from public.venues) as venues,
  (select count(*) from public.works) as works,
  (select count(*) from public.work_artists) as work_artists,
  (select count(*) from public.collection_holdings) as collection_holdings;

create temporary table order210_targets as
select
  (select id from public.exhibitions order by id limit 1) as exhibition_id,
  (select id from public.artists order by id limit 1) as artist_id,
  (select id from public.venues order by id limit 1) as venue_id,
  (select id from public.works order by id limit 1) as work_id;

do $$
begin
  if exists (
    select 1 from order210_targets
    where exhibition_id is null or artist_id is null or venue_id is null or work_id is null
  ) then
    raise exception 'Order 210 regression requires one existing row for each canonical target';
  end if;
end $$;

insert into auth.users (id, aud, role, email, created_at, updated_at)
values (
  '21000000-0000-0000-0000-000000000001',
  'authenticated',
  'authenticated',
  'order210@example.test',
  now(),
  now()
);

insert into public.user_saved_items (user_id, exhibition_id)
select '21000000-0000-0000-0000-000000000001', exhibition_id from order210_targets;
insert into public.user_saved_items (user_id, artist_id)
select '21000000-0000-0000-0000-000000000001', artist_id from order210_targets;
insert into public.user_saved_items (user_id, venue_id)
select '21000000-0000-0000-0000-000000000001', venue_id from order210_targets;
insert into public.user_saved_items (user_id, work_id)
select '21000000-0000-0000-0000-000000000001', work_id from order210_targets;

do $$
begin
  begin
    insert into public.user_saved_items (user_id)
    values ('21000000-0000-0000-0000-000000000001');
    raise exception 'Saved accepted zero targets';
  exception when check_violation then null;
  end;
  begin
    insert into public.user_saved_items (user_id, exhibition_id, artist_id)
    select '21000000-0000-0000-0000-000000000001', exhibition_id, artist_id from order210_targets;
    raise exception 'Saved accepted two targets';
  exception when check_violation then null;
  end;
  begin
    insert into public.user_saved_items (user_id, exhibition_id)
    select '21000000-0000-0000-0000-000000000001', exhibition_id from order210_targets;
    raise exception 'Saved accepted duplicate Exhibition membership';
  exception when unique_violation then null;
  end;
end $$;

insert into public.user_seen_items (user_id, exhibition_id)
select '21000000-0000-0000-0000-000000000001', exhibition_id from order210_targets;
insert into public.user_seen_items (user_id, artist_id)
select '21000000-0000-0000-0000-000000000001', artist_id from order210_targets;
insert into public.user_seen_items (user_id, venue_id)
select '21000000-0000-0000-0000-000000000001', venue_id from order210_targets;
insert into public.user_seen_items (user_id, work_id)
select '21000000-0000-0000-0000-000000000001', work_id from order210_targets;

do $$
begin
  if exists (
    select 1 from public.user_seen_items
    where user_id = '21000000-0000-0000-0000-000000000001'
      and seen_at is null
  ) then
    raise exception 'Seen seen_at default did not run';
  end if;
  begin
    insert into public.user_seen_items (user_id)
    values ('21000000-0000-0000-0000-000000000001');
    raise exception 'Seen accepted zero targets';
  exception when check_violation then null;
  end;
  begin
    insert into public.user_seen_items (user_id, exhibition_id, work_id)
    select '21000000-0000-0000-0000-000000000001', exhibition_id, work_id from order210_targets;
    raise exception 'Seen accepted two targets';
  exception when check_violation then null;
  end;
  begin
    insert into public.user_seen_items (user_id, exhibition_id)
    select '21000000-0000-0000-0000-000000000001', exhibition_id from order210_targets;
    raise exception 'Seen accepted duplicate Exhibition membership';
  exception when unique_violation then null;
  end;
end $$;

update public.user_seen_items
set updated_at = '2000-01-01 00:00:00+00'
where user_id = '21000000-0000-0000-0000-000000000001'
  and exhibition_id is not null;

do $$
begin
  if exists (
    select 1 from public.user_seen_items
    where user_id = '21000000-0000-0000-0000-000000000001'
      and exhibition_id is not null
      and updated_at = '2000-01-01 00:00:00+00'
  ) then
    raise exception 'Seen updated_at trigger did not run';
  end if;
end $$;

insert into public.user_favorite_items (user_id, artist_id)
select '21000000-0000-0000-0000-000000000001', artist_id from order210_targets;
insert into public.user_favorite_items (user_id, venue_id)
select '21000000-0000-0000-0000-000000000001', venue_id from order210_targets;

do $$
begin
  begin
    insert into public.user_favorite_items (user_id)
    values ('21000000-0000-0000-0000-000000000001');
    raise exception 'Favorite accepted zero targets';
  exception when check_violation then null;
  end;
  begin
    insert into public.user_favorite_items (user_id, artist_id, venue_id)
    select '21000000-0000-0000-0000-000000000001', artist_id, venue_id from order210_targets;
    raise exception 'Favorite accepted two targets';
  exception when check_violation then null;
  end;
  begin
    insert into public.user_favorite_items (user_id, artist_id)
    select '21000000-0000-0000-0000-000000000001', artist_id from order210_targets;
    raise exception 'Favorite accepted duplicate Artist membership';
  exception when unique_violation then null;
  end;

  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'user_favorite_items'
      and column_name in ('exhibition_id', 'work_id')
  ) then
    raise exception 'Favorite contains an unsupported Exhibition or Work target';
  end if;

  if (select count(*) from public.profiles where user_id = '21000000-0000-0000-0000-000000000001') <> 1
    or (select count(*) from public.user_preferences where user_id = '21000000-0000-0000-0000-000000000001') <> 1
  then
    raise exception 'Order 200 Auth bootstrap regressed';
  end if;
end $$;

do $$
declare
  personal_tables regclass[] := array[
    'public.user_saved_items'::regclass,
    'public.user_seen_items'::regclass,
    'public.user_favorite_items'::regclass
  ];
begin
  if (
    select count(*) from pg_constraint
    where conrelid = any(personal_tables)
      and contype = 'f'
      and confrelid = 'auth.users'::regclass
      and confdeltype = 'c'
  ) <> 3 then
    raise exception 'Personal Action user FKs must use ON DELETE CASCADE';
  end if;

  if (
    select count(*) from pg_constraint
    where conrelid = any(personal_tables)
      and contype = 'f'
      and confrelid = any(array[
        'public.exhibitions'::regclass,
        'public.artists'::regclass,
        'public.venues'::regclass,
        'public.works'::regclass
      ])
      and confdeltype = 'r'
  ) <> 10 then
    raise exception 'Personal Action Master FKs must use ON DELETE RESTRICT';
  end if;

  if exists (
    select 1
    from pg_constraint
    where conrelid = any(personal_tables)
      and contype = 'f'
      and confrelid <> 'auth.users'::regclass
      and confdeltype <> 'r'
  ) then
    raise exception 'A Personal Action Master FK has a non-RESTRICT delete action';
  end if;

  if (
    select count(*)
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relname in ('user_saved_items', 'user_seen_items', 'user_favorite_items')
      and c.relrowsecurity
  ) <> 3 then
    raise exception 'RLS is not enabled on all Personal Action tables';
  end if;

  if exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename in ('user_saved_items', 'user_seen_items', 'user_favorite_items')
  ) then
    raise exception 'Order 210 must not create owner policies';
  end if;
end $$;

delete from auth.users
where id = '21000000-0000-0000-0000-000000000001';

do $$
declare
  before_counts record;
begin
  if exists (
    select 1 from public.user_saved_items
    where user_id = '21000000-0000-0000-0000-000000000001'
  ) or exists (
    select 1 from public.user_seen_items
    where user_id = '21000000-0000-0000-0000-000000000001'
  ) or exists (
    select 1 from public.user_favorite_items
    where user_id = '21000000-0000-0000-0000-000000000001'
  ) then
    raise exception 'Auth delete did not cascade to all Personal Actions';
  end if;

  if exists (
    select 1 from public.profiles
    where user_id = '21000000-0000-0000-0000-000000000001'
  ) or exists (
    select 1 from public.user_preferences
    where user_id = '21000000-0000-0000-0000-000000000001'
  ) then
    raise exception 'Auth delete did not cascade to Profile/Preferences';
  end if;

  select * into before_counts from order210_counts_before;
  if before_counts.auth_users <> (select count(*) from auth.users)
    or before_counts.profiles <> (select count(*) from public.profiles)
    or before_counts.user_preferences <> (select count(*) from public.user_preferences)
    or before_counts.exhibitions <> (select count(*) from public.exhibitions)
    or before_counts.artists <> (select count(*) from public.artists)
    or before_counts.venues <> (select count(*) from public.venues)
    or before_counts.works <> (select count(*) from public.works)
    or before_counts.work_artists <> (select count(*) from public.work_artists)
    or before_counts.collection_holdings <> (select count(*) from public.collection_holdings)
  then
    raise exception 'Order 210 regression changed existing data counts';
  end if;
end $$;

rollback;
