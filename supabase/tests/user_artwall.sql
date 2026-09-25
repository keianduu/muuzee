begin;

create temporary table order215_counts_before as
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

create temporary table order215_targets as
select
  (select id from public.exhibitions order by id limit 1 offset 0) as exhibition_id_1,
  (select id from public.exhibitions order by id limit 1 offset 1) as exhibition_id_2,
  (select id from public.exhibitions order by id limit 1 offset 2) as exhibition_id_3;

do $$
begin
  if exists (
    select 1 from order215_targets
    where exhibition_id_1 is null
      or exhibition_id_2 is null
      or exhibition_id_3 is null
  ) then
    raise exception 'Order 215 regression requires three existing Exhibitions';
  end if;
end $$;

insert into auth.users (id, aud, role, email, created_at, updated_at)
values (
  '21500000-0000-0000-0000-000000000001',
  'authenticated',
  'authenticated',
  'order215@example.test',
  now(),
  now()
);

do $$
begin
  if (select count(*) from public.profiles where user_id = '21500000-0000-0000-0000-000000000001') <> 1
    or (select count(*) from public.user_preferences where user_id = '21500000-0000-0000-0000-000000000001') <> 1
  then
    raise exception 'Order 200 Auth bootstrap regressed';
  end if;

  if exists (select 1 from public.user_saved_items where user_id = '21500000-0000-0000-0000-000000000001')
    or exists (select 1 from public.user_seen_items where user_id = '21500000-0000-0000-0000-000000000001')
    or exists (select 1 from public.user_favorite_items where user_id = '21500000-0000-0000-0000-000000000001')
    or exists (select 1 from public.user_artwall_settings where user_id = '21500000-0000-0000-0000-000000000001')
    or exists (select 1 from public.user_artwall_items where user_id = '21500000-0000-0000-0000-000000000001')
  then
    raise exception 'Auth signup created Personal Action or ArtWall rows';
  end if;
end $$;

insert into public.user_artwall_settings (user_id)
values ('21500000-0000-0000-0000-000000000001');

do $$
declare
  settings_row public.user_artwall_settings%rowtype;
begin
  select * into settings_row
  from public.user_artwall_settings
  where user_id = '21500000-0000-0000-0000-000000000001';

  if settings_row.show_icon is distinct from true
    or settings_row.columns <> 4
    or settings_row.wall_height_mode <> 'standard'
  then
    raise exception 'ArtWall Settings defaults differ from Target v1';
  end if;

  if settings_row.title is not null
    or settings_row.comment is not null
    or settings_row.background_key is not null
  then
    raise exception 'ArtWall optional presentation fields must default to null';
  end if;

  if (
    select count(*)
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'user_artwall_settings'
  ) <> 9 then
    raise exception 'ArtWall Settings column set differs from Target v1';
  end if;

  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name in ('user_artwall_settings', 'user_artwall_items')
      and data_type = 'jsonb'
  ) then
    raise exception 'ArtWall schema contains an unsupported generic JSON field';
  end if;
end $$;

update public.user_artwall_settings
set columns = 3,
    wall_height_mode = 'expanded',
    title = 'Order 215 ArtWall',
    comment = 'Regression fixture',
    background_key = 'fixture-key'
where user_id = '21500000-0000-0000-0000-000000000001';

update public.user_artwall_settings
set columns = 4,
    wall_height_mode = 'standard'
where user_id = '21500000-0000-0000-0000-000000000001';

do $$
begin
  begin
    update public.user_artwall_settings
    set columns = 2
    where user_id = '21500000-0000-0000-0000-000000000001';
    raise exception 'ArtWall Settings accepted columns = 2';
  exception when check_violation then null;
  end;

  begin
    update public.user_artwall_settings
    set columns = 5
    where user_id = '21500000-0000-0000-0000-000000000001';
    raise exception 'ArtWall Settings accepted columns = 5';
  exception when check_violation then null;
  end;

  begin
    update public.user_artwall_settings
    set wall_height_mode = 'compact'
    where user_id = '21500000-0000-0000-0000-000000000001';
    raise exception 'ArtWall Settings accepted an unsupported wall height mode';
  exception when check_violation then null;
  end;
end $$;

insert into public.user_artwall_items (user_id, exhibition_id, sort_order)
select '21500000-0000-0000-0000-000000000001', exhibition_id_1, 0
from order215_targets;

insert into public.user_artwall_items (user_id, exhibition_id, sort_order)
select '21500000-0000-0000-0000-000000000001', exhibition_id_2, 0
from order215_targets;

do $$
begin
  if exists (
    select 1
    from public.user_artwall_items
    where user_id = '21500000-0000-0000-0000-000000000001'
      and not is_visible
  ) then
    raise exception 'ArtWall Item is_visible default differs from true';
  end if;

  if (select count(*) from public.user_artwall_items where user_id = '21500000-0000-0000-0000-000000000001' and sort_order = 0) <> 2 then
    raise exception 'ArtWall sort_order is unexpectedly unique';
  end if;

  begin
    insert into public.user_artwall_items (user_id, exhibition_id, sort_order)
    select '21500000-0000-0000-0000-000000000001', exhibition_id_3, -1
    from order215_targets;
    raise exception 'ArtWall Item accepted a negative sort_order';
  exception when check_violation then null;
  end;

  begin
    insert into public.user_artwall_items (user_id, exhibition_id, sort_order)
    select '21500000-0000-0000-0000-000000000001', exhibition_id_1, 1
    from order215_targets;
    raise exception 'ArtWall Item accepted duplicate User/Exhibition membership';
  exception when unique_violation then null;
  end;

  if (
    select count(*)
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'user_artwall_items'
  ) <> 7 then
    raise exception 'ArtWall Items column set differs from Target v1';
  end if;

  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'user_artwall_items'
      and column_name in ('title', 'image_url', 'venue_name', 'artist_name', 'poster_url', 'slug', 'description')
  ) then
    raise exception 'ArtWall Items copies canonical Master display data';
  end if;
end $$;

update public.user_artwall_settings
set updated_at = '2000-01-01 00:00:00+00'
where user_id = '21500000-0000-0000-0000-000000000001';

update public.user_artwall_items
set is_visible = false,
    updated_at = '2000-01-01 00:00:00+00'
where user_id = '21500000-0000-0000-0000-000000000001'
  and sort_order = 0;

do $$
begin
  if (select updated_at from public.user_artwall_settings where user_id = '21500000-0000-0000-0000-000000000001') = '2000-01-01 00:00:00+00' then
    raise exception 'ArtWall Settings updated_at trigger did not run';
  end if;

  if exists (
    select 1
    from public.user_artwall_items
    where user_id = '21500000-0000-0000-0000-000000000001'
      and updated_at = '2000-01-01 00:00:00+00'
  ) then
    raise exception 'ArtWall Items updated_at trigger did not run';
  end if;
end $$;

do $$
declare
  artwall_tables regclass[] := array[
    'public.user_artwall_settings'::regclass,
    'public.user_artwall_items'::regclass
  ];
begin
  if (
    select count(*)
    from pg_constraint
    where conrelid = any(artwall_tables)
      and contype = 'f'
      and confrelid = 'auth.users'::regclass
      and confdeltype = 'c'
  ) <> 2 then
    raise exception 'ArtWall User FKs must use ON DELETE CASCADE';
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.user_artwall_items'::regclass
      and contype = 'f'
      and confrelid = 'public.exhibitions'::regclass
      and confdeltype = 'r'
  ) then
    raise exception 'ArtWall Exhibition FK must use ON DELETE RESTRICT';
  end if;

  if exists (
    select 1
    from pg_constraint
    where conrelid = 'public.user_artwall_items'::regclass
      and contype = 'f'
      and confrelid = 'public.user_seen_items'::regclass
  ) then
    raise exception 'ArtWall Items must not reference Seen membership';
  end if;

  if not exists (
    select 1
    from pg_indexes
    where schemaname = 'public'
      and tablename = 'user_artwall_items'
      and indexname = 'user_artwall_items_user_order_idx'
      and indexdef ilike '%(user_id, sort_order, id)%'
      and indexdef not ilike 'create unique index%'
  ) then
    raise exception 'ArtWall deterministic order index differs from Target v1';
  end if;

  if (
    select count(*)
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relname in ('user_artwall_settings', 'user_artwall_items')
      and c.relrowsecurity
  ) <> 2 then
    raise exception 'RLS is not enabled on both ArtWall tables';
  end if;

  if exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename in ('user_artwall_settings', 'user_artwall_items')
  ) then
    raise exception 'Order 215 must not create owner policies';
  end if;

  if exists (
    select 1
    from pg_trigger
    where tgrelid = 'public.user_seen_items'::regclass
      and not tgisinternal
      and pg_get_triggerdef(oid) ilike '%artwall%'
  ) then
    raise exception 'Seen has an ArtWall auto-sync trigger';
  end if;
end $$;

insert into public.user_seen_items (user_id, exhibition_id)
select '21500000-0000-0000-0000-000000000001', exhibition_id_3
from order215_targets;

do $$
begin
  if (select count(*) from public.user_artwall_items where user_id = '21500000-0000-0000-0000-000000000001') <> 2 then
    raise exception 'Seen INSERT changed ArtWall membership';
  end if;
end $$;

delete from public.user_seen_items
where user_id = '21500000-0000-0000-0000-000000000001';

do $$
begin
  if (select count(*) from public.user_artwall_items where user_id = '21500000-0000-0000-0000-000000000001') <> 2 then
    raise exception 'Seen DELETE changed ArtWall membership';
  end if;
end $$;

delete from auth.users
where id = '21500000-0000-0000-0000-000000000001';

do $$
declare
  before_counts record;
begin
  if exists (select 1 from public.profiles where user_id = '21500000-0000-0000-0000-000000000001')
    or exists (select 1 from public.user_preferences where user_id = '21500000-0000-0000-0000-000000000001')
    or exists (select 1 from public.user_artwall_settings where user_id = '21500000-0000-0000-0000-000000000001')
    or exists (select 1 from public.user_artwall_items where user_id = '21500000-0000-0000-0000-000000000001')
  then
    raise exception 'Auth delete did not cascade across Profile/Preferences/ArtWall';
  end if;

  select * into before_counts from order215_counts_before;
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
    raise exception 'Order 215 regression changed existing data counts';
  end if;
end $$;

rollback;
