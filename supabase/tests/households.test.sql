begin;
select plan(24);

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

select throws_ok($$update public.households set name = 'x'$$, '42501', null, 'member cannot update households');
select throws_ok($$delete from public.households$$, '42501', null, 'member cannot delete households');
select throws_ok($$update public.household_members set role = 'owner'$$, '42501', null, 'member cannot update members');
select throws_ok($$delete from public.household_members$$, '42501', null, 'member cannot delete members');

select tests.authenticate_as(:'bob');

select is((select count(*) from public.households), 0::bigint, 'non-member sees no households');
select is((select count(*) from public.household_members), 0::bigint, 'non-member sees no members');
select is((select count(*) from public.profiles where user_id = :'ana'), 0::bigint, 'non-member sees no housemate profiles');

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
select tests.create_user('eva@test.dev', 'Eva') as eva \gset

select tests.authenticate_as(:'eva');

select public.create_household('  Casa  ') as hid \gset

select is(
  (select count(*) from public.households where id = :'hid' and name = 'Casa'),
  1::bigint,
  'create_household returns the id of the new, trimmed-name household'
);

select is(
  (select count(*) from public.household_members
    where user_id = :'eva' and role = 'owner' and household_id = :'hid'),
  1::bigint,
  'create_household makes the caller owner of the returned household'
);

select throws_ok(
  $$select public.create_household('   ')$$,
  'P0001',
  'INVALID_NAME',
  'blank name is rejected'
);

select throws_ok(
  $$select public.create_household(repeat('a', 61))$$,
  'P0001',
  'INVALID_NAME',
  '61-char name is rejected'
);

select throws_ok(
  $$select public.create_household('Otra')$$,
  'P0001',
  'ALREADY_IN_HOUSEHOLD',
  'second household is rejected'
);

select tests.clear_auth();

select throws_ok(
  $$select public.create_household('Casa')$$,
  'P0001',
  'NOT_AUTHENTICATED',
  'a call without session is rejected'
);

set local role anon;
select throws_ok(
  $$select public.create_household('Casa')$$,
  '42501',
  null,
  'anonymous call is rejected'
);
reset role;

select tests.clear_auth();
select tests.create_user('fran@test.dev', 'Fran') as fran \gset
insert into public.household_members (household_id, user_id, role)
values ('00000000-0000-0000-0000-0000000000a1', :'fran', 'member');
select tests.authenticate_as(:'fran');

select throws_ok(
  $$select public.create_household('Casa')$$,
  'P0001',
  'ALREADY_IN_HOUSEHOLD',
  'an existing active membership is reported as ALREADY_IN_HOUSEHOLD'
);

select tests.clear_auth();
select * from finish();
rollback;
