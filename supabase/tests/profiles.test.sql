begin;
select plan(20);

select tests.create_user('ana@test.dev', 'Ana') as ana \gset
select tests.create_user('bob@test.dev', '') as bob \gset

select is(
  (select display_name from public.profiles where user_id = :'ana'),
  'Ana',
  'creating a user creates its profile'
);

select is(
  (select display_name from public.profiles where user_id = :'bob'),
  'bob',
  'display name falls back to email local part'
);

select tests.authenticate_as(:'ana');

select is(
  (select count(*) from public.profiles),
  1::bigint,
  'user reads own profile'
);

select is(
  (select count(*) from public.profiles where user_id = :'bob'),
  0::bigint,
  'user cannot read a stranger profile'
);

with u as (
  update public.profiles set display_name = 'x' where user_id = :'bob' returning 1
)
select is(
  (select count(*) from u),
  0::bigint,
  'user cannot change another user''s profile'
);

select throws_ok(
  format($$insert into public.profiles (user_id, display_name) values (%L, 'x')$$, gen_random_uuid()),
  '42501',
  null,
  'user cannot insert profiles directly'
);

select throws_ok(
  format($$delete from public.profiles where user_id = %L$$, :'ana'),
  '42501',
  null,
  'user cannot delete profiles'
);

select throws_ok(
  format($$update public.profiles set user_id = gen_random_uuid() where user_id = %L$$, :'ana'),
  '42501',
  null,
  'user cannot change own user_id'
);

with u as (
  update public.profiles set display_name = 'Ana B' where user_id = :'ana' returning 1
)
select is(
  (select count(*) from u),
  1::bigint,
  'user can update own display name'
);

select tests.clear_auth();
-- Provider metadata (Google / Apple) name chain.
create function pg_temp.mk_user(p_email text, p_meta jsonb)
returns uuid
language plpgsql
as $f$
declare
  v_id uuid := gen_random_uuid();
begin
  insert into auth.users (
    id, instance_id, aud, role, email, raw_user_meta_data, created_at, updated_at
  ) values (
    v_id, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
    p_email, p_meta, now(), now()
  );
  return v_id;
end;
$f$;

select pg_temp.mk_user('g1@test.dev', '{"full_name":"Ana Ruiz"}'::jsonb) as g1 \gset
select pg_temp.mk_user('g2@test.dev', '{"name":"Leo"}'::jsonb) as g2 \gset
select pg_temp.mk_user('g3@test.dev', '{"display_name":"  ","full_name":"Eva"}'::jsonb) as g3 \gset
select pg_temp.mk_user('zoe@x.dev', '{}'::jsonb) as zoe \gset
select pg_temp.mk_user('g5@test.dev', jsonb_build_object('full_name', repeat('x', 50))) as g5 \gset

select is((select display_name from public.profiles where user_id = :'g1'), 'Ana Ruiz', 'full_name is used');
select is((select display_name from public.profiles where user_id = :'g2'), 'Leo', 'name is used');
select is((select display_name from public.profiles where user_id = :'g3'), 'Eva', 'blank display_name falls through to full_name');
select is((select display_name from public.profiles where user_id = :'zoe'), 'zoe', 'no metadata falls back to email local part');
select is((select char_length(display_name) from public.profiles where user_id = :'g5'), 40, 'long full_name is cut to 40');

select tests.authenticate_as(:'zoe');
select public.set_provider_display_name('Ana Apple');
select is((select display_name from public.profiles where user_id = :'zoe'), 'Ana Apple', 'set_provider_display_name replaces the email-derived name');

select public.set_provider_display_name('Otro');
select is((select display_name from public.profiles where user_id = :'zoe'), 'Ana Apple', 'a later call does not overwrite it');

select throws_ok($$select public.set_provider_display_name('')$$, 'P0001', 'INVALID_NAME', 'empty name rejected');
select throws_ok(format($$select public.set_provider_display_name(%L)$$, repeat('x', 41)), 'P0001', 'INVALID_NAME', '41 characters rejected');

select tests.clear_auth();
select throws_ok($$select public.set_provider_display_name('X')$$, 'P0001', 'NOT_AUTHENTICATED', 'no session rejected');
select ok(
  not has_function_privilege('anon', 'public.set_provider_display_name(text)', 'execute'),
  'anon cannot execute set_provider_display_name'
);

select * from finish();
rollback;
