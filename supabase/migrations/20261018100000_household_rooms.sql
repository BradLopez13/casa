-- Household rooms: the rooms a home has, chosen when it is created. The task catalogue and
-- the room picker of the task form only offer these. The ids are the ones in
-- domain/tasks/rooms.ts, the same list the tasks.room check uses. A task keeps its room even
-- if the household later drops it.

-- A valid room list: rooms only, none twice, no nulls, at least one.
create function private.is_room_list(p_rooms text[])
returns boolean
language sql
immutable
parallel safe
set search_path = ''
as $$
  select p_rooms is not null
    and cardinality(p_rooms) > 0
    and array_position(p_rooms, null) is null
    and cardinality(p_rooms) = (select count(distinct e) from unnest(p_rooms) as e)
    and not exists (
      select 1 from unnest(p_rooms) as e
      where e not in (
        'kitchen', 'bathroom', 'living_room', 'bedroom', 'laundry', 'outdoor', 'other'
      )
    );
$$;

revoke execute on function private.is_room_list(text[]) from public, anon, authenticated;

alter table public.households
  add column rooms text[] not null
    default '{kitchen,bathroom,living_room,bedroom,laundry,outdoor,other}'
    check (private.is_room_list(rooms));

-- set_household_rooms: the caller's household rooms. Any member may set them; an empty,
-- null or unknown list is INVALID_ROOM.
create function public.set_household_rooms(p_rooms text[])
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

  select m.household_id into v_hid
  from public.household_members m
  join public.households h on h.id = m.household_id
  where m.user_id = v_user and m.left_at is null and h.deleted_at is null;

  if not found then
    raise exception 'NOT_A_MEMBER' using errcode = 'P0001';
  end if;

  if not private.is_room_list(p_rooms) then
    raise exception 'INVALID_ROOM' using errcode = 'P0001';
  end if;

  update public.households
  set rooms = p_rooms
  where id = v_hid and deleted_at is null
    and rooms is distinct from p_rooms;

  -- households has no broadcast trigger (its key is id, not household_id): tell the
  -- members here. realtime.send turns its own failures into a WARNING.
  if found then
    perform realtime.send(
      jsonb_build_object('table', 'households'),
      'changed',
      'household:' || v_hid,
      true
    );
  end if;
end;
$$;

revoke execute on function public.set_household_rooms(text[]) from public, anon;
grant execute on function public.set_household_rooms(text[]) to authenticated;
