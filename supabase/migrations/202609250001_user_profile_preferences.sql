create table public.profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  avatar_object_path text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.user_preferences (
  user_id uuid primary key references auth.users(id) on delete cascade,
  notification_enabled boolean not null default false,
  newsletter_enabled boolean not null default false,
  country_code text,
  region text,
  prefecture text,
  city text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger profiles_updated_at
before update on public.profiles
for each row execute function public.set_updated_at();

create trigger user_preferences_updated_at
before update on public.user_preferences
for each row execute function public.set_updated_at();

alter table public.profiles enable row level security;
alter table public.user_preferences enable row level security;

create or replace function public.bootstrap_user_profile_preferences()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (user_id)
  values (new.id)
  on conflict (user_id) do nothing;

  insert into public.user_preferences (user_id)
  values (new.id)
  on conflict (user_id) do nothing;

  return new;
end;
$$;

create trigger auth_user_profile_preferences_created
after insert on auth.users
for each row execute function public.bootstrap_user_profile_preferences();

insert into public.profiles (user_id)
select id
from auth.users
on conflict (user_id) do nothing;

insert into public.user_preferences (user_id)
select id
from auth.users
on conflict (user_id) do nothing;
