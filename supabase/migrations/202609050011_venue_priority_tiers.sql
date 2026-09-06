-- Draft Venue Priority Tier operation model.
-- The automatic tier is reproducible; manual overrides remain explicit.

alter table public.venues
  add column if not exists auto_priority_tier text
    check (auto_priority_tier is null or auto_priority_tier in ('A', 'B', 'C', 'D', 'E')),
  add column if not exists manual_priority_tier text
    check (manual_priority_tier is null or manual_priority_tier in ('A', 'B', 'C', 'D', 'E')),
  add column if not exists tier_reason text,
  add column if not exists tier_calculated_at timestamptz;

alter table public.venues
  add column if not exists effective_priority_tier text
    generated always as (coalesce(manual_priority_tier, auto_priority_tier)) stored;

create index if not exists venues_effective_priority_tier_idx
  on public.venues (effective_priority_tier, name, id)
  where merged_into_venue_id is null;

create or replace function public.refresh_venue_priority_tiers(p_as_of date default current_date)
returns table(updated_count integer)
language plpgsql
security invoker
as $$
begin
  return query
  with activity as (
    select
      v.id,
      count(distinct eo.exhibition_id)::int as total_count,
      count(distinct eo.exhibition_id) filter (
        where eo.end_date >= p_as_of - interval '12 months' and eo.start_date <= p_as_of
      )::int as past_12m_count,
      count(distinct eo.exhibition_id) filter (
        where eo.start_date <= p_as_of and eo.end_date >= p_as_of
      )::int as active_count,
      count(distinct eo.exhibition_id) filter (where eo.start_date > p_as_of)::int as upcoming_count
    from public.venues v
    left join public.exhibition_occurrences eo on eo.venue_id = v.id
    where v.merged_into_venue_id is null
    group by v.id
  ), classified as (
    select
      v.id,
      a.total_count,
      a.past_12m_count,
      a.active_count,
      a.upcoming_count,
      case
        when wikidata.explicit_art_class and not evidence.non_art then true
        when (wikidata.explicit_art_class or evidence.art_name or v.venue_type = 'gallery' or a.total_count > 0) and evidence.non_art then false
        when a.total_count > 0 then true
        when evidence.art_name and not evidence.non_art then true
        else false
      end as is_art,
      (v.name ~ '(国立|都立|道立|府立|県立|市立|区立|町立|村立)') as is_public,
      (v.name ~* '(美術館|美術室|画廊|ギャラリー|art museum|museum of art|art gallery)') as art_name
    from public.venues v
    join activity a on a.id = v.id
    left join lateral (
      select
        coalesce((sr.raw_payload #> '{normalized,rawTypeIds}') ? 'Q207694', false)
          or coalesce((sr.raw_payload #> '{normalized,discoveryRootIds}') ? 'Q1007870', false) as explicit_art_class,
        sr.raw_payload #>> '{normalized,description}' as description
      from public.source_records sr
      join public.data_sources ds on ds.id = sr.data_source_id
      where sr.venue_id = v.id and ds.key = 'wikidata'
      order by sr.fetched_at desc nulls last
      limit 1
    ) wikidata on true
    cross join lateral (
      select
        (v.name || ' ' || coalesce(wikidata.description, '')) ~* '(美術館|美術室|画廊|ギャラリー|art museum|museum of art|art gallery)' as art_name,
        (v.name || ' ' || coalesce(wikidata.description, '')) ~* '(科学博物館|科学館|自然史|鉄道|電車|航空|空港|宇宙|天文|プラネタリウム|動物園|水族館|昆虫|恐竜|自動車|オートバイ|消防|防災|警察|医学|医療|くすり|薬の|スポーツ|競馬|考古|歴史博物館|郷土博物館|民俗博物館|science museum|natural history|railway museum|aviation museum|aerospace|zoo|aquarium|archaeolog|history museum|maritime museum|sports museum|medical museum)' as non_art
    ) evidence
  ), ranked as (
    select
      id,
      case
        when is_art and is_public and art_name and (past_12m_count >= 1 or upcoming_count >= 1 or total_count >= 3) then 'A'
        when not is_art then 'E'
        when past_12m_count >= 2 or upcoming_count >= 2 then 'B'
        when past_12m_count >= 1 or active_count >= 1 or upcoming_count >= 1 then 'C'
        else 'D'
      end as tier,
      case
        when is_art and is_public and art_name and (past_12m_count >= 1 or upcoming_count >= 1 or total_count >= 3)
          then 'Public art museum with strong current or cumulative Exhibition evidence'
        when not is_art then 'No current art relevance evidence'
        when past_12m_count >= 2 or upcoming_count >= 2 then 'Art Venue; past 12m >= 2 or upcoming >= 2'
        when past_12m_count >= 1 or active_count >= 1 or upcoming_count >= 1 then 'Art Venue with recent, active, or upcoming Exhibition'
        else 'Art Venue without recent or upcoming Exhibition activity'
      end as reason
    from classified
  ), changed as (
    update public.venues v
      set auto_priority_tier = r.tier,
          tier_reason = r.reason,
          tier_calculated_at = now()
    from ranked r
    where v.id = r.id
    returning v.id
  )
  select count(*)::int from changed;
end;
$$;

comment on column public.venues.auto_priority_tier is 'Draft automatic Priority Tier calculated by refresh_venue_priority_tiers.';
comment on column public.venues.manual_priority_tier is 'Optional human override; takes precedence over the automatic tier.';
comment on column public.venues.effective_priority_tier is 'Manual tier when present, otherwise automatic tier.';

select * from public.refresh_venue_priority_tiers(current_date);
