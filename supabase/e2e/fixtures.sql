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
--   uma@e2e.dev   = Uma, owner of "Piso Uma" (undo)
--   vera@e2e.dev  = Vera, owner of "Piso Vera" (tasks-offline)
--   wanda@e2e.dev = Wanda, owner of "Piso Wanda", with Xavi (xavi@e2e.dev) (leave-household)
--   yago@e2e.dev  = Yago, owner of "Piso Yago" (quantity)
--   hugo@e2e.dev  = Hugo, owner of "Piso Hugo" (help)
--   gala@e2e.dev  = Gala, owner of "Piso Gala" (queue-cycles)
--   fede@e2e.dev  = Fede, owner of "Piso Fede" (door-after-notice)
--   zoe@e2e.dev   = Zoe, owner of "Piso Zoe" (several-households: creates a second household,
--                   switches, invites, sees its licence and joins Yoli's with JOIN_TOKEN)
--   yoli@e2e.dev  = Yoli, owner of "Piso Yoli" (several-households)
--   demo@e2e.dev  = Demo, owner of "Casa de ejemplo" with Mar (mar@e2e.dev), tasks and shopping
--                   already in it (e2e/store/screenshots.yaml, the store listing's screenshots)
-- Each flow that is not about sign-up signs in as its own user, so the flows never share state.
-- The sign-up path itself stays covered by sign-up-create-household, forgot-password and
-- invite-link-signed-out.
--
-- Tokens (48 hex, the app only stores their sha256):
--   VALID_TOKEN    = a1 x 24
--   EXPIRED_TOKEN  = b2 x 24 (expired)
--   DEEPLINK_TOKEN = c3 x 24
--   JOIN_TOKEN     = d4 x 24 (to "Piso Yoli", for Zoe, who already has a household)

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
  v_wanda uuid := pg_temp.e2e_user('wanda@e2e.dev', 'Wanda');
  v_token text;
begin
  insert into public.household_members (household_id, user_id, role)
  values
    (v_household, v_berta, 'member'),
    (pg_temp.e2e_household(v_quique, 'Piso Quique'), pg_temp.e2e_user('quim@e2e.dev', 'Quim'), 'member'),
    (pg_temp.e2e_household(v_tania, 'Piso Tania'), pg_temp.e2e_user('toni@e2e.dev', 'Toni'), 'member'),
    (pg_temp.e2e_household(v_wanda, 'Piso Wanda'), pg_temp.e2e_user('xavi@e2e.dev', 'Xavi'), 'member');

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
  perform pg_temp.e2e_household(pg_temp.e2e_user('uma@e2e.dev', 'Uma'), 'Piso Uma');
  perform pg_temp.e2e_household(pg_temp.e2e_user('vera@e2e.dev', 'Vera'), 'Piso Vera');
  perform pg_temp.e2e_household(pg_temp.e2e_user('yago@e2e.dev', 'Yago'), 'Piso Yago');
  perform pg_temp.e2e_household(pg_temp.e2e_user('hugo@e2e.dev', 'Hugo'), 'Piso Hugo');
  perform pg_temp.e2e_household(pg_temp.e2e_user('gala@e2e.dev', 'Gala'), 'Piso Gala');
  perform pg_temp.e2e_household(pg_temp.e2e_user('fede@e2e.dev', 'Fede'), 'Piso Fede');
  perform pg_temp.e2e_household(pg_temp.e2e_user('zoe@e2e.dev', 'Zoe'), 'Piso Zoe');
  -- The store listing's account (bloque 15.5): a home with something on every screen.
  declare
    v_demo uuid := pg_temp.e2e_user('demo@e2e.dev', 'Demo');
    v_mar uuid := pg_temp.e2e_user('mar@e2e.dev', 'Mar');
    v_casa uuid := pg_temp.e2e_household(v_demo, 'Casa de ejemplo');
    v_series uuid;
    v_task record;
  begin
    insert into public.household_members (household_id, user_id, role)
    values (v_casa, v_mar, 'member');
    for v_task in
      select * from (values
        ('Regar las plantas', 'living_room', v_demo, current_date, null::timestamptz),
        ('Sacar la basura', 'kitchen', v_demo, current_date, null),
        ('Poner la lavadora', 'bathroom', v_mar, current_date, null),
        ('Cambiar las sábanas', 'bedroom', v_demo, current_date - 2, null),
        ('Pasar la aspiradora', 'living_room', v_mar, current_date + 1, null),
        ('Fregar los platos', 'kitchen', v_demo, current_date, now() - interval '2 hours'),
        ('Limpiar el baño', 'bathroom', v_mar, current_date, now() - interval '1 hour')
      ) as t(title, room, assignee, due_on, completed_at)
    loop
      insert into public.task_series (household_id, title, room, created_by)
      values (v_casa, v_task.title, v_task.room, v_demo)
      returning id into v_series;
      insert into public.task_occurrences
        (series_id, household_id, due_on, assignee_id, completed_at, completed_by)
      values (
        v_series, v_casa, v_task.due_on, v_task.assignee, v_task.completed_at,
        case when v_task.completed_at is null then null else v_task.assignee end
      );
    end loop;
    insert into public.shopping_items (id, household_id, name, quantity, created_by, bought_at, bought_by)
    values
      (gen_random_uuid(), v_casa, 'Leche', '2', v_demo, null, null),
      (gen_random_uuid(), v_casa, 'Pan', null, v_mar, null, null),
      (gen_random_uuid(), v_casa, 'Tomates', '1 kg', v_demo, null, null),
      (gen_random_uuid(), v_casa, 'Huevos', '12', v_mar, null, null),
      (gen_random_uuid(), v_casa, 'Café', null, v_demo, now() - interval '3 days', v_demo),
      (gen_random_uuid(), v_casa, 'Arroz', null, v_mar, now() - interval '3 days', v_mar);
  end;
  declare
    v_yoli uuid := pg_temp.e2e_user('yoli@e2e.dev', 'Yoli');
  begin
    insert into public.household_invites (household_id, token_hash, created_by, expires_at)
    values (
      pg_temp.e2e_household(v_yoli, 'Piso Yoli'),
      encode(extensions.digest(repeat('d4', 24), 'sha256'), 'hex'),
      v_yoli,
      now() + interval '30 days'
    );
  end;
end
$$;
