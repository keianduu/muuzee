create table public.user_artwall_settings (
  user_id uuid primary key references auth.users(id) on delete cascade,
  show_icon boolean not null default true,
  title text,
  comment text,
  background_key text,
  columns smallint not null default 4,
  wall_height_mode text not null default 'standard',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (columns in (3, 4)),
  check (wall_height_mode in ('standard', 'expanded'))
);

create trigger user_artwall_settings_updated_at
before update on public.user_artwall_settings
for each row execute function public.set_updated_at();

create table public.user_artwall_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  exhibition_id uuid not null references public.exhibitions(id) on delete restrict,
  sort_order integer not null,
  is_visible boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, exhibition_id),
  check (sort_order >= 0)
);

create index user_artwall_items_user_order_idx
on public.user_artwall_items (user_id, sort_order, id);

create trigger user_artwall_items_updated_at
before update on public.user_artwall_items
for each row execute function public.set_updated_at();

alter table public.user_artwall_settings enable row level security;
alter table public.user_artwall_items enable row level security;
