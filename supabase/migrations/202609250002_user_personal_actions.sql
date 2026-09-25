create table public.user_saved_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  exhibition_id uuid references public.exhibitions(id) on delete restrict,
  artist_id uuid references public.artists(id) on delete restrict,
  venue_id uuid references public.venues(id) on delete restrict,
  work_id uuid references public.works(id) on delete restrict,
  created_at timestamptz not null default now(),
  check (num_nonnulls(exhibition_id, artist_id, venue_id, work_id) = 1)
);

create index user_saved_items_user_created_idx
on public.user_saved_items (user_id, created_at desc);

create unique index user_saved_items_exhibition_uq
on public.user_saved_items (user_id, exhibition_id)
where exhibition_id is not null;

create unique index user_saved_items_artist_uq
on public.user_saved_items (user_id, artist_id)
where artist_id is not null;

create unique index user_saved_items_venue_uq
on public.user_saved_items (user_id, venue_id)
where venue_id is not null;

create unique index user_saved_items_work_uq
on public.user_saved_items (user_id, work_id)
where work_id is not null;

create table public.user_seen_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  exhibition_id uuid references public.exhibitions(id) on delete restrict,
  artist_id uuid references public.artists(id) on delete restrict,
  venue_id uuid references public.venues(id) on delete restrict,
  work_id uuid references public.works(id) on delete restrict,
  seen_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (num_nonnulls(exhibition_id, artist_id, venue_id, work_id) = 1)
);

create index user_seen_items_user_seen_idx
on public.user_seen_items (user_id, seen_at desc);

create unique index user_seen_items_exhibition_uq
on public.user_seen_items (user_id, exhibition_id)
where exhibition_id is not null;

create unique index user_seen_items_artist_uq
on public.user_seen_items (user_id, artist_id)
where artist_id is not null;

create unique index user_seen_items_venue_uq
on public.user_seen_items (user_id, venue_id)
where venue_id is not null;

create unique index user_seen_items_work_uq
on public.user_seen_items (user_id, work_id)
where work_id is not null;

create trigger user_seen_items_updated_at
before update on public.user_seen_items
for each row execute function public.set_updated_at();

create table public.user_favorite_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  artist_id uuid references public.artists(id) on delete restrict,
  venue_id uuid references public.venues(id) on delete restrict,
  created_at timestamptz not null default now(),
  check (num_nonnulls(artist_id, venue_id) = 1)
);

create index user_favorite_items_user_created_idx
on public.user_favorite_items (user_id, created_at desc);

create unique index user_favorite_items_artist_uq
on public.user_favorite_items (user_id, artist_id)
where artist_id is not null;

create unique index user_favorite_items_venue_uq
on public.user_favorite_items (user_id, venue_id)
where venue_id is not null;

alter table public.user_saved_items enable row level security;
alter table public.user_seen_items enable row level security;
alter table public.user_favorite_items enable row level security;
