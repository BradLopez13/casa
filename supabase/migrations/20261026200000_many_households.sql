-- One person, several households (bloque 12). Until now a person had at most one active
-- membership (household_members_one_active); now it is one active membership per person and
-- household. Everything else was already per household: tasks, shopping, rooms, invites,
-- members, the household:{id} broadcast and the 30-day purge. shares_household(a, b) already
-- holds for any household in common.

drop index public.household_members_one_active;

create unique index household_members_one_active
  on public.household_members (household_id, user_id)
  where left_at is null;

-- create_household no longer refuses a person who already has a household: whoever creates it
-- leads it. Same body as 20261002201955_create_household.sql otherwise.
create or replace function public.create_household(p_name text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := (select auth.uid());
  v_name text := btrim(p_name);
  v_id uuid;
begin
  if v_user is null then
    raise exception 'NOT_AUTHENTICATED' using errcode = 'P0001';
  end if;

  if v_name is null or char_length(v_name) not between 1 and 60 then
    raise exception 'INVALID_NAME' using errcode = 'P0001';
  end if;

  insert into public.households (name, created_by)
  values (v_name, v_user)
  returning id into v_id;

  insert into public.household_members (household_id, user_id, role)
  values (v_id, v_user, 'owner');

  return v_id;
end;
$$;

-- Accepting an invite, shared by both versions of accept_invite. With p_while_in_other, you may
-- accept while you have another household; only being in that same household already is refused
-- (ALREADY_A_MEMBER), and then the invite stays usable for someone else. Without it, as before
-- bloque 12: any household refuses it (ALREADY_IN_HOUSEHOLD). Lock order and idempotency as in
-- 20261003181613_accept_invite_idempotent.sql. Not callable from the API.
create function private.accept_invite_as(p_token text, p_while_in_other boolean)
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

  select i.* into v_invite
  from public.household_invites i
  where i.token_hash = v_hash
  for update;

  if not found or v_invite.revoked_at is not null then
    raise exception 'INVITE_INVALID' using errcode = 'P0001';
  end if;

  if v_invite.accepted_at is not null then
    if v_invite.accepted_by = v_user and exists (
      select 1
      from public.household_members m
      where m.household_id = v_invite.household_id
        and m.user_id = v_user
        and m.left_at is null
    ) then
      return v_invite.household_id;
    end if;
    raise exception 'INVITE_INVALID' using errcode = 'P0001';
  end if;

  if v_invite.expires_at <= now() then
    raise exception 'INVITE_EXPIRED' using errcode = 'P0001';
  end if;

  -- Checked before consuming anything: the invite stays usable for someone else.
  if exists (
    select 1
    from public.household_members
    where household_id = v_invite.household_id and user_id = v_user and left_at is null
  ) then
    raise exception 'ALREADY_A_MEMBER' using errcode = 'P0001';
  end if;

  if not p_while_in_other and exists (
    select 1
    from public.household_members m
    join public.households h on h.id = m.household_id
    where m.user_id = v_user and m.left_at is null and h.deleted_at is null
  ) then
    raise exception 'ALREADY_IN_HOUSEHOLD' using errcode = 'P0001';
  end if;

  -- The household row is held (for share) and the invite locked, so a concurrent accept by the
  -- same person waits and then sees accepted_at; the index still guards the insert.
  begin
    insert into public.household_members (household_id, user_id, role)
    values (v_invite.household_id, v_user, 'member');
  exception when unique_violation then
    raise exception 'ALREADY_A_MEMBER' using errcode = 'P0001';
  end;

  update public.household_invites
  set accepted_by = v_user, accepted_at = now()
  where id = v_invite.id;

  return v_invite.household_id;
end;
$$;

revoke execute on function private.accept_invite_as(text, boolean) from public, anon, authenticated;

-- The app before bloque 12 reads its one membership with maybeSingle(): a second household
-- would break it. So the one-argument accept_invite it calls keeps refusing anyone who already
-- has a household; the new app asks for the other behaviour explicitly.
create or replace function public.accept_invite(p_token text)
returns uuid
language sql
security definer
set search_path = ''
as $$
  select private.accept_invite_as(p_token, false);
$$;

-- Bloque 12: accepting while in another household. p_while_in_other must be true; false acts
-- as the one-argument version.
create function public.accept_invite(p_token text, p_while_in_other boolean)
returns uuid
language sql
security definer
set search_path = ''
as $$
  select private.accept_invite_as(p_token, coalesce(p_while_in_other, false));
$$;

revoke execute on function public.accept_invite(text) from public, anon;
grant execute on function public.accept_invite(text) to authenticated;
revoke execute on function public.accept_invite(text, boolean) from public, anon;
grant execute on function public.accept_invite(text, boolean) to authenticated;

-- preview_invite also says whether you are already in that household, and which one it is, so
-- the invitation can say so and take you there instead of offering to join. Only the token's
-- holder learns the id. Its result type changes, hence drop and create.
drop function public.preview_invite(text);

create function public.preview_invite(p_token text)
returns table (
  household_name text,
  inviter_name text,
  member_count int,
  already_member boolean,
  household_id uuid
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_hash text := encode(extensions.digest(coalesce(p_token, ''), 'sha256'), 'hex');
  v_invite public.household_invites;
  v_name text;
begin
  if (select auth.uid()) is null then
    raise exception 'NOT_AUTHENTICATED' using errcode = 'P0001';
  end if;

  select i.* into v_invite
  from public.household_invites i
  where i.token_hash = v_hash;

  if not found or v_invite.revoked_at is not null or v_invite.accepted_at is not null then
    raise exception 'INVITE_INVALID' using errcode = 'P0001';
  end if;

  select h.name into v_name
  from public.households h
  where h.id = v_invite.household_id and h.deleted_at is null;

  if not found then
    raise exception 'INVITE_INVALID' using errcode = 'P0001';
  end if;

  if v_invite.expires_at <= now() then
    raise exception 'INVITE_EXPIRED' using errcode = 'P0001';
  end if;

  return query
  select
    v_name,
    (select p.display_name from public.profiles p where p.user_id = v_invite.created_by),
    (select count(*)::int
     from public.household_members m
     where m.household_id = v_invite.household_id and m.left_at is null),
    exists (
      select 1
      from public.household_members m
      where m.household_id = v_invite.household_id
        and m.user_id = (select auth.uid())
        and m.left_at is null
    ),
    v_invite.household_id;
end;
$$;

revoke execute on function public.preview_invite(text) from public, anon;
grant execute on function public.preview_invite(text) to authenticated;

-- set_household_rooms for a given household. The one-argument version stays for the app of
-- before bloque 12, which only calls it from onboarding, right after creating its only household.
create function public.set_household_rooms(p_household_id uuid, p_rooms text[])
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (select auth.uid()) is null then
    raise exception 'NOT_AUTHENTICATED' using errcode = 'P0001';
  end if;

  if not private.is_member(p_household_id) then
    raise exception 'NOT_A_MEMBER' using errcode = 'P0001';
  end if;

  if not private.is_room_list(p_rooms) then
    raise exception 'INVALID_ROOM' using errcode = 'P0001';
  end if;

  update public.households
  set rooms = p_rooms
  where id = p_household_id and deleted_at is null
    and rooms is distinct from p_rooms;

  -- households has no broadcast trigger (its key is id, not household_id): tell the
  -- members here. realtime.send turns its own failures into a WARNING.
  if found then
    perform realtime.send(
      jsonb_build_object('table', 'households'),
      'changed',
      'household:' || p_household_id,
      true
    );
  end if;
end;
$$;

revoke execute on function public.set_household_rooms(uuid, text[]) from public, anon;
grant execute on function public.set_household_rooms(uuid, text[]) to authenticated;

-- The old one picks the most recently joined household, so it is at least deterministic.
create or replace function public.set_household_rooms(p_rooms text[])
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
  where m.user_id = v_user and m.left_at is null and h.deleted_at is null
  order by m.joined_at desc
  limit 1;

  if not found then
    raise exception 'NOT_A_MEMBER' using errcode = 'P0001';
  end if;

  perform public.set_household_rooms(v_hid, p_rooms);
end;
$$;

-- delete_account with several households: an owner who shares any of them must pass each one
-- first. OWNER_MUST_TRANSFER carries their names, as a JSON array in the error's detail, so the
-- app can say which. Nothing is left until every household can be left; then each is left as
-- leave_household would (an owner alone deletes it) and the account goes.
create or replace function public.delete_account()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := (select auth.uid());
  v_names jsonb;
  v_household uuid;
begin
  if v_user is null then
    raise exception 'NOT_AUTHENTICATED' using errcode = 'P0001';
  end if;

  select jsonb_agg(h.name order by m.joined_at) into v_names
  from public.household_members m
  join public.households h on h.id = m.household_id
  where m.user_id = v_user
    and m.role = 'owner'
    and m.left_at is null
    and h.deleted_at is null
    and exists (
      select 1 from public.household_members o
      where o.household_id = m.household_id and o.user_id <> v_user and o.left_at is null
    );

  if v_names is not null then
    raise exception 'OWNER_MUST_TRANSFER' using errcode = 'P0001', detail = v_names::text;
  end if;

  for v_household in
    select m.household_id
    from public.household_members m
    join public.households h on h.id = m.household_id
    where m.user_id = v_user and m.left_at is null and h.deleted_at is null
    -- By id, not by joining date: two people leaving the same households at once take the
    -- household locks in the same order and never deadlock.
    order by m.household_id
  loop
    begin
      perform private.leave_household_as(v_household, v_user);
    exception when sqlstate 'P0001' then
      -- Lost a race with a removal: already out, carry on with the delete. Someone who joined
      -- a household we lead in the meantime still stops it (OWNER_MUST_TRANSFER, no list).
      if sqlerrm <> 'NOT_A_MEMBER' then
        raise;
      end if;
    end;
  end loop;

  delete from auth.users where id = v_user;
end;
$$;
