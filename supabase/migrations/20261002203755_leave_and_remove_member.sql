-- Shared by leave_household (owner alone) and delete_household. Locks the
-- households row first so concurrent accept_invite / leave calls serialise
-- behind it. Not callable from the API.
create function private.soft_delete_household(p_household_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- The households UPDATE goes first: it takes the row lock that accept_invite
  -- waits on (for share), so nobody can join once the delete has started.
  update public.households
  set deleted_at = now()
  where id = p_household_id and deleted_at is null;

  update public.household_members
  set left_at = now()
  where household_id = p_household_id and left_at is null;

  update public.household_invites
  set revoked_at = now()
  where household_id = p_household_id
    and revoked_at is null
    and accepted_at is null;
end;
$$;

revoke execute on function private.soft_delete_household(uuid) from public, anon, authenticated;

create function public.leave_household(p_household_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := (select auth.uid());
  v_role text;
begin
  if v_user is null then
    raise exception 'NOT_AUTHENTICATED' using errcode = 'P0001';
  end if;

  -- Household lock first (same order everywhere), so a concurrent accept,
  -- transfer or delete is serialised with this call.
  perform 1 from public.households
  where id = p_household_id and deleted_at is null
  for update;

  select m.role into v_role
  from public.household_members m
  where m.household_id = p_household_id
    and m.user_id = v_user
    and m.left_at is null
    and exists (
      select 1 from public.households h
      where h.id = m.household_id and h.deleted_at is null
    )
  for update;

  if not found then
    raise exception 'NOT_A_MEMBER' using errcode = 'P0001';
  end if;

  if v_role = 'owner' then
    if exists (
      select 1 from public.household_members
      where household_id = p_household_id
        and user_id <> v_user
        and left_at is null
    ) then
      raise exception 'OWNER_MUST_TRANSFER' using errcode = 'P0001';
    end if;

    perform private.soft_delete_household(p_household_id);
    return;
  end if;

  update public.household_members
  set left_at = now()
  where household_id = p_household_id and user_id = v_user and left_at is null;
end;
$$;

create function public.remove_member(p_household_id uuid, p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := (select auth.uid());
begin
  if v_user is null then
    raise exception 'NOT_AUTHENTICATED' using errcode = 'P0001';
  end if;

  perform 1 from public.households
  where id = p_household_id and deleted_at is null
  for update;

  if not private.is_owner(p_household_id) then
    raise exception 'NOT_OWNER' using errcode = 'P0001';
  end if;

  if p_user_id = v_user then
    raise exception 'CANNOT_REMOVE_SELF' using errcode = 'P0001';
  end if;

  update public.household_members
  set left_at = now()
  where household_id = p_household_id
    and user_id = p_user_id
    and left_at is null;

  if not found then
    raise exception 'NOT_A_MEMBER' using errcode = 'P0001';
  end if;
end;
$$;

revoke execute on function public.leave_household(uuid) from public, anon;
revoke execute on function public.remove_member(uuid, uuid) from public, anon;
grant execute on function public.leave_household(uuid) to authenticated;
grant execute on function public.remove_member(uuid, uuid) to authenticated;
