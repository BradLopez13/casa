begin;
create extension if not exists pgtap with schema extensions;
select plan(10);

select tests.create_user('ana@test.dev', 'Ana') as ana \gset
select tests.create_user('bob@test.dev', 'Bob') as bob \gset
select tests.create_user('carla@test.dev', 'Carla') as carla \gset
select tests.create_user('dani@test.dev', 'Dani') as dani \gset

-- Fixture inserted as postgres: Ana (owner), Carla (member) and Dani (left) in
-- one household; Bob has none.
insert into public.households (id, name, created_by)
values ('00000000-0000-0000-0000-0000000000a1', 'Casa', :'ana');
insert into public.household_members (household_id, user_id, role, left_at)
values
  ('00000000-0000-0000-0000-0000000000a1', :'ana', 'owner', null),
  ('00000000-0000-0000-0000-0000000000a1', :'carla', 'member', null),
  ('00000000-0000-0000-0000-0000000000a1', :'dani', 'member', now());

select throws_ok(
  format($$insert into public.household_members (household_id, user_id, role)
    values ('00000000-0000-0000-0000-0000000000a1', %L, 'owner')$$, :'bob'),
  '23505',
  null,
  'two owners violate the unique index'
);

select throws_ok(
  format($$insert into public.household_members (household_id, user_id, role)
    values ('00000000-0000-0000-0000-0000000000a1', %L, 'member')$$, :'carla'),
  '23505',
  null,
  'one user cannot be in two households at once'
);

select tests.authenticate_as(:'ana');

select is(
  (select count(*) from public.households),
  1::bigint,
  'member sees own household'
);

select is(
  (select count(*) from public.household_members),
  2::bigint,
  'member sees active members only'
);

select is(
  (select count(*) from public.profiles where user_id = :'carla'),
  1::bigint,
  'member sees the profile of a housemate'
);

select is(
  (select count(*) from public.profiles where user_id = :'dani'),
  0::bigint,
  'member does not see the profile of someone who left'
);

select tests.authenticate_as(:'bob');

select is(
  (select count(*) from public.households)
    + (select count(*) from public.household_members)
    + (select count(*) from public.profiles where user_id = :'ana'),
  0::bigint,
  'non-member sees no household, members or profiles'
);

select throws_ok(
  format($$insert into public.household_members (household_id, user_id, role)
    values ('00000000-0000-0000-0000-0000000000a1', %L, 'member')$$, :'bob'),
  '42501',
  null,
  'client cannot insert members directly'
);

select throws_ok(
  $$insert into public.households (name) values ('Hack')$$,
  '42501',
  null,
  'client cannot insert households directly'
);

select tests.clear_auth();

update public.households set deleted_at = now();
select tests.authenticate_as(:'ana');

select is(
  (select count(*) from public.households)
    + (select count(*) from public.household_members),
  0::bigint,
  'a soft-deleted household and its members are hidden'
);

select tests.clear_auth();
select * from finish();
rollback;
