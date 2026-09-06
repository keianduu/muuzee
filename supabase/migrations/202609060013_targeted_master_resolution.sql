-- Targeted Master Resolution Worker v1.
-- Existing mention tables remain the queue/audit ledger. Apply is atomic and
-- deliberately refuses to replace an existing canonical relation.

alter table public.exhibition_venue_mentions drop constraint if exists exhibition_venue_mentions_resolution_status_check;
alter table public.exhibition_venue_mentions add constraint exhibition_venue_mentions_resolution_status_check
  check (resolution_status in ('pending', 'resolved', 'ambiguous', 'no_candidate', 'failed'));
alter table public.exhibition_venue_mentions
  add column if not exists resolution_diagnostics jsonb not null default '{}'::jsonb,
  add column if not exists resolution_attempts integer not null default 0,
  add column if not exists last_attempted_at timestamptz,
  add column if not exists resolved_at timestamptz;

alter table public.exhibition_artist_mentions drop constraint if exists exhibition_artist_mentions_resolution_status_check;
alter table public.exhibition_artist_mentions add constraint exhibition_artist_mentions_resolution_status_check
  check (resolution_status in ('pending', 'resolved', 'ambiguous', 'no_candidate', 'failed'));
alter table public.exhibition_artist_mentions
  add column if not exists resolution_diagnostics jsonb not null default '{}'::jsonb,
  add column if not exists resolution_attempts integer not null default 0,
  add column if not exists last_attempted_at timestamptz,
  add column if not exists resolved_at timestamptz;

create or replace function public.resolve_exhibition_venue_mention(
  p_mention_id uuid, p_venue_id uuid, p_method text, p_confidence numeric,
  p_reason text, p_diagnostics jsonb, p_start_date date, p_end_date date,
  p_opening_hours_text text, p_closed_days_text text, p_ticket_url text
) returns jsonb language plpgsql security definer set search_path = public as $$
declare m public.exhibition_venue_mentions%rowtype; o public.exhibition_occurrences%rowtype; created boolean := false;
begin
  select * into m from public.exhibition_venue_mentions where id = p_mention_id for update;
  if not found then raise exception 'Venue mention not found'; end if;
  if m.resolution_status = 'resolved' then return jsonb_build_object('status','skipped','relationCreated',false); end if;
  select * into o from public.exhibition_occurrences where exhibition_id = m.exhibition_id order by created_at limit 1 for update;
  if found and o.venue_id <> p_venue_id then raise exception 'Existing canonical Venue relation conflict'; end if;
  if found then
    update public.exhibition_occurrences set source_record_id=m.source_record_id, source_venue_name=m.source_venue_name,
      match_method=p_method, match_confidence=p_confidence, relation_status='active', last_seen_at=now() where id=o.id;
  else
    insert into public.exhibition_occurrences(exhibition_id,venue_id,start_date,end_date,opening_hours_text,closed_days_text,ticket_url,source_record_id,source_venue_name,match_method,match_confidence,relation_status,last_seen_at)
      values(m.exhibition_id,p_venue_id,p_start_date,p_end_date,p_opening_hours_text,p_closed_days_text,p_ticket_url,m.source_record_id,m.source_venue_name,p_method,p_confidence,'active',now());
    created := true;
  end if;
  update public.exhibition_venue_mentions set matched_venue_id=p_venue_id,candidate_venue_ids=array[p_venue_id],match_method=p_method,
    match_confidence=p_confidence,match_status='resolved',resolution_status='resolved',match_reason=p_reason,
    resolution_diagnostics=coalesce(p_diagnostics,'{}'::jsonb),resolution_attempts=resolution_attempts+1,last_attempted_at=now(),resolved_at=now()
    where id=p_mention_id;
  return jsonb_build_object('status','resolved','relationCreated',created);
end $$;

create or replace function public.resolve_exhibition_artist_mention(
  p_mention_id uuid, p_artist_id uuid, p_method text, p_reason text, p_diagnostics jsonb
) returns jsonb language plpgsql security definer set search_path = public as $$
declare m public.exhibition_artist_mentions%rowtype; existing_id uuid; created boolean := false;
begin
  select * into m from public.exhibition_artist_mentions where id=p_mention_id for update;
  if not found then raise exception 'Artist mention not found'; end if;
  if m.resolution_status='resolved' then return jsonb_build_object('status','skipped','relationCreated',false); end if;
  if exists(select 1 from public.exhibition_artists where exhibition_id=m.exhibition_id and artist_id<>p_artist_id) and
     m.matched_artist_id is not null and m.matched_artist_id<>p_artist_id then raise exception 'Existing canonical Artist relation conflict'; end if;
  select id into existing_id from public.exhibition_artists where exhibition_id=m.exhibition_id and artist_id=p_artist_id for update;
  if existing_id is null then
    insert into public.exhibition_artists(exhibition_id,artist_id,role,source_artist_name,match_status,source_record_id,relation_status,last_seen_at)
      values(m.exhibition_id,p_artist_id,m.role,m.source_artist_name,'matched',m.source_record_id,'active',now()); created:=true;
  else
    update public.exhibition_artists set role=coalesce(m.role,role),source_artist_name=m.source_artist_name,source_record_id=coalesce(m.source_record_id,source_record_id),relation_status='active',last_seen_at=now() where id=existing_id;
  end if;
  update public.exhibition_artist_mentions set matched_artist_id=p_artist_id,candidate_artist_ids=array[p_artist_id],targeted_import_qid=coalesce(p_diagnostics->>'externalId',targeted_import_qid),
    match_status='matched',resolution_status='resolved',match_reason=p_reason,resolution_diagnostics=coalesce(p_diagnostics,'{}'::jsonb),resolution_attempts=resolution_attempts+1,last_attempted_at=now(),resolved_at=now()
    where id=p_mention_id;
  return jsonb_build_object('status','resolved','relationCreated',created);
end $$;

comment on function public.resolve_exhibition_venue_mention is 'Atomic targeted resolution: protect/upsert canonical occurrence and resolve its Venue mention.';
comment on function public.resolve_exhibition_artist_mention is 'Atomic targeted resolution: idempotently upsert Artist relation and resolve its mention.';
