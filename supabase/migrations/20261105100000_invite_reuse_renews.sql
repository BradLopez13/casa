-- Revisión del PR #67 (bloque 15.2):
--
-- (1) The tokens kept to hand an invitation out again are encrypted, never in the clear (decisión
--     de Brad, 5 de noviembre de 2026): a dump of private.invite_tokens gave links valid for seven
--     days. The key lives in Vault (`invite_token_key`); only the security definer functions read
--     it (`private.invite_token_key`, closed to every role of the API). The rows already there
--     are encrypted in place, so the links already shared keep working.
-- (2) An invitation reused by «Invitar» or «Copiar invitación» lasts seven days again from now,
--     with the same token. Reused with the time it had left, one with an hour to go was shared and
--     died within the hour, the silent dead link of P2-3.

-- (1) ------------------------------------------------------------------------------------

do $$
begin
  if not exists (select 1 from vault.secrets where name = 'invite_token_key') then
    perform vault.create_secret(
      encode(extensions.gen_random_bytes(32), 'hex'),
      'invite_token_key',
      'Encrypts the invitation tokens kept to hand them out again (bloque 15.2)'
    );
  end if;
end;
$$;

create function private.invite_token_key()
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select s.decrypted_secret from vault.decrypted_secrets s where s.name = 'invite_token_key';
$$;

revoke execute on function private.invite_token_key() from public, anon, authenticated;

alter table private.invite_tokens add column token_enc bytea;

update private.invite_tokens
set token_enc = extensions.pgp_sym_encrypt(token, private.invite_token_key());

alter table private.invite_tokens alter column token_enc set not null;
alter table private.invite_tokens drop column token;

-- (2) ------------------------------------------------------------------------------------

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
  select i.id, extensions.pgp_sym_decrypt(t.token_enc, private.invite_token_key()), i.expires_at
  into v_id, v_token, v_expires
  from public.household_invites i
  join private.invite_tokens t on t.invite_id = i.id
  where i.household_id = p_household_id
    and i.accepted_at is null
    and i.revoked_at is null
    and i.expires_at > now()
  order by i.expires_at desc
  limit 1;

  if found then
    -- Shared again, it lasts seven days again from now: reused with what it had left, one with an
    -- hour to go died within the hour (revisión del PR #67). Same token, same invitation.
    v_expires := now() + interval '7 days';
    update public.household_invites i set expires_at = v_expires where i.id = v_id;
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

  insert into private.invite_tokens (invite_id, token_enc)
  values (v_id, extensions.pgp_sym_encrypt(v_token, private.invite_token_key()));

  return query select v_id, v_token, v_expires;
end;
$function$;
