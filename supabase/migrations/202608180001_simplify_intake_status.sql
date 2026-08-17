-- Staff manages intakes with only two states: waiting and completed.
-- Existing enum values remain for migration compatibility, but can no longer be selected.
update public.intakes
set status = 'pending_review', updated_at = now()
where status not in ('pending_review', 'completed');

create or replace function public.transition_intake_status(
  p_intake_id uuid,
  p_status public.intake_status,
  p_store_id uuid
)
returns public.intakes
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.intakes%rowtype;
  v_from public.intake_status;
begin
  if p_status not in ('pending_review', 'completed') then
    raise exception 'invalid status';
  end if;

  select * into v_row
  from public.intakes
  where id = p_intake_id and store_id = p_store_id
  for update;

  if not found then
    raise exception 'intake not found';
  end if;

  v_from := v_row.status;
  if v_from = p_status then
    return v_row;
  end if;

  update public.intakes
  set
    status = p_status,
    updated_at = now(),
    completed_at = case when p_status = 'completed' then now() else null end
  where id = p_intake_id
  returning * into v_row;

  insert into public.intake_events(
    intake_id, store_id, actor_type, event_type, from_value, to_value
  ) values (
    v_row.id,
    v_row.store_id,
    'staff_device',
    'status.changed',
    jsonb_build_object('status', v_from),
    jsonb_build_object('status', p_status)
  );

  return v_row;
end;
$$;
