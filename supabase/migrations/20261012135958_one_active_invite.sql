-- A household keeps a single open invite: creating one revokes every other open
-- invite (accepted_at and revoked_at both null) of that household. Expired but
-- unaccepted invites are revoked too; that keeps the predicate identical to "open"
-- and avoids a second branch. The household row is locked first (the project's lock
-- order: household before invite rows), so two concurrent calls serialise and the
-- second revokes the first's invite instead of both leaving zero open invites.
create or replace function public.create_invite(p_household_id uuid)
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

  -- 1) household row (exclusive), 2) invite rows.
  perform 1
  from public.households h
  where h.id = p_household_id and h.deleted_at is null
  for update;

  if not found then
    raise exception 'NOT_A_MEMBER' using errcode = 'P0001';
  end if;

  update public.household_invites i
  set revoked_at = now()
  where i.household_id = p_household_id
    and i.accepted_at is null
    and i.revoked_at is null;

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
