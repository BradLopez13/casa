-- update_task / delete_task: the occurrence's household is read without locking,
-- then the household row is locked (shared) and only then the occurrence (exclusive),
-- the same order as every other RPC. A task that is missing, or whose household the
-- caller is not an active member of, is TASK_NOT_FOUND.
create function public.update_task(
  p_id uuid,
  p_title text,
  p_room text,
  p_assignee_id uuid,
  p_due_on date
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := (select auth.uid());
  v_title text := btrim(coalesce(p_title, ''));
  v_hid uuid;
  v_series uuid;
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

  select o.series_id into v_series
  from public.task_occurrences o
  where o.id = p_id
  for update;

  if not found then
    raise exception 'TASK_NOT_FOUND' using errcode = 'P0001';
  end if;

  if char_length(v_title) not between 1 and 100 then
    raise exception 'INVALID_TITLE' using errcode = 'P0001';
  end if;

  if p_room is not null
     and p_room not in ('kitchen', 'bathroom', 'living_room', 'bedroom', 'laundry', 'outdoor', 'other') then
    raise exception 'INVALID_ROOM' using errcode = 'P0001';
  end if;

  if p_assignee_id is not null and not exists (
    select 1
    from public.household_members m
    where m.household_id = v_hid
      and m.user_id = p_assignee_id
      and m.left_at is null
  ) then
    raise exception 'INVALID_ASSIGNEE' using errcode = 'P0001';
  end if;

  update public.task_series
  set title = v_title, room = p_room
  where id = v_series and household_id = v_hid;

  update public.task_occurrences
  set assignee_id = p_assignee_id, due_on = p_due_on
  where id = p_id;
end;
$$;

revoke execute on function public.update_task(uuid, text, text, uuid, date) from public, anon;
grant execute on function public.update_task(uuid, text, text, uuid, date) to authenticated;

create function public.delete_task(p_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := (select auth.uid());
  v_hid uuid;
  v_series uuid;
  v_creator uuid;
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

  select o.series_id into v_series
  from public.task_occurrences o
  where o.id = p_id
  for update;

  if not found then
    raise exception 'TASK_NOT_FOUND' using errcode = 'P0001';
  end if;

  select s.created_by into v_creator
  from public.task_series s
  where s.id = v_series and s.household_id = v_hid;

  if v_creator is distinct from v_user and not private.is_owner(v_hid) then
    raise exception 'CANNOT_DELETE_TASK' using errcode = 'P0001';
  end if;

  -- The occurrence goes with it (on delete cascade).
  delete from public.task_series where id = v_series and household_id = v_hid;
end;
$$;

revoke execute on function public.delete_task(uuid) from public, anon;
grant execute on function public.delete_task(uuid) to authenticated;
