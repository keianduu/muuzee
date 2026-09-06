-- Work multilingual title model. Legacy works.title remains for compatibility.

alter table public.works
  add column title_ja text,
  add column original_language text;

alter table public.work_import_candidates
  add column title_ja text,
  add column original_language text;

comment on column public.works.title is
  'Legacy compatibility title. Japan-first display uses title_ja -> title_original -> title_en -> title.';
comment on column public.works.title_original is
  'Formal title in the original language. Never replace it with a translated title.';
comment on column public.works.original_language is
  'Explicit source language code or label for title_original; null when the source does not state it.';

create or replace function public.work_title_source_priority(value text)
returns integer language sql immutable parallel safe as $$
  select case lower(coalesce(value, ''))
    when 'manual' then 500
    when 'holding_museum_official' then 400
    when 'official_website' then 400
    when 'trusted_collection_source' then 300
    when 'trusted_api' then 300
    when 'apj_shuzo' then 300
    when 'tomuco' then 300
    when 'other_authority' then 200
    when 'wikipedia' then 200
    when 'wikidata' then 200
    when 'ai_generated' then 100
    else 0
  end;
$$;

create or replace function public.apply_work_candidate_localized_titles()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_source text;
  v_source_record_id uuid;
  v_field text;
  v_value text;
  v_current_source text;
  v_current_value jsonb;
begin
  if new.match_status <> 'imported' or new.matched_work_id is null then return new; end if;

  select d.key into v_source from public.data_sources d where d.id = new.data_source_id;
  select s.id into v_source_record_id from public.source_records s
    where s.data_source_id = new.data_source_id and s.external_id = new.external_id;

  for v_field, v_value in
    select * from (values
      ('title_ja', new.title_ja),
      ('title_en', new.title_en),
      ('title_original', new.title_original),
      ('original_language', new.original_language)
    ) as localized(field_name, field_value)
  loop
    if nullif(trim(v_value), '') is null then continue; end if;

    select s.source, s.value_snapshot into v_current_source, v_current_value
    from public.work_field_sources s
    where s.work_id = new.matched_work_id and s.field_name = v_field and s.is_current
    limit 1;

    if v_current_source is not null
       and public.work_title_source_priority(v_current_source) > public.work_title_source_priority(v_source) then
      continue;
    end if;
    if v_current_source = v_source and v_current_value = to_jsonb(v_value) then continue; end if;

    execute format('update public.works set %I = $1 where id = $2', v_field)
      using v_value, new.matched_work_id;
    update public.work_field_sources set is_current = false
      where work_id = new.matched_work_id and field_name = v_field and is_current;
    insert into public.work_field_sources
      (work_id, field_name, source, source_url, source_record_id, value_snapshot, generated_by_ai, review_status, is_current)
    values
      (new.matched_work_id, v_field, v_source, new.source_url, v_source_record_id, to_jsonb(v_value), false, 'applied', true);
  end loop;
  return new;
end;
$$;

create trigger work_import_candidate_localized_titles
after insert or update of match_status, matched_work_id, title_ja, title_en, title_original, original_language
on public.work_import_candidates
for each row execute function public.apply_work_candidate_localized_titles();

-- Existing APJ candidates were parsed as Japanese title first, then English.
-- Only backfill title_ja where the stored evidence proves the Japanese selector won:
-- no English title existed, or the two explicitly captured values differ.
update public.work_import_candidates c
set title_ja = c.title
from public.data_sources d
where c.data_source_id = d.id
  and d.key = 'apj_shuzo'
  and c.title_ja is null
  and (c.title_en is null or c.title is distinct from c.title_en);

-- Re-fire the provenance-aware application for already adopted candidates.
update public.work_import_candidates
set title_ja = title_ja
where match_status = 'imported' and matched_work_id is not null;
