-- What an invite link leads to, shown before accepting: the household's name, who sent it and
-- how many people live there. Only the holder of the token learns anything: an unknown, revoked,
-- used or dead invite gives the same INVITE_INVALID as accept_invite, and an expired one
-- INVITE_EXPIRED. Read-only: it locks and changes nothing, so the invite stays usable.
create or replace function public.preview_invite(p_token text)
returns table (household_name text, inviter_name text, member_count int)
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
     where m.household_id = v_invite.household_id and m.left_at is null);
end;
$$;

revoke execute on function public.preview_invite(text) from public, anon;
grant execute on function public.preview_invite(text) to authenticated;
