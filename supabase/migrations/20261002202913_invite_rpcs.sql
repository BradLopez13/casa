create function public.create_invite(p_household_id uuid)
returns table (invite_id uuid, token text, expires_at timestamptz)
language plpgsql
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  v_user uuid := (select auth.uid());
  v_token text;
  v_expires timestamptz := now() + interval '7 days';
  v_id uuid;
begin
  if v_user is null then
    raise exception 'NOT_AUTHENTICATED' using errcode = 'P0001';
  end if;

  if not private.is_member(p_household_id) then
    raise exception 'NOT_A_MEMBER' using errcode = 'P0001';
  end if;

  v_token := encode(extensions.gen_random_bytes(24), 'hex');

  insert into public.household_invites (household_id, token_hash, created_by, expires_at)
  values (
    p_household_id,
    encode(extensions.digest(v_token, 'sha256'), 'hex'),
    v_user,
    v_expires
  )
  returning id into v_id;

  -- The plain token only ever exists in this response.
  return query select v_id, v_token, v_expires;
end;
$$;

create function public.revoke_invite(p_invite_id uuid)
returns void
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

  select * into v_invite
  from public.household_invites
  where id = p_invite_id
  for update;

  -- Missing and foreign invites are indistinguishable, so ids do not leak.
  if not found or not private.is_member(v_invite.household_id) then
    raise exception 'INVITE_INVALID' using errcode = 'P0001';
  end if;

  if v_invite.created_by is distinct from v_user
     and not private.is_owner(v_invite.household_id) then
    raise exception 'NOT_OWNER' using errcode = 'P0001';
  end if;

  -- Already revoked or accepted: nothing to do.
  if v_invite.revoked_at is not null or v_invite.accepted_at is not null then
    return;
  end if;

  update public.household_invites
  set revoked_at = now()
  where id = p_invite_id;
end;
$$;

revoke execute on function public.create_invite(uuid) from public, anon;
revoke execute on function public.revoke_invite(uuid) from public, anon;
grant execute on function public.create_invite(uuid) to authenticated;
grant execute on function public.revoke_invite(uuid) to authenticated;
