begin;
select plan(9);

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
select * from finish();
rollback;
