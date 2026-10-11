-- Body of leave_household shared with delete_account, parameterised on the user
-- so delete_account can run it without a session claim switch. Not callable
-- from the API.
create function private.leave_household_as(p_household_id uuid, p_user uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_role text;
begin
  -- Household row first (accept_invite takes it shared, the admin RPCs exclusive),
  -- so a concurrent accept, transfer or delete is serialised with this call.
  perform 1 from public.households
  where id = p_household_id and deleted_at is null
  for update;

  select m.role into v_role
  from public.household_members m
  where m.household_id = p_household_id
    and m.user_id = p_user
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
        and user_id <> p_user
        and left_at is null
    ) then
      raise exception 'OWNER_MUST_TRANSFER' using errcode = 'P0001';
    end if;

    perform private.soft_delete_household(p_household_id);
    return;
  end if;

  update public.household_members
  set left_at = now()
  where household_id = p_household_id and user_id = p_user and left_at is null;
end;
$$;

revoke execute on function private.leave_household_as(uuid, uuid) from public, anon, authenticated;

create or replace function public.leave_household(p_household_id uuid)
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

  perform private.leave_household_as(p_household_id, v_user);
end;
$$;

-- Deletes the caller's account. Leaves the household first (an owner with other
-- members must transfer ownership: OWNER_MUST_TRANSFER), then removes the
-- auth.users row; profiles and memberships cascade, authored content keeps
-- existing with a null author.
create function public.delete_account()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := (select auth.uid());
  v_household uuid;
begin
  if v_user is null then
    raise exception 'NOT_AUTHENTICATED' using errcode = 'P0001';
  end if;

  select m.household_id into v_household
  from public.household_members m
  join public.households h on h.id = m.household_id
  where m.user_id = v_user
    and m.left_at is null
    and h.deleted_at is null;

  if v_household is not null then
    begin
      perform private.leave_household_as(v_household, v_user);
    exception when sqlstate 'P0001' then
      -- Lost a race with a removal: already out, carry on with the delete.
      if sqlerrm <> 'NOT_A_MEMBER' then
        raise;
      end if;
    end;
  end if;

  delete from auth.users where id = v_user;
end;
$$;

revoke execute on function public.delete_account() from public, anon;
grant execute on function public.delete_account() to authenticated;
