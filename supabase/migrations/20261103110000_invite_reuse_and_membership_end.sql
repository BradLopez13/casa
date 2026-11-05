-- Bloque 15.2: what others do is said.
--
-- (1) A pending invitation is reused (decisión 2 de Brad, A): «Copiar invitación» and a second
--     «Invitar» hand out the same link, so the one already in WhatsApp keeps working until it is
--     used, revoked or expired (crítica del 2 de noviembre, P2-3: create_invite revoked it).
--     The plain token only ever lived in the response; to hand it out again it is kept in a
--     private table no role can read through the API, and removed as soon as the invitation is
--     accepted or revoked.
-- (2) A membership that ends keeps who ended it (left_by): the phone that lost the household
--     can say «te han quitado» or «has salido desde otro móvil» (membership_end).

-- (1) ------------------------------------------------------------------------------------

create table private.invite_tokens (
  invite_id uuid primary key references public.household_invites (id) on delete cascade,
  token text not null
);

revoke all on table private.invite_tokens from public, anon, authenticated;

-- An invitation that is accepted or revoked has no token to hand out any more.
create function private.forget_invite_token()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.accepted_at is not null or new.revoked_at is not null then
    delete from private.invite_tokens where invite_id = new.id;
  end if;
  return new;
end;
$$;

revoke execute on function private.forget_invite_token() from public, anon, authenticated;

create trigger household_invites_forget_token
after update of accepted_at, revoked_at on public.household_invites
for each row execute function private.forget_invite_token();

create or replace function public.create_invite(p_household_id uuid)
 RETURNS TABLE(invite_id uuid, token text, expires_at timestamp with time zone)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
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

  -- Bloque 12: writing needs the household's licence (always true while billing is off).
  perform private.assert_household_licensed(p_household_id);

  -- 1) household row (exclusive), 2) invite rows.
  perform 1
  from public.households h
  where h.id = p_household_id and h.deleted_at is null
  for update;

  if not found then
    raise exception 'NOT_A_MEMBER' using errcode = 'P0001';
  end if;

  -- The pending invitation still valid, with its token kept: the same link again (bloque 15.2).
  select i.id, t.token, i.expires_at into v_id, v_token, v_expires
  from public.household_invites i
  join private.invite_tokens t on t.invite_id = i.id
  where i.household_id = p_household_id
    and i.accepted_at is null
    and i.revoked_at is null
    and i.expires_at > now()
  order by i.expires_at desc
  limit 1;

  if found then
    return query select v_id, v_token, v_expires;
    return;
  end if;

  -- None valid: whatever is left open (expired, or from before the tokens were kept) goes, and a
  -- new one is made.
  update public.household_invites i
  set revoked_at = now()
  where i.household_id = p_household_id
    and i.accepted_at is null
    and i.revoked_at is null;

  v_token := encode(extensions.gen_random_bytes(24), 'hex');
  v_expires := now() + interval '7 days';

  insert into public.household_invites (household_id, token_hash, created_by, expires_at)
  values (
    p_household_id,
    encode(extensions.digest(v_token, 'sha256'), 'hex'),
    v_user,
    v_expires
  )
  returning id into v_id;

  insert into private.invite_tokens (invite_id, token) values (v_id, v_token);

  return query select v_id, v_token, v_expires;
end;
$function$;

-- (2) ------------------------------------------------------------------------------------

alter table public.household_members
  add column left_by uuid references auth.users (id) on delete set null;

-- leave_household_as: the person leaves on their own (left_by = themselves).
create or replace function private.leave_household_as(p_household_id uuid, p_user uuid)
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
  set left_at = now(), left_by = p_user
  where household_id = p_household_id and user_id = p_user and left_at is null;
end;
$$;

-- remove_member: the owner ends it (left_by = the owner).
create or replace function public.remove_member(p_household_id uuid, p_user_id uuid)
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
  set left_at = now(), left_by = v_user
  where household_id = p_household_id
    and user_id = p_user_id
    and left_at is null;

  if not found then
    raise exception 'NOT_A_MEMBER' using errcode = 'P0001';
  end if;
end;
$$;

-- membership_end: why the caller is no longer in a household, for the phone that just lost it:
-- 'deleted' (the household was deleted, by whoever), 'removed' (the owner took them out),
-- 'left' (they left, from another phone), or null while they are still in it or never were.
create function public.membership_end(p_household_id uuid)
returns text
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_user uuid := (select auth.uid());
  v_member public.household_members;
begin
  if v_user is null then
    raise exception 'NOT_AUTHENTICATED' using errcode = 'P0001';
  end if;

  select m.* into v_member
  from public.household_members m
  where m.household_id = p_household_id and m.user_id = v_user
  order by m.left_at desc nulls first
  limit 1;

  if not found then
    return null;
  end if;

  if exists (
    select 1 from public.households h
    where h.id = p_household_id and h.deleted_at is not null
  ) then
    return 'deleted';
  end if;

  if v_member.left_at is null then
    return null;
  end if;

  return case when v_member.left_by = v_user then 'left' else 'removed' end;
end;
$$;

revoke execute on function public.membership_end(uuid) from public, anon;
grant execute on function public.membership_end(uuid) to authenticated;
