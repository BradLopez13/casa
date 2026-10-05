begin;
select plan(16);

select tests.create_user('ana@test.dev', 'Ana') as ana \gset
select tests.create_user('bob@test.dev', 'Bob') as bob \gset
select tests.create_user('carla@test.dev', 'Carla') as carla \gset
select tests.create_user('dani@test.dev', 'Dani') as dani \gset
select tests.create_user('fay@test.dev', 'Fay') as fay \gset
select tests.create_user('gus@test.dev', 'Gus') as gus \gset

-- Ana owns the household; Bob, Dani and Fay are members; Carla and Gus are in others.
-- The third household is soft-deleted.
insert into public.households (id, name, created_by, deleted_at)
values
  ('00000000-0000-0000-0000-0000000000a1', 'Casa', :'ana', null),
  ('00000000-0000-0000-0000-0000000000a2', 'Otra', :'carla', null),
  ('00000000-0000-0000-0000-0000000000a3', 'Borrada', :'gus', now());
insert into public.household_members (household_id, user_id, role)
values
  ('00000000-0000-0000-0000-0000000000a1', :'ana', 'owner'),
  ('00000000-0000-0000-0000-0000000000a1', :'bob', 'member'),
  ('00000000-0000-0000-0000-0000000000a1', :'dani', 'member'),
  ('00000000-0000-0000-0000-0000000000a1', :'fay', 'member'),
  ('00000000-0000-0000-0000-0000000000a2', :'carla', 'owner'),
  ('00000000-0000-0000-0000-0000000000a3', :'gus', 'owner');

insert into public.task_series (id, household_id, title, created_by)
values
  ('00000000-0000-0000-0000-0000000000e1', '00000000-0000-0000-0000-0000000000a1', 'Fregar', :'ana'),
  ('00000000-0000-0000-0000-0000000000e2', '00000000-0000-0000-0000-0000000000a1', 'De Fay', :'ana'),
  ('00000000-0000-0000-0000-0000000000e3', '00000000-0000-0000-0000-0000000000a1', 'De Bob', :'ana'),
  ('00000000-0000-0000-0000-0000000000e4', '00000000-0000-0000-0000-0000000000a3', 'Vieja', :'gus');
insert into public.task_occurrences (id, series_id, household_id, assignee_id)
values
  ('00000000-0000-0000-0000-0000000000f1', '00000000-0000-0000-0000-0000000000e1', '00000000-0000-0000-0000-0000000000a1', null),
  ('00000000-0000-0000-0000-0000000000f2', '00000000-0000-0000-0000-0000000000e2', '00000000-0000-0000-0000-0000000000a1', :'fay'),
  ('00000000-0000-0000-0000-0000000000f3', '00000000-0000-0000-0000-0000000000e3', '00000000-0000-0000-0000-0000000000a1', :'bob'),
  ('00000000-0000-0000-0000-0000000000f4', '00000000-0000-0000-0000-0000000000e4', '00000000-0000-0000-0000-0000000000a3', null);

-- complete_task ---------------------------------------------------------------

select tests.authenticate_as(:'bob');
select public.complete_task('00000000-0000-0000-0000-0000000000f1');

select is(
  (select (completed_at is not null) || '|' || (completed_by = :'bob')
   from public.task_occurrences where id = '00000000-0000-0000-0000-0000000000f1'),
  'true|true',
  'member completes a task'
);

select tests.authenticate_as(:'dani');

select lives_ok(
  $$select public.complete_task('00000000-0000-0000-0000-0000000000f1')$$,
  'completing an already completed task does not fail'
);

select is(
  (select completed_by from public.task_occurrences where id = '00000000-0000-0000-0000-0000000000f1'),
  :'bob'::uuid,
  'completing an already completed task keeps the first completer'
);

-- reopen_task -----------------------------------------------------------------

select lives_ok(
  $$select public.reopen_task('00000000-0000-0000-0000-0000000000f1')$$,
  'any member can reopen'
);

select is(
  (select completed_at is null and completed_by is null
   from public.task_occurrences where id = '00000000-0000-0000-0000-0000000000f1'),
  true,
  'reopening clears completed_at and completed_by'
);

select lives_ok(
  $$select public.reopen_task('00000000-0000-0000-0000-0000000000f1')$$,
  'reopening an open task does not fail'
);

select is(
  (select completed_at is null and completed_by is null
   from public.task_occurrences where id = '00000000-0000-0000-0000-0000000000f1'),
  true,
  'reopening an open task is a no-op'
);

-- Not a member / deleted household --------------------------------------------

select tests.authenticate_as(:'carla');

select throws_ok(
  $$select public.complete_task('00000000-0000-0000-0000-0000000000f1')$$,
  'P0001', 'TASK_NOT_FOUND', 'non-member completion looks like not found'
);

select throws_ok(
  $$select public.reopen_task('00000000-0000-0000-0000-0000000000f1')$$,
  'P0001', 'TASK_NOT_FOUND', 'non-member reopen looks like not found'
);

select tests.authenticate_as(:'gus');

select throws_ok(
  $$select public.complete_task('00000000-0000-0000-0000-0000000000f4')$$,
  'P0001', 'TASK_NOT_FOUND', 'tasks of a deleted household are invisible to complete_task'
);

select throws_ok(
  $$select public.reopen_task('00000000-0000-0000-0000-0000000000f4')$$,
  'P0001', 'TASK_NOT_FOUND', 'tasks of a deleted household are invisible to reopen_task'
);

-- Reopening and the assignee --------------------------------------------------

-- Fay completes her task and then leaves: the completed task keeps her for history.
select tests.authenticate_as(:'fay');
select public.complete_task('00000000-0000-0000-0000-0000000000f2');
select tests.clear_auth();
update public.household_members set left_at = now()
where household_id = '00000000-0000-0000-0000-0000000000a1' and user_id = :'fay';

select is(
  (select assignee_id from public.task_occurrences where id = '00000000-0000-0000-0000-0000000000f2'),
  :'fay'::uuid,
  'a completed task keeps its departed assignee'
);

select tests.authenticate_as(:'dani');
select public.reopen_task('00000000-0000-0000-0000-0000000000f2');

select is(
  (select assignee_id is null and completed_at is null
   from public.task_occurrences where id = '00000000-0000-0000-0000-0000000000f2'),
  true,
  'reopening unassigns a departed assignee'
);

select tests.authenticate_as(:'bob');
select public.complete_task('00000000-0000-0000-0000-0000000000f3');
select tests.authenticate_as(:'dani');
select public.reopen_task('00000000-0000-0000-0000-0000000000f3');

select is(
  (select assignee_id = :'bob' and completed_at is null
   from public.task_occurrences where id = '00000000-0000-0000-0000-0000000000f3'),
  true,
  'reopening keeps an active assignee'
);

-- anon ------------------------------------------------------------------------

select tests.clear_auth();
set local role anon;

select throws_ok(
  $$select public.complete_task(gen_random_uuid())$$,
  '42501', null, 'anon cannot execute complete_task'
);

select throws_ok(
  $$select public.reopen_task(gen_random_uuid())$$,
  '42501', null, 'anon cannot execute reopen_task'
);

reset role;
select * from finish();
rollback;
