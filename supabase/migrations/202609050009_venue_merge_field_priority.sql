-- Apply field-level source priority before the relation-preserving canonical merge.
-- The original implementation remains the single owner of safety guards,
-- relation migration, soft redirects, deduplication, and audit creation.

alter function public.merge_venue_into_canonical(uuid, uuid, uuid, numeric, text[], text)
  rename to merge_venue_into_canonical_base;

create or replace function public.merge_venue_into_canonical(
  p_source_venue_id uuid,
  p_canonical_venue_id uuid,
  p_candidate_id uuid default null,
  p_confidence numeric default null,
  p_match_reasons text[] default '{}',
  p_merge_method text default 'human_review'
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  source_row public.venues%rowtype;
  canonical_before jsonb;
  provenance_row record;
  merge_result jsonb;
begin
  select * into source_row
  from public.venues
  where id = p_source_venue_id
  for update;

  if source_row.id is null then
    raise exception 'venue not found';
  end if;

  -- Preserve idempotency without touching an already merged canonical row.
  if source_row.merged_into_venue_id = p_canonical_venue_id then
    return public.merge_venue_into_canonical_base(
      p_source_venue_id, p_canonical_venue_id, p_candidate_id,
      p_confidence, p_match_reasons, p_merge_method
    );
  end if;

  select to_jsonb(v) into canonical_before
  from public.venues v
  where v.id = p_canonical_venue_id
  for update;

  if canonical_before is null then
    raise exception 'venue not found';
  end if;

  -- Only fields represented by columns on venues may be promoted. The base
  -- function subsequently moves the full provenance history and selects the
  -- same higher-priority record as current.
  for provenance_row in
    select s.field_name
    from public.venue_field_sources s
    join public.venue_field_sources c
      on c.venue_id = p_canonical_venue_id
      and c.field_name = s.field_name
      and c.is_current
    where s.venue_id = p_source_venue_id
      and s.is_current
      and public.venue_source_priority(s.source) > public.venue_source_priority(c.source)
      and s.field_name = any (array[
        'name_en', 'name_native', 'postal_code', 'prefecture', 'city',
        'address', 'latitude', 'longitude', 'official_url', 'country_code',
        'region', 'district', 'description', 'access_text',
        'opening_hours_text', 'closed_days_text', 'opening_note',
        'inception_year'
      ])
  loop
    execute format(
      'update public.venues set %1$I = ($1).%1$I where id = $2',
      provenance_row.field_name
    ) using source_row, p_canonical_venue_id;
  end loop;

  merge_result := public.merge_venue_into_canonical_base(
    p_source_venue_id, p_canonical_venue_id, p_candidate_id,
    p_confidence, p_match_reasons, p_merge_method
  );

  -- Retain the true pre-wrapper snapshot in the immutable audit entry.
  if merge_result ->> 'status' = 'merged' then
    update public.venue_merge_audit
    set canonical_snapshot_before = canonical_before,
        canonical_snapshot_after = (
          select to_jsonb(v) from public.venues v where v.id = p_canonical_venue_id
        )
    where source_venue_id = p_source_venue_id;
  end if;

  return merge_result;
end;
$$;

comment on function public.merge_venue_into_canonical(uuid, uuid, uuid, numeric, text[], text)
  is 'Safely merges a Venue into its canonical record while applying Manual > Official Website > Trusted API > Wikidata field priority.';
