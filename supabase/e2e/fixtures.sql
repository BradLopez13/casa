-- E2E fixtures for the Maestro flows. Not a migration and not the seed: run it after
-- `pnpm db:reset` with `pnpm e2e:fixtures`. Invites are single use, so reset before each run.
-- It fails loudly (ON_ERROR_STOP) if applied twice.
--
-- Users (password e2e-password-2026):
--   ana@e2e.dev   = Ana, owner of "Casa E2E"
--   berta@e2e.dev = Berta, member of "Casa E2E" (e2e/scripts/berta-adds-bread.js signs in as her)
--
-- Tokens (48 hex, the app only stores their sha256):
--   VALID_TOKEN    = a1 x 24
--   EXPIRED_TOKEN  = b2 x 24 (expired)
--   DEEPLINK_TOKEN = c3 x 24

do $$
declare
  v_ana uuid := gen_random_uuid();
  v_berta uuid := gen_random_uuid();
  v_household uuid := gen_random_uuid();
  v_token text;
begin
  -- Ana can sign in through GoTrue: password hash, confirmed email, email identity and the
  -- token columns GoTrue scans as non-null strings.
  insert into auth.users (
    id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
    raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
    confirmation_token, recovery_token, email_change_token_new, email_change,
    email_change_token_current, phone_change, phone_change_token, reauthentication_token
  ) values (
    v_ana,
    '00000000-0000-0000-0000-000000000000',
    'authenticated',
    'authenticated',
    'ana@e2e.dev',
    extensions.crypt('e2e-password-2026', extensions.gen_salt('bf')),
    now(),
    '{"provider":"email","providers":["email"]}',
    '{"display_name":"Ana"}',
    now(),
    now(),
    '', '', '', '', '', '', '', ''
  );

  insert into auth.identities (
    id, user_id, provider, provider_id, identity_data, created_at, updated_at, last_sign_in_at
  ) values (
    gen_random_uuid(),
    v_ana,
    'email',
    v_ana::text,
    jsonb_build_object('sub', v_ana::text, 'email', 'ana@e2e.dev', 'email_verified', true),
    now(),
    now(),
    now()
  );

  -- Berta, created the same way.
  insert into auth.users (
    id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
    raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
    confirmation_token, recovery_token, email_change_token_new, email_change,
    email_change_token_current, phone_change, phone_change_token, reauthentication_token
  ) values (
    v_berta,
    '00000000-0000-0000-0000-000000000000',
    'authenticated',
    'authenticated',
    'berta@e2e.dev',
    extensions.crypt('e2e-password-2026', extensions.gen_salt('bf')),
    now(),
    '{"provider":"email","providers":["email"]}',
    '{"display_name":"Berta"}',
    now(),
    now(),
    '', '', '', '', '', '', '', ''
  );

  insert into auth.identities (
    id, user_id, provider, provider_id, identity_data, created_at, updated_at, last_sign_in_at
  ) values (
    gen_random_uuid(),
    v_berta,
    'email',
    v_berta::text,
    jsonb_build_object('sub', v_berta::text, 'email', 'berta@e2e.dev', 'email_verified', true),
    now(),
    now(),
    now()
  );

  -- The profiles come from the handle_new_user trigger.
  insert into public.households (id, name, created_by) values (v_household, 'Casa E2E', v_ana);
  insert into public.household_members (household_id, user_id, role)
  values (v_household, v_ana, 'owner'), (v_household, v_berta, 'member');

  foreach v_token in array array[repeat('a1', 24), repeat('b2', 24), repeat('c3', 24)] loop
    insert into public.household_invites (household_id, token_hash, created_by, expires_at)
    values (
      v_household,
      encode(extensions.digest(v_token, 'sha256'), 'hex'),
      v_ana,
      case when v_token = repeat('b2', 24) then now() - interval '1 day'
           else now() + interval '30 days' end
    );
  end loop;
end
$$;
