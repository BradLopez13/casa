-- Same as before except the lookup also takes a shared lock on the household
-- row. delete_household updates that row first, so under READ COMMITTED an
-- accept that waits behind a delete re-evaluates h.deleted_at after the
-- deleter commits and gets INVITE_INVALID instead of joining a dead household.
create or replace function public.accept_invite(p_token text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := (select auth.uid());
  v_invite public.household_invites;
begin
  if v_user is null then
    raise exception 'NOT_AUTHENTICATED' using errcode = 'P0001';
  end if;

  -- The row lock serialises two people redeeming the same token: the second
  -- one waits, then sees accepted_at set and gets INVITE_INVALID.
  select i.* into v_invite
  from public.household_invites i
  join public.households h on h.id = i.household_id
  where i.token_hash = encode(extensions.digest(coalesce(p_token, ''), 'sha256'), 'hex')
    and h.deleted_at is null
  for update of i for share of h;

  if not found or v_invite.revoked_at is not null or v_invite.accepted_at is not null then
    raise exception 'INVITE_INVALID' using errcode = 'P0001';
  end if;

  if v_invite.expires_at <= now() then
    raise exception 'INVITE_EXPIRED' using errcode = 'P0001';
  end if;

  -- Checked before consuming anything: the invite stays usable for someone else.
  if exists (
    select 1
    from public.household_members
    where user_id = v_user and left_at is null
  ) then
    raise exception 'ALREADY_IN_HOUSEHOLD' using errcode = 'P0001';
  end if;

  -- Two concurrent accepts by the same user can both pass the check above;
  -- the loser hits household_members_one_active. Map it to the contract error
  -- instead of leaking a raw 23505.
  begin
    insert into public.household_members (household_id, user_id, role)
    values (v_invite.household_id, v_user, 'member');
  exception when unique_violation then
    raise exception 'ALREADY_IN_HOUSEHOLD' using errcode = 'P0001';
  end;

  update public.household_invites
  set accepted_by = v_user, accepted_at = now()
  where id = v_invite.id;

  return v_invite.household_id;
end;
$$;

revoke execute on function public.accept_invite(text) from public, anon;
grant execute on function public.accept_invite(text) to authenticated;
