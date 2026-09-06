-- Atomic, idempotent Work Candidate -> Work Master adoption.

create or replace function public.normalize_work_identity(value text)
returns text language sql immutable parallel safe as $$
  select lower(regexp_replace(normalize(coalesce(value, ''), NFKC), '[[:space:]・･,，.．''’`´\-‐‑‒–—―_()（）「」『』]', '', 'g'));
$$;

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
  v_presentation_created integer := 0;
begin
  select * into c from public.work_import_candidates where id = p_candidate_id for update;
  if not found then raise exception 'Work candidate not found'; end if;
  if nullif(trim(c.title), '') is null or c.artist_id is null or c.matched_venue_id is null then
    raise exception 'Core 3/3 is required: title, canonical artist, canonical holding venue';
  end if;
  if c.match_status = 'imported' and c.matched_work_id is not null then
    return jsonb_build_object('candidateId', c.id, 'workId', c.matched_work_id, 'created', false, 'idempotent', true);
  end if;

  select * into v_source from public.data_sources where id = c.data_source_id;
  select id, work_id into v_source_record_id, v_work_id
  from public.source_records where data_source_id = c.data_source_id and external_id = c.external_id for update;

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
    insert into public.works (slug, title, title_en, title_original, year_text, created_year_from, created_year_to, publication_status)
    values ('work-' || replace(c.id::text, '-', ''), c.title, c.title_en, c.title_original, c.year_text, c.created_year_from, c.created_year_to, 'draft')
    returning id into v_work_id;
    v_created := true;
  end if;

  update public.source_records set work_id = v_work_id where id = v_source_record_id and work_id is null;

  insert into public.work_artists (work_id, artist_id, role, sort_order, source, source_url, source_record_id, verified_at)
  values (v_work_id, c.artist_id, 'artist', coalesce((select max(sort_order) + 1 from public.work_artists where artist_id = c.artist_id), 1), v_source.key, c.source_url, v_source_record_id, now())
  on conflict (work_id, artist_id) do nothing;
  get diagnostics v_artist_created = row_count;

  insert into public.collection_holdings (venue_id, work_id, holding_type, source_url, source, source_record_id, verified_at)
  values (c.matched_venue_id, v_work_id, coalesce(c.holding_type, 'collection'), c.source_url, v_source.key, v_source_record_id, now())
  on conflict (venue_id, work_id) where inventory_number is null do nothing;
  get diagnostics v_holding_created = row_count;

  if c.presentation_type is not null or c.presentation_status is not null then
    insert into public.work_presentations (work_id, venue_id, presentation_type, status, source, source_url, source_record_id, verified_at)
    values (v_work_id, c.matched_venue_id, coalesce(c.presentation_type, 'unknown'), coalesce(c.presentation_status, 'unknown'), v_source.key, c.source_url, v_source_record_id, now())
    on conflict on constraint work_presentations_identity_unique do nothing;
    get diagnostics v_presentation_created = row_count;
  end if;

  insert into public.work_field_sources (work_id, field_name, source, source_url, source_record_id, value_snapshot, review_status, is_current)
  select v_work_id, x.field_name, v_source.key, c.source_url, v_source_record_id, x.value_snapshot, 'applied', true
  from (values
    ('title', to_jsonb(c.title)), ('title_en', to_jsonb(c.title_en)), ('title_original', to_jsonb(c.title_original)),
    ('year_text', to_jsonb(c.year_text)), ('created_year_from', to_jsonb(c.created_year_from)), ('created_year_to', to_jsonb(c.created_year_to))
  ) x(field_name, value_snapshot)
  where x.value_snapshot <> 'null'::jsonb
    and not exists (select 1 from public.work_field_sources s where s.work_id = v_work_id and s.field_name = x.field_name and s.is_current);

  update public.work_import_candidates set match_status = 'imported', matched_work_id = v_work_id where id = c.id;
  return jsonb_build_object('candidateId', c.id, 'workId', v_work_id, 'created', v_created, 'idempotent', false,
    'artistRelationCreated', v_artist_created > 0, 'holdingCreated', v_holding_created > 0, 'presentationCreated', v_presentation_created > 0);
end;
$$;

revoke all on function public.adopt_work_candidate(uuid) from public, anon, authenticated;
grant execute on function public.adopt_work_candidate(uuid) to service_role;
