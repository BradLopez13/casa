-- Closing an occurrence that is already completed or skipped does nothing, and that is
-- decided before NOT_RECURRING: a retried skip_task, or a skip of a closed occurrence,
-- must not fail because the series has since become one-off. Privileges are unchanged
-- (create or replace keeps the revokes of 20261009190324_recurrence_rpcs.sql).
create or replace function private.close_occurrence(p_id uuid, p_today date, p_skip boolean)
returns void
language plpgsql
set search_path = ''
as $$
declare
  v_user uuid := (select auth.uid());
  v_hid uuid;
  v_occurrence public.task_occurrences%rowtype;
  v_rule jsonb;
begin
  if v_user is null then
    raise exception 'NOT_AUTHENTICATED' using errcode = 'P0001';
  end if;

  if p_today is null or abs(p_today - (now() at time zone 'utc')::date) > 1 then
    raise exception 'INVALID_TODAY' using errcode = 'P0001';
  end if;

  select o.household_id into v_hid
  from public.task_occurrences o
  where o.id = p_id;

  if not found then
    raise exception 'TASK_NOT_FOUND' using errcode = 'P0001';
  end if;

  perform 1 from public.households
  where id = v_hid and deleted_at is null
  for share;

  if not found or not private.is_member(v_hid) then
    raise exception 'TASK_NOT_FOUND' using errcode = 'P0001';
  end if;

  select * into v_occurrence
  from public.task_occurrences o
  where o.id = p_id
  for update;

  if not found then
    raise exception 'TASK_NOT_FOUND' using errcode = 'P0001';
  end if;

  select s.recurrence_rule into v_rule
  from public.task_series s
  where s.id = v_occurrence.series_id and s.household_id = v_hid;

  if v_occurrence.completed_at is not null or v_occurrence.skipped_at is not null then
    return;
  end if;

  if p_skip and v_rule is null then
    raise exception 'NOT_RECURRING' using errcode = 'P0001';
  end if;

  if p_skip then
    update public.task_occurrences
    set skipped_at = now(), skipped_by = v_user
    where id = p_id;
  else
    update public.task_occurrences
    set completed_at = now(), completed_by = v_user
    where id = p_id;
  end if;

  if v_rule is not null then
    insert into public.task_occurrences (id, series_id, household_id, due_on, assignee_id, generated_from)
    values (
      gen_random_uuid(),
      v_occurrence.series_id,
      v_hid,
      private.next_due_on(v_rule, coalesce(v_occurrence.due_on, p_today), p_today),
      case
        when v_occurrence.assignee_id is not null and exists (
          select 1
          from public.household_members m
          where m.household_id = v_hid
            and m.user_id = v_occurrence.assignee_id
            and m.left_at is null
        ) then v_occurrence.assignee_id
      end,
      p_id
    );
  end if;
end;
$$;
