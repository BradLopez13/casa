-- Same contract as before, but the locks are taken household first, invite
-- second: the same order the admin RPCs use (delete_household / leave_household
-- lock the households row, then touch the invites), so the two cannot deadlock.
-- The share lock on the household row also makes accept wait behind a
-- concurrent delete_household; under READ COMMITTED it then re-evaluates
-- deleted_at and gets INVITE_INVALID instead of joining a dead household.
create or replace function public.accept_invite(p_token text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := (select auth.uid());
  v_hash text := encode(extensions.digest(coalesce(p_token, ''), 'sha256'), 'hex');
  v_hid uuid;
  v_invite public.household_invites;
begin
  if v_user is null then
    raise exception 'NOT_AUTHENTICATED' using errcode = 'P0001';
  end if;

  -- Resolve the household without locking anything.
  select i.household_id into v_hid
  from public.household_invites i
  where i.token_hash = v_hash;

  if not found then
    raise exception 'INVITE_INVALID' using errcode = 'P0001';
  end if;

  -- 1) household row (shared), 2) invite row (exclusive).
  perform 1
  from public.households h
  where h.id = v_hid and h.deleted_at is null
  for share;

  if not found then
    raise exception 'INVITE_INVALID' using errcode = 'P0001';
  end if;

  -- The invite lock serialises two people redeeming the same token: the second
  -- one waits, then sees accepted_at set and gets INVITE_INVALID. State is
  -- re-read after the lock.
  select i.* into v_invite
  from public.household_invites i
  where i.token_hash = v_hash
  for update;

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
