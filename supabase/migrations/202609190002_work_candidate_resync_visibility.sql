-- Preserve the already-applied Order 659 local migration history.
-- This idempotent function replacement allows imported candidates to refresh
-- provenance while sticky manual relation visibility remains unchanged.
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

  if c.match_status = 'imported' and c.matched_work_id is not null then
    update public.work_import_candidates set match_status = 'candidate' where id = c.id;
  end if;

  return public.adopt_work_candidate(c.id) || jsonb_build_object('applied', true);
end;
$$;

revoke all on function public.auto_apply_work_candidate(uuid) from public, anon, authenticated;
grant execute on function public.auto_apply_work_candidate(uuid) to service_role;
