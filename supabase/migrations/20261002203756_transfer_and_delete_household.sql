create function public.transfer_ownership(p_household_id uuid, p_new_owner_id uuid)
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

  -- Two concurrent transfers serialise here; the second re-checks ownership.
  perform 1 from public.households
  where id = p_household_id and deleted_at is null
  for update;

  if not private.is_owner(p_household_id) then
    raise exception 'NOT_OWNER' using errcode = 'P0001';
  end if;

  if p_new_owner_id = v_user then
    return;
  end if;

  if not exists (
    select 1 from public.household_members
    where household_id = p_household_id
      and user_id = p_new_owner_id
      and left_at is null
  ) then
    raise exception 'NOT_A_MEMBER' using errcode = 'P0001';
  end if;

  -- Demote first: household_members_one_owner is checked per statement.
  update public.household_members
  set role = 'member'
  where household_id = p_household_id and user_id = v_user
    and role = 'owner' and left_at is null;

  update public.household_members
  set role = 'owner'
  where household_id = p_household_id and user_id = p_new_owner_id
    and left_at is null;
end;
$$;

create function public.delete_household(p_household_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (select auth.uid()) is null then
    raise exception 'NOT_AUTHENTICATED' using errcode = 'P0001';
  end if;

  -- Lock the household row before checking: a concurrent delete or transfer
  -- finishes first and is_owner then sees the committed state.
  perform 1 from public.households
  where id = p_household_id and deleted_at is null
  for update;

  -- is_owner filters deleted households, so this also covers "already deleted".
  if not private.is_owner(p_household_id) then
    raise exception 'NOT_OWNER' using errcode = 'P0001';
  end if;

  perform private.soft_delete_household(p_household_id);
end;
$$;

revoke execute on function public.transfer_ownership(uuid, uuid) from public, anon;
revoke execute on function public.delete_household(uuid) from public, anon;
grant execute on function public.transfer_ownership(uuid, uuid) to authenticated;
grant execute on function public.delete_household(uuid) to authenticated;
