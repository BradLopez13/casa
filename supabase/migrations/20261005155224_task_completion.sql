-- complete_task / reopen_task: same lock order as update_task (household row shared,
-- then the occurrence exclusive); a missing task, a deleted household or a caller who
-- is not an active member are all TASK_NOT_FOUND.
--
-- Plan 4: complete_task will also generate the next occurrence of a recurring series,
-- and reopen_task will have to withdraw that generated occurrence again.

-- Completing is idempotent: the first completer wins, later calls change nothing.
create function public.complete_task(p_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := (select auth.uid());
  v_hid uuid;
begin
  if v_user is null then
    raise exception 'NOT_AUTHENTICATED' using errcode = 'P0001';
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

  perform 1 from public.task_occurrences o
  where o.id = p_id
  for update;

  if not found then
    raise exception 'TASK_NOT_FOUND' using errcode = 'P0001';
  end if;

  update public.task_occurrences
  set completed_at = now(), completed_by = v_user
  where id = p_id and completed_at is null;
end;
$$;

revoke execute on function public.complete_task(uuid) from public, anon;
grant execute on function public.complete_task(uuid) to authenticated;

-- Any member can reopen. An open task must never be assigned to someone who has left,
-- so a departed assignee (kept for history while the task was completed) is cleared.
create function public.reopen_task(p_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := (select auth.uid());
  v_hid uuid;
begin
  if v_user is null then
    raise exception 'NOT_AUTHENTICATED' using errcode = 'P0001';
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

  perform 1 from public.task_occurrences o
  where o.id = p_id
  for update;

  if not found then
    raise exception 'TASK_NOT_FOUND' using errcode = 'P0001';
  end if;

  update public.task_occurrences o
  set completed_at = null,
      completed_by = null,
      assignee_id = case
        when o.assignee_id is not null and not exists (
          select 1
          from public.household_members m
          where m.household_id = v_hid
            and m.user_id = o.assignee_id
            and m.left_at is null
        ) then null
        else o.assignee_id
      end
  where o.id = p_id and o.completed_at is not null;
end;
$$;

revoke execute on function public.reopen_task(uuid) from public, anon;
grant execute on function public.reopen_task(uuid) to authenticated;
