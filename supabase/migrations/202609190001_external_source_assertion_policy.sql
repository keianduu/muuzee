-- External source assertion policy and relation visibility.
-- Low-risk resolved facts can be auto-applied and public by default, while
-- display claims and media remain explicit review boundaries.

create table public.data_source_assertion_policies (
  id uuid primary key default gen_random_uuid(),
  data_source_id uuid not null references public.data_sources(id) on delete cascade,
  assertion_type text not null
    check (assertion_type in ('work_artist', 'collection_holding', 'work_presentation', 'media')),
  enabled boolean not null default true,
  auto_apply boolean not null default false,
  default_visibility text not null default 'hidden'
    check (default_visibility in ('public', 'hidden')),
  review_required boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (data_source_id, assertion_type),
  check (not (auto_apply and review_required)),
  check (
    assertion_type not in ('work_presentation', 'media')
    or (auto_apply = false and default_visibility = 'hidden' and review_required = true)
  )
);

create trigger data_source_assertion_policies_updated_at
before update on public.data_source_assertion_policies
for each row execute function public.set_updated_at();

alter table public.data_source_assertion_policies enable row level security;

comment on table public.data_source_assertion_policies is
  'Server-managed policy per external source and assertion type. Secrets are never stored here.';

alter table public.work_artists
  add column visibility_status text not null default 'public'
    check (visibility_status in ('public', 'hidden')),
  add column visibility_overridden boolean not null default false,
  add column hidden_reason text,
  add column visibility_updated_at timestamptz not null default now();

alter table public.collection_holdings
  add column visibility_status text not null default 'public'
    check (visibility_status in ('public', 'hidden')),
  add column visibility_overridden boolean not null default false,
  add column hidden_reason text,
  add column visibility_updated_at timestamptz not null default now();

comment on column public.work_artists.visibility_status is
  'Public projection state for this relation, independent from Work publication_status.';
comment on column public.work_artists.visibility_overridden is
  'True after an Admin explicitly changes visibility; source sync must preserve that decision.';
comment on column public.collection_holdings.visibility_status is
  'Public projection state for this holding relation. It never implies current display.';
comment on column public.collection_holdings.visibility_overridden is
  'True after an Admin explicitly changes visibility; source sync must preserve that decision.';

insert into public.data_source_assertion_policies
  (data_source_id, assertion_type, enabled, auto_apply, default_visibility, review_required)
select d.id, p.assertion_type, true, p.auto_apply, p.default_visibility, p.review_required
from public.data_sources d
cross join (values
  ('work_artist', true, 'public', false),
  ('collection_holding', true, 'public', false),
  ('work_presentation', false, 'hidden', true),
  ('media', false, 'hidden', true)
) as p(assertion_type, auto_apply, default_visibility, review_required)
where d.key in ('apj_shuzo', 'tomuco')
on conflict (data_source_id, assertion_type) do update set
  enabled = excluded.enabled,
  auto_apply = excluded.auto_apply,
  default_visibility = excluded.default_visibility,
  review_required = excluded.review_required;

-- Existing rows are preserved and retain their prior effective visibility.
update public.work_artists
set visibility_status = 'public', visibility_overridden = false
where visibility_status is distinct from 'public' or visibility_overridden;

update public.collection_holdings
set visibility_status = 'public', visibility_overridden = false
where visibility_status is distinct from 'public' or visibility_overridden;

-- Candidate adoption remains atomic and idempotent, but stops at Work + Artist
-- + Holding. Candidate presentation fields remain evidence for later review.
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

  select default_visibility into v_artist_visibility
  from public.data_source_assertion_policies
  where data_source_id = c.data_source_id and assertion_type = 'work_artist' and enabled;
  select default_visibility into v_holding_visibility
  from public.data_source_assertion_policies
  where data_source_id = c.data_source_id and assertion_type = 'collection_holding' and enabled;
  v_artist_visibility := coalesce(v_artist_visibility, 'hidden');
  v_holding_visibility := coalesce(v_holding_visibility, 'hidden');

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

create or replace function public.auto_apply_work_candidate(p_candidate_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  c public.work_import_candidates%rowtype;
  v_artist_policy boolean;
  v_holding_policy boolean;
begin
  select * into c from public.work_import_candidates where id = p_candidate_id;
  if not found then raise exception 'Work candidate not found'; end if;
  if c.match_status = 'ambiguous' or nullif(trim(c.title), '') is null
     or c.artist_id is null or c.matched_venue_id is null then
    return jsonb_build_object('candidateId', c.id, 'applied', false, 'reason', 'not_deterministically_resolved');
  end if;

  select enabled and auto_apply and not review_required into v_artist_policy
  from public.data_source_assertion_policies
  where data_source_id = c.data_source_id and assertion_type = 'work_artist';
  select enabled and auto_apply and not review_required into v_holding_policy
  from public.data_source_assertion_policies
  where data_source_id = c.data_source_id and assertion_type = 'collection_holding';

  if not coalesce(v_artist_policy, false) or not coalesce(v_holding_policy, false) then
    return jsonb_build_object('candidateId', c.id, 'applied', false, 'reason', 'source_policy_requires_review');
  end if;

  -- An imported candidate may be fetched again with fresher source metadata.
  -- Re-enter adoption so relation provenance refreshes while sticky visibility
  -- overrides are preserved by the conflict clauses above.
  if c.match_status = 'imported' and c.matched_work_id is not null then
    update public.work_import_candidates set match_status = 'candidate' where id = c.id;
  end if;

  return public.adopt_work_candidate(c.id) || jsonb_build_object('applied', true);
end;
$$;

revoke all on function public.auto_apply_work_candidate(uuid) from public, anon, authenticated;
grant execute on function public.auto_apply_work_candidate(uuid) to service_role;
