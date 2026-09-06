-- Draft Artist Priority Tier based only on Exhibition relevance.
-- Future collection/work signals can be added inside the refresh function.

alter table public.artists
  add column if not exists auto_priority_tier text
    check (auto_priority_tier is null or auto_priority_tier in ('A', 'B', 'C')),
  add column if not exists manual_priority_tier text
    check (manual_priority_tier is null or manual_priority_tier in ('A', 'B', 'C')),
  add column if not exists tier_reason text,
  add column if not exists tier_calculated_at timestamptz;

alter table public.artists
  add column if not exists effective_priority_tier text
    generated always as (coalesce(manual_priority_tier, auto_priority_tier)) stored;

create index if not exists artists_effective_priority_tier_idx
  on public.artists (effective_priority_tier, name, id);

create or replace function public.refresh_artist_priority_tiers(p_as_of date default current_date)
returns table(updated_count integer)
language plpgsql
security invoker
as $$
begin
  return query
  with activity as (
    select
      a.id,
      bool_or(coalesce(eo.end_date, eo.start_date) >= p_as_of) as current_or_upcoming,
      bool_or(
        coalesce(eo.end_date, eo.start_date) < p_as_of
        and coalesce(eo.end_date, eo.start_date) >= p_as_of - interval '12 months'
      ) as past_12m
    from public.artists a
    left join public.exhibition_artists ea on ea.artist_id = a.id and ea.match_status = 'matched'
    left join public.exhibition_occurrences eo on eo.exhibition_id = ea.exhibition_id
    group by a.id
  ), classified as (
    select id,
      case when current_or_upcoming then 'A' when past_12m then 'B' else 'C' end as tier,
      case when current_or_upcoming then 'Current or upcoming Exhibition relation'
           when past_12m then 'Exhibition relation within the past 12 months'
           else 'No current, upcoming, or past-12-month Exhibition relation' end as reason
    from activity
  ), changed as (
    update public.artists a
      set auto_priority_tier = c.tier,
          tier_reason = c.reason,
          tier_calculated_at = now()
    from classified c
    where a.id = c.id
    returning a.id
  )
  select count(*)::int from changed;
end;
$$;

comment on column public.artists.auto_priority_tier is 'Draft automatic A/B/C Tier calculated from matched Exhibition relations.';
comment on column public.artists.manual_priority_tier is 'Optional human override; takes precedence over the automatic tier.';
comment on column public.artists.effective_priority_tier is 'Manual tier when present, otherwise automatic tier.';

select * from public.refresh_artist_priority_tiers(current_date);
