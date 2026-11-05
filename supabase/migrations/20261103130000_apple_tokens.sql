-- Bloque 15.4: the refresh token Sign in with Apple hands out at sign-in, kept so that deleting
-- the account can revoke it (App Review asks for it since 2022). Only the revoke-apple Edge
-- Function touches it, as the service role, through these three RPCs; no other role may read,
-- call or see the table. The row goes with the account.

create table private.apple_tokens (
  user_id uuid primary key references auth.users (id) on delete cascade,
  refresh_token text not null,
  updated_at timestamptz not null default now()
);

revoke all on table private.apple_tokens from public, anon, authenticated;

create function public.apple_token_save(p_user_id uuid, p_token text)
returns void
language sql
security definer
set search_path = ''
as $$
  insert into private.apple_tokens (user_id, refresh_token, updated_at)
  values (p_user_id, p_token, now())
  on conflict (user_id) do update
    set refresh_token = excluded.refresh_token, updated_at = now();
$$;

create function public.apple_token_load(p_user_id uuid)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select t.refresh_token from private.apple_tokens t where t.user_id = p_user_id;
$$;

create function public.apple_token_forget(p_user_id uuid)
returns void
language sql
security definer
set search_path = ''
as $$
  delete from private.apple_tokens where user_id = p_user_id;
$$;

revoke execute on function public.apple_token_save(uuid, text) from public, anon, authenticated;
revoke execute on function public.apple_token_load(uuid) from public, anon, authenticated;
revoke execute on function public.apple_token_forget(uuid) from public, anon, authenticated;
grant execute on function public.apple_token_save(uuid, text) to service_role;
grant execute on function public.apple_token_load(uuid) to service_role;
grant execute on function public.apple_token_forget(uuid) to service_role;
