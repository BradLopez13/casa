-- Local-only test helpers. `supabase db push` never runs this file.
create schema if not exists tests;
grant usage on schema tests to authenticated;

create or replace function tests.create_user(p_email text, p_name text)
returns uuid
language plpgsql
as $$
declare
  v_id uuid := gen_random_uuid();
begin
  insert into auth.users (
    id, instance_id, aud, role, email, raw_user_meta_data, created_at, updated_at
  ) values (
    v_id,
    '00000000-0000-0000-0000-000000000000',
    'authenticated',
    'authenticated',
    p_email,
    jsonb_build_object('display_name', p_name),
    now(),
    now()
  );
  return v_id;
end;
$$;

create or replace function tests.authenticate_as(p_user uuid)
returns void
language plpgsql
as $$
begin
  perform set_config(
    'request.jwt.claims',
    jsonb_build_object('sub', p_user, 'role', 'authenticated')::text,
    true
  );
  set local role authenticated;
end;
$$;

create or replace function tests.clear_auth()
returns void
language plpgsql
as $$
begin
  perform set_config('request.jwt.claims', '', true);
  reset role;
end;
$$;

grant execute on all functions in schema tests to authenticated;
