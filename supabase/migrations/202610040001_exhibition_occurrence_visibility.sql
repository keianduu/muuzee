-- Keep Exhibition occurrence source freshness separate from public visibility.
-- Admin manual hide is sticky and deletion remains a distinct operation.

alter table public.exhibition_occurrences
  add column visibility_status text not null default 'public'
    check (visibility_status in ('public', 'hidden')),
  add column visibility_overridden boolean not null default false,
  add column hidden_reason text,
  add column visibility_updated_at timestamptz not null default now();

comment on column public.exhibition_occurrences.visibility_status is
  'Public projection state for this Venue occurrence relation, independent from source freshness relation_status.';
comment on column public.exhibition_occurrences.visibility_overridden is
  'True after an Admin explicitly changes visibility; source sync must preserve that decision.';
