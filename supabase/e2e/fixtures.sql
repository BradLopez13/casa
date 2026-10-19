-- E2E fixtures for the Maestro flows. Not a migration and not the seed: run it after
-- `pnpm db:reset` with `pnpm e2e:fixtures`. Invites are single use, so reset before each run.
-- It fails loudly (ON_ERROR_STOP) if applied twice.
--
-- Users (password e2e-password-2026, email already verified):
--   ana@e2e.dev   = Ana, owner of "Casa E2E"
--   berta@e2e.dev = Berta, member of "Casa E2E" (e2e/scripts/berta-adds-bread.js signs in as her)
--   bob@e2e.dev   = Bob, no household (join-with-invite)
--   iris@e2e.dev  = Iris, no household (delete-account-onboarding)
--   ines@e2e.dev  = Ines, owner of "Piso Ines" (delete-account)
--   leo@e2e.dev   = Leo, owner of "Piso Leo" (create-complete-task)
--   nora@e2e.dev  = Nora, owner of "Piso Nora" (notification-settings)
--   olga@e2e.dev  = Olga, owner of "Piso Olga" (shopping-offline)
--   pablo@e2e.dev = Pablo, owner of "Piso Pablo" (templates)
--   quique@e2e.dev = Quique, owner of "Piso Quique", with Quim (quim@e2e.dev) (members-remove)
--   rita@e2e.dev  = Rita, owner of "Piso Rita" (recurring-task)
--   rosa@e2e.dev  = Rosa, owner of "Piso Rosa" (rotate)
--   sara@e2e.dev  = Sara, owner of "Piso Sara" (shopping)
--   tania@e2e.dev = Tania, owner of "Piso Tania", with Toni (toni@e2e.dev) (members-transfer)
--   tere@e2e.dev  = Tere, owner of "Piso Tere" (task-edit-skip-delete)
-- Each flow that is not about sign-up signs in as its own user, so the flows never share state.
-- The sign-up path itself stays covered by sign-up-create-household, forgot-password and
-- invite-link-signed-out.
--
-- Tokens (48 hex, the app only stores their sha256):
--   VALID_TOKEN    = a1 x 24
--   EXPIRED_TOKEN  = b2 x 24 (expired)
--   DEEPLINK_TOKEN = c3 x 24

-- A user GoTrue can sign in: password hash, confirmed email, email identity and the token
-- columns GoTrue scans as non-null strings. The profile comes from the handle_new_user trigger.
create function pg_temp.e2e_user(p_email text, p_name text)
returns uuid
language plpgsql
as $$
declare
  v_id uuid := gen_random_uuid();
begin
  insert into auth.users (
    id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
    raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
    confirmation_token, recovery_token, email_change_token_new, email_change,
    email_change_token_current, phone_change, phone_change_token, reauthentication_token
  ) values (
    v_id,
    '00000000-0000-0000-0000-000000000000',
    'authenticated',
    'authenticated',
    p_email,
    extensions.crypt('e2e-password-2026', extensions.gen_salt('bf')),
    now(),
    '{"provider":"email","providers":["email"]}',
    jsonb_build_object('display_name', p_name),
    now(),
    now(),
    '', '', '', '', '', '', '', ''
  );

  insert into auth.identities (
    id, user_id, provider, provider_id, identity_data, created_at, updated_at, last_sign_in_at
  ) values (
    gen_random_uuid(),
    v_id,
    'email',
    v_id::text,
    jsonb_build_object('sub', v_id::text, 'email', p_email, 'email_verified', true),
    now(),
    now(),
    now()
  );

  return v_id;
end;
$$;

-- A household owned by p_owner, as create_household leaves it.
create function pg_temp.e2e_household(p_owner uuid, p_name text)
returns uuid
language plpgsql
as $$
declare
  v_id uuid;
begin
  insert into public.households (name, created_by) values (p_name, p_owner) returning id into v_id;
  insert into public.household_members (household_id, user_id, role)
  values (v_id, p_owner, 'owner');
  return v_id;
end;
$$;

do $$
declare
  v_ana uuid := pg_temp.e2e_user('ana@e2e.dev', 'Ana');
  v_berta uuid := pg_temp.e2e_user('berta@e2e.dev', 'Berta');
  v_household uuid := pg_temp.e2e_household(v_ana, 'Casa E2E');
  v_quique uuid := pg_temp.e2e_user('quique@e2e.dev', 'Quique');
  v_tania uuid := pg_temp.e2e_user('tania@e2e.dev', 'Tania');
  v_token text;
begin
  insert into public.household_members (household_id, user_id, role)
  values
    (v_household, v_berta, 'member'),
    (pg_temp.e2e_household(v_quique, 'Piso Quique'), pg_temp.e2e_user('quim@e2e.dev', 'Quim'), 'member'),
    (pg_temp.e2e_household(v_tania, 'Piso Tania'), pg_temp.e2e_user('toni@e2e.dev', 'Toni'), 'member');

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

  perform pg_temp.e2e_user('bob@e2e.dev', 'Bob');
  perform pg_temp.e2e_user('iris@e2e.dev', 'Iris');
  perform pg_temp.e2e_household(pg_temp.e2e_user('ines@e2e.dev', 'Ines'), 'Piso Ines');
  perform pg_temp.e2e_household(pg_temp.e2e_user('leo@e2e.dev', 'Leo'), 'Piso Leo');
  perform pg_temp.e2e_household(pg_temp.e2e_user('olga@e2e.dev', 'Olga'), 'Piso Olga');
  perform pg_temp.e2e_household(pg_temp.e2e_user('rita@e2e.dev', 'Rita'), 'Piso Rita');
  perform pg_temp.e2e_household(pg_temp.e2e_user('rosa@e2e.dev', 'Rosa'), 'Piso Rosa');
  perform pg_temp.e2e_household(pg_temp.e2e_user('sara@e2e.dev', 'Sara'), 'Piso Sara');
  perform pg_temp.e2e_household(pg_temp.e2e_user('nora@e2e.dev', 'Nora'), 'Piso Nora');
  perform pg_temp.e2e_household(pg_temp.e2e_user('tere@e2e.dev', 'Tere'), 'Piso Tere');
  perform pg_temp.e2e_household(pg_temp.e2e_user('pablo@e2e.dev', 'Pablo'), 'Piso Pablo');
end
$$;
