-- Forward-only correction for relation visibility defaults.
-- Migration 202609190001 is already applied to existing local data, so this
-- migration preserves every relation row and every explicit operator override.

alter table public.work_artists
  alter column visibility_status set default 'hidden';

alter table public.collection_holdings
  alter column visibility_status set default 'hidden';

comment on column public.work_artists.verified_at is
  'Timestamp when the source relation was deterministically resolved/applied; not evidence of human review.';
comment on column public.collection_holdings.verified_at is
  'Timestamp when the source relation was deterministically resolved/applied; not evidence of human review.';
comment on column public.work_presentations.verified_at is
  'Timestamp when the explicitly sourced presentation relation was applied; not evidence of human review.';

create or replace function public.relation_default_visibility(
  p_source text,
  p_assertion_type text
)
returns text
language sql
stable
security definer
set search_path = public
as $$
  select case
    when p_source = 'manual' then 'public'
    when exists (
      select 1
      from public.data_sources d
      join public.data_source_assertion_policies p on p.data_source_id = d.id
      where d.key = p_source
        and p.assertion_type = p_assertion_type
        and p.enabled = true
        and p.default_visibility = 'public'
        and p.review_required = false
    ) then 'public'
    else 'hidden'
  end;
$$;

revoke all on function public.relation_default_visibility(text, text) from public, anon, authenticated;
grant execute on function public.relation_default_visibility(text, text) to service_role;

create or replace function public.reconcile_relation_visibility_defaults()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_artist_updates integer := 0;
  v_holding_updates integer := 0;
begin
  update public.work_artists wa
  set
    visibility_status = public.relation_default_visibility(wa.source, 'work_artist'),
    hidden_reason = null,
    visibility_updated_at = now()
  where wa.visibility_overridden = false
    and (
      wa.visibility_status is distinct from public.relation_default_visibility(wa.source, 'work_artist')
      or wa.hidden_reason is not null
    );
  get diagnostics v_artist_updates = row_count;

  update public.collection_holdings ch
  set
    visibility_status = public.relation_default_visibility(ch.source, 'collection_holding'),
    hidden_reason = null,
    visibility_updated_at = now()
  where ch.visibility_overridden = false
    and (
      ch.visibility_status is distinct from public.relation_default_visibility(ch.source, 'collection_holding')
      or ch.hidden_reason is not null
    );
  get diagnostics v_holding_updates = row_count;

  return jsonb_build_object(
    'workArtistUpdates', v_artist_updates,
    'collectionHoldingUpdates', v_holding_updates
  );
end;
$$;

revoke all on function public.reconcile_relation_visibility_defaults() from public, anon, authenticated;
grant execute on function public.reconcile_relation_visibility_defaults() to service_role;

select public.reconcile_relation_visibility_defaults();

-- Keep candidate adoption policy-driven after the schema default changes.
-- verified_at records deterministic source resolution/application, not a human
-- approval event. Explicit operator visibility always remains sticky.
create or replace function public.adopt_work_candidate(p_candidate_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  c public.work_import_candidates%rowtype;
  v_source public.data_sources%rowtype;
  v_source_record_id uuid;
  v_work_id uuid;
  v_duplicate_ids uuid[];
  v_created boolean := false;
  v_artist_created integer := 0;
  v_holding_created integer := 0;
  v_artist_visibility text := 'hidden';
  v_holding_visibility text := 'hidden';
begin
  select * into c from public.work_import_candidates where id = p_candidate_id for update;
  if not found then raise exception 'Work candidate not found'; end if;
  if c.match_status = 'ambiguous' then
    raise exception 'Ambiguous Work candidate cannot be applied';
  end if;
  if nullif(trim(c.title), '') is null or c.artist_id is null or c.matched_venue_id is null then
    raise exception 'Core 3/3 is required: title, canonical artist, canonical holding venue';
  end if;
  if c.match_status = 'imported' and c.matched_work_id is not null then
    return jsonb_build_object('candidateId', c.id, 'workId', c.matched_work_id, 'created', false, 'idempotent', true);
  end if;

  select * into v_source from public.data_sources where id = c.data_source_id;
  select id, work_id into v_source_record_id, v_work_id
  from public.source_records where data_source_id = c.data_source_id and external_id = c.external_id for update;

  v_artist_visibility := public.relation_default_visibility(v_source.key, 'work_artist');
  v_holding_visibility := public.relation_default_visibility(v_source.key, 'collection_holding');

  if v_work_id is null and (c.created_year_from is not null or c.created_year_to is not null or nullif(trim(c.year_text), '') is not null) then
    select array_agg(distinct w.id) into v_duplicate_ids
    from public.works w
    join public.work_artists wa on wa.work_id = w.id and wa.artist_id = c.artist_id
    join public.collection_holdings ch on ch.work_id = w.id and ch.venue_id = c.matched_venue_id
    where public.normalize_work_identity(w.title) = public.normalize_work_identity(c.title)
      and w.created_year_from is not distinct from c.created_year_from
      and w.created_year_to is not distinct from c.created_year_to
      and public.normalize_work_identity(w.year_text) = public.normalize_work_identity(c.year_text);
    if coalesce(array_length(v_duplicate_ids, 1), 0) > 1 then
      update public.work_import_candidates set match_status = 'ambiguous' where id = c.id;
      raise exception 'Multiple high-confidence Work duplicates found';
    elsif coalesce(array_length(v_duplicate_ids, 1), 0) = 1 then
      v_work_id := v_duplicate_ids[1];
    end if;
  end if;

  if v_work_id is null then
    insert into public.works
      (slug, title, title_ja, title_en, title_original, original_language, year_text, created_year_from, created_year_to, publication_status)
    values
      ('work-' || replace(c.id::text, '-', ''), c.title, c.title_ja, c.title_en, c.title_original,
       c.original_language, c.year_text, c.created_year_from, c.created_year_to, 'draft')
    returning id into v_work_id;
    v_created := true;
  end if;

  update public.source_records set work_id = v_work_id where id = v_source_record_id and work_id is null;

  insert into public.work_artists
    (work_id, artist_id, role, sort_order, source, source_url, source_record_id, verified_at,
     visibility_status, visibility_overridden, hidden_reason, visibility_updated_at)
  values
    (v_work_id, c.artist_id, 'artist',
     coalesce((select max(sort_order) + 1 from public.work_artists where artist_id = c.artist_id), 1),
     v_source.key, c.source_url, v_source_record_id, now(),
     v_artist_visibility, false, null, now())
  on conflict (work_id, artist_id) do update set
    role = excluded.role,
    source = excluded.source,
    source_url = excluded.source_url,
    source_record_id = excluded.source_record_id,
    verified_at = excluded.verified_at,
    visibility_status = case when work_artists.visibility_overridden then work_artists.visibility_status else excluded.visibility_status end,
    hidden_reason = case when work_artists.visibility_overridden then work_artists.hidden_reason else null end,
    visibility_updated_at = case when work_artists.visibility_overridden then work_artists.visibility_updated_at else now() end;
  get diagnostics v_artist_created = row_count;

  insert into public.collection_holdings
    (venue_id, work_id, holding_type, source_url, source, source_record_id, verified_at,
     visibility_status, visibility_overridden, hidden_reason, visibility_updated_at)
  values
    (c.matched_venue_id, v_work_id, coalesce(c.holding_type, 'collection'), c.source_url,
     v_source.key, v_source_record_id, now(), v_holding_visibility, false, null, now())
  on conflict (venue_id, work_id) where inventory_number is null do update set
    holding_type = excluded.holding_type,
    source_url = excluded.source_url,
    source = excluded.source,
    source_record_id = excluded.source_record_id,
    verified_at = excluded.verified_at,
    visibility_status = case when collection_holdings.visibility_overridden then collection_holdings.visibility_status else excluded.visibility_status end,
    hidden_reason = case when collection_holdings.visibility_overridden then collection_holdings.hidden_reason else null end,
    visibility_updated_at = case when collection_holdings.visibility_overridden then collection_holdings.visibility_updated_at else now() end;
  get diagnostics v_holding_created = row_count;

  insert into public.work_field_sources
    (work_id, field_name, source, source_url, source_record_id, value_snapshot, review_status, is_current)
  select v_work_id, x.field_name, v_source.key, c.source_url, v_source_record_id, x.value_snapshot, 'applied', true
  from (values
    ('title', to_jsonb(c.title)), ('title_ja', to_jsonb(c.title_ja)), ('title_en', to_jsonb(c.title_en)),
    ('title_original', to_jsonb(c.title_original)), ('original_language', to_jsonb(c.original_language)),
    ('year_text', to_jsonb(c.year_text)), ('created_year_from', to_jsonb(c.created_year_from)),
    ('created_year_to', to_jsonb(c.created_year_to))
  ) x(field_name, value_snapshot)
  where x.value_snapshot <> 'null'::jsonb
    and not exists (
      select 1 from public.work_field_sources s
      where s.work_id = v_work_id and s.field_name = x.field_name and s.is_current
    );

  update public.work_import_candidates set match_status = 'imported', matched_work_id = v_work_id where id = c.id;
  return jsonb_build_object(
    'candidateId', c.id, 'workId', v_work_id, 'created', v_created, 'idempotent', false,
    'artistRelationCreated', v_artist_created > 0, 'holdingCreated', v_holding_created > 0,
    'presentationCreated', false
  );
end;
$$;
