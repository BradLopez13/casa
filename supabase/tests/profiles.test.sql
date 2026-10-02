begin;
create extension if not exists pgtap with schema extensions;
select plan(5);

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

select tests.clear_auth();
select * from finish();
rollback;
