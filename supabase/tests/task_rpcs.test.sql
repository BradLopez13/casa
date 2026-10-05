begin;
select plan(13);

select tests.create_user('ana@test.dev', 'Ana') as ana \gset
select tests.create_user('bob@test.dev', 'Bob') as bob \gset
select tests.create_user('carla@test.dev', 'Carla') as carla \gset
select tests.create_user('dani@test.dev', 'Dani') as dani \gset
select tests.create_user('eva@test.dev', 'Eva') as eva \gset

-- Ana owns the household; Bob and Dani are members; Eva left; Carla is in another one.
insert into public.households (id, name, created_by)
values
  ('00000000-0000-0000-0000-0000000000a1', 'Casa', :'ana'),
  ('00000000-0000-0000-0000-0000000000a2', 'Otra', :'carla');
insert into public.household_members (household_id, user_id, role, left_at)
values
  ('00000000-0000-0000-0000-0000000000a1', :'ana', 'owner', null),
  ('00000000-0000-0000-0000-0000000000a1', :'bob', 'member', null),
  ('00000000-0000-0000-0000-0000000000a1', :'dani', 'member', null),
  ('00000000-0000-0000-0000-0000000000a1', :'eva', 'member', now()),
  ('00000000-0000-0000-0000-0000000000a2', :'carla', 'owner', null);

-- create_task -----------------------------------------------------------------

select tests.authenticate_as(:'bob');

select is(
  public.create_task('00000000-0000-0000-0000-0000000000d1', '00000000-0000-0000-0000-0000000000a1',
                     '  Fregar  ', 'kitchen', :'ana', '2026-10-10'),
  '00000000-0000-0000-0000-0000000000d1'::uuid,
  'create_task returns the given id'
);

select is(
  (select s.title || '|' || s.room || '|' || o.due_on || '|' || (o.assignee_id = :'ana')
   from public.task_occurrences o join public.task_series s on s.id = o.series_id
   where o.id = '00000000-0000-0000-0000-0000000000d1'),
  'Fregar|kitchen|2026-10-10|true',
  'create_task stores trimmed title, room, due date and assignee'
);

select is(
  public.create_task('00000000-0000-0000-0000-0000000000d1', '00000000-0000-0000-0000-0000000000a1',
                     '  Fregar  ', 'kitchen', :'ana', '2026-10-10'),
  '00000000-0000-0000-0000-0000000000d1'::uuid,
  'create_task with a repeated id returns the existing task'
);

select is(
  (select count(*) from public.task_occurrences where household_id = '00000000-0000-0000-0000-0000000000a1'),
  1::bigint,
  'a repeated create_task does not add another occurrence'
);

select lives_ok(
  $$select public.create_task('00000000-0000-0000-0000-0000000000d2', '00000000-0000-0000-0000-0000000000a1',
                              'Sin fecha', null, null, null)$$,
  'create_task without room, date or assignee'
);

select throws_ok(
  $$select public.create_task(gen_random_uuid(), '00000000-0000-0000-0000-0000000000a1', '   ', null, null, null)$$,
  'P0001', 'INVALID_TITLE', 'blank title is rejected'
);

select throws_ok(
  $$select public.create_task(gen_random_uuid(), '00000000-0000-0000-0000-0000000000a1', repeat('x', 101), null, null, null)$$,
  'P0001', 'INVALID_TITLE', '101-char title is rejected'
);

select throws_ok(
  $$select public.create_task(gen_random_uuid(), '00000000-0000-0000-0000-0000000000a1', 'x', 'garage', null, null)$$,
  'P0001', 'INVALID_ROOM', 'unknown room is rejected'
);

select throws_ok(
  format($$select public.create_task(gen_random_uuid(), '00000000-0000-0000-0000-0000000000a1', 'x', null, %L, null)$$, :'carla'),
  'P0001', 'INVALID_ASSIGNEE', 'assignee from another household is rejected'
);

select throws_ok(
  format($$select public.create_task(gen_random_uuid(), '00000000-0000-0000-0000-0000000000a1', 'x', null, %L, null)$$, :'eva'),
  'P0001', 'INVALID_ASSIGNEE', 'assignee who left is rejected'
);

select tests.authenticate_as(:'dani');

select throws_ok(
  $$select public.create_task('00000000-0000-0000-0000-0000000000d1', '00000000-0000-0000-0000-0000000000a1', 'x', null, null, null)$$,
  'P0001', 'TASK_NOT_FOUND', 'repeated id from another author looks like not found'
);

select tests.authenticate_as(:'carla');

select throws_ok(
  $$select public.create_task(gen_random_uuid(), '00000000-0000-0000-0000-0000000000a1', 'x', null, null, null)$$,
  'P0001', 'NOT_A_MEMBER', 'non-member cannot create'
);

select tests.clear_auth();
set local role anon;

select throws_ok(
  $$select public.create_task(gen_random_uuid(), '00000000-0000-0000-0000-0000000000a1', 'x', null, null, null)$$,
  '42501', null, 'anon cannot execute create_task'
);

reset role;
select * from finish();
rollback;
