begin;
select plan(13);

select tests.create_user('ana@test.dev', 'Ana') as ana \gset
select tests.create_user('bob@test.dev', 'Bob') as bob \gset
select tests.create_user('dora@test.dev', 'Dora') as dora \gset

-- Ana owns Casa (Bob is a member); Dora has no household.
insert into public.households (id, name, created_by)
values ('00000000-0000-0000-0000-0000000000a1', 'Casa', :'ana');
insert into public.household_members (household_id, user_id, role)
values
  ('00000000-0000-0000-0000-0000000000a1', :'ana', 'owner'),
  ('00000000-0000-0000-0000-0000000000a1', :'bob', 'member');

select is(
  (select rooms from public.households where id = '00000000-0000-0000-0000-0000000000a1'),
  array['kitchen', 'bathroom', 'living_room', 'bedroom', 'laundry', 'outdoor', 'other']::text[],
  'a new household has every room'
);

-- 1. set_household_rooms ---------------------------------------------------------------

select tests.authenticate_as(:'ana');
select public.set_household_rooms('{kitchen}');
select is(
  (select rooms from public.households where id = '00000000-0000-0000-0000-0000000000a1'),
  array['kitchen']::text[],
  'set_household_rooms saves the rooms'
);
select lives_ok(
  $$select public.set_household_rooms('{kitchen}')$$,
  'repeating the same rooms is a no-op'
);

select tests.authenticate_as(:'bob');
select public.set_household_rooms('{bathroom,kitchen}');
select is(
  (select rooms from public.households where id = '00000000-0000-0000-0000-0000000000a1'),
  array['bathroom', 'kitchen']::text[],
  'any member can set the rooms'
);

select throws_ok(
  $$select public.set_household_rooms('{garage}')$$,
  'P0001', 'INVALID_ROOM', 'an unknown room is rejected'
);
select throws_ok(
  $$select public.set_household_rooms('{}')$$,
  'P0001', 'INVALID_ROOM', 'an empty list is rejected'
);
select throws_ok(
  $$select public.set_household_rooms(null)$$,
  'P0001', 'INVALID_ROOM', 'a null list is rejected'
);
select throws_ok(
  $$select public.set_household_rooms('{kitchen,kitchen}')$$,
  'P0001', 'INVALID_ROOM', 'a repeated room is rejected'
);
select throws_ok(
  $$select public.set_household_rooms(array['kitchen', null])$$,
  'P0001', 'INVALID_ROOM', 'a null room is rejected'
);

-- 2. Non-members, sessions, constraints and grants -------------------------------------

select tests.authenticate_as(:'dora');
select throws_ok(
  $$select public.set_household_rooms('{kitchen}')$$,
  'P0001', 'NOT_A_MEMBER', 'a non-member cannot set rooms'
);

select tests.clear_auth();
select throws_ok(
  $$select public.set_household_rooms('{kitchen}')$$,
  'P0001', 'NOT_AUTHENTICATED', 'set_household_rooms needs a session'
);
select throws_ok(
  $$update public.households set rooms = '{garage}'
    where id = '00000000-0000-0000-0000-0000000000a1'$$,
  '23514', null, 'the household rooms are checked by the table'
);
select ok(
  not has_function_privilege('anon', 'public.set_household_rooms(text[])', 'execute'),
  'anon cannot execute set_household_rooms'
);

select * from finish();
rollback;
