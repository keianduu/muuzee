create table public.user_legal_consents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  consent_type text not null,
  document_version text not null,
  consented_at timestamptz not null,
  created_at timestamptz not null default now(),
  unique (user_id, consent_type, document_version),
  check (consent_type in ('terms', 'privacy'))
);

create index user_legal_consents_user_time_idx
on public.user_legal_consents (user_id, consented_at desc);

alter table public.user_legal_consents enable row level security;

revoke all on table public.user_legal_consents from anon, authenticated;
grant select on table public.user_legal_consents to authenticated;

create policy user_legal_consents_select_own
on public.user_legal_consents
for select
to authenticated
using ((select auth.uid()) = user_id);
