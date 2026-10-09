begin;
select plan(23);

select tests.create_user('ana@test.dev', 'Ana') as ana \gset
select tests.create_user('bob@test.dev', 'Bob') as bob \gset
select tests.create_user('carla@test.dev', 'Carla') as carla \gset
select tests.create_user('fay@test.dev', 'Fay') as fay \gset

-- Ana owns the household and Bob is a member; Fay has already left; Carla is in another one.
insert into public.households (id, name, created_by)
values
  ('00000000-0000-0000-0000-0000000000a1', 'Casa', :'ana'),
  ('00000000-0000-0000-0000-0000000000a2', 'Otra', :'carla');
insert into public.household_members (household_id, user_id, role, left_at)
values
  ('00000000-0000-0000-0000-0000000000a1', :'ana', 'owner', null),
  ('00000000-0000-0000-0000-0000000000a1', :'bob', 'member', null),
  ('00000000-0000-0000-0000-0000000000a1', :'fay', 'member', now()),
  ('00000000-0000-0000-0000-0000000000a2', :'carla', 'owner', null);

-- An open recurring task still assigned to Fay, as if it had been assigned before she left.
insert into public.task_series (id, household_id, title, recurrence_rule, created_by)
values ('00000000-0000-0000-0000-0000000000e2', '00000000-0000-0000-0000-0000000000a1',
        'De Fay', '{"kind":"interval","every":2}', :'ana');
insert into public.task_occurrences (id, series_id, household_id, due_on, assignee_id)
values ('00000000-0000-0000-0000-0000000000d2', '00000000-0000-0000-0000-0000000000e2',
        '00000000-0000-0000-0000-0000000000a1', current_date, :'fay');

-- create_task -----------------------------------------------------------------

select tests.authenticate_as(:'bob');

select public.create_task('00000000-0000-0000-0000-0000000000d1', '00000000-0000-0000-0000-0000000000a1',
                          'Fregar', 'kitchen', :'ana', current_date, '{"kind":"interval","every":1}');

select is(
  (select s.recurrence_rule
   from public.task_occurrences o join public.task_series s on s.id = o.series_id
   where o.id = '00000000-0000-0000-0000-0000000000d1'),
  '{"kind":"interval","every":1}'::jsonb,
  'create_task stores the recurrence rule in the series'
);

select throws_ok(
  $$select public.create_task(gen_random_uuid(), '00000000-0000-0000-0000-0000000000a1',
                              'x', null, null, null, '{"kind":"interval","every":1}')$$,
  'P0001', 'RECURRENCE_NEEDS_DATE', 'a recurring task needs a date'
);

select throws_ok(
  $$select public.create_task(gen_random_uuid(), '00000000-0000-0000-0000-0000000000a1',
                              'x', null, null, current_date, '{"kind":"weekly","days":[]}')$$,
  'P0001', 'INVALID_RECURRENCE', 'an invalid rule is rejected'
);

-- complete_task generates the next occurrence ---------------------------------

select public.complete_task('00000000-0000-0000-0000-0000000000d1', current_date);
select tests.clear_auth();

select is(
  (select string_agg(
            (o.due_on = private.next_due_on(s.recurrence_rule, current_date, current_date))
            || '|' || (o.assignee_id = :'ana')
            || '|' || (o.generated_from = '00000000-0000-0000-0000-0000000000d1'),
            ',')
   from public.task_occurrences o join public.task_series s on s.id = o.series_id
   where o.series_id = (select series_id from public.task_occurrences
                        where id = '00000000-0000-0000-0000-0000000000d1')
     and o.completed_at is null and o.skipped_at is null),
  'true|true|true',
  'completing a recurring task creates exactly one next occurrence'
);

select tests.authenticate_as(:'bob');
select public.complete_task('00000000-0000-0000-0000-0000000000d1', current_date);
select tests.clear_auth();

select is(
  (select count(*) from public.task_occurrences
   where series_id = (select series_id from public.task_occurrences
                      where id = '00000000-0000-0000-0000-0000000000d1')),
  2::bigint,
  'completing twice does not generate a second next occurrence'
);

select throws_ok(
  $$insert into public.task_occurrences (series_id, household_id, due_on)
    select series_id, household_id, due_on from public.task_occurrences
    where id = '00000000-0000-0000-0000-0000000000d1'$$,
  '23505', null, 'a series has at most one open occurrence'
);

select tests.authenticate_as(:'bob');
select public.complete_task('00000000-0000-0000-0000-0000000000d2', current_date);
select tests.clear_auth();

select is(
  (select (assignee_id is null) || '|' || due_on
   from public.task_occurrences where generated_from = '00000000-0000-0000-0000-0000000000d2'),
  'true|' || (current_date + 2),
  'the next occurrence of a departed assignee is unassigned'
);

select tests.authenticate_as(:'bob');
select public.create_task('00000000-0000-0000-0000-0000000000d3', '00000000-0000-0000-0000-0000000000a1',
                          'Puntual', null, null, current_date, null);
select public.complete_task('00000000-0000-0000-0000-0000000000d3', current_date);

select is(
  (select count(*) from public.task_occurrences
   where series_id = (select series_id from public.task_occurrences
                      where id = '00000000-0000-0000-0000-0000000000d3')),
  1::bigint,
  'completing a one-off task generates nothing'
);

-- skip_task -------------------------------------------------------------------

select public.create_task('00000000-0000-0000-0000-0000000000d4', '00000000-0000-0000-0000-0000000000a1',
                          'Regar', null, :'bob', current_date, '{"kind":"weekly","days":[1,4]}');
select public.skip_task('00000000-0000-0000-0000-0000000000d4', current_date);
select tests.clear_auth();

select is(
  (select (skipped_at is not null) || '|' || (skipped_by = :'bob') || '|' || (completed_at is null)
   from public.task_occurrences where id = '00000000-0000-0000-0000-0000000000d4'),
  'true|true|true',
  'skip_task marks skipped_at and skipped_by'
);

select is(
  (select (o.due_on = private.next_due_on(s.recurrence_rule, current_date, current_date))
          || '|' || (o.assignee_id = :'bob') || '|' || (o.completed_at is null and o.skipped_at is null)
   from public.task_occurrences o join public.task_series s on s.id = o.series_id
   where o.generated_from = '00000000-0000-0000-0000-0000000000d4'),
  'true|true|true',
  'skip_task generates the next occurrence'
);

select tests.authenticate_as(:'bob');
select public.create_task('00000000-0000-0000-0000-0000000000d5', '00000000-0000-0000-0000-0000000000a1',
                          'Otra puntual', null, null, null, null);

select throws_ok(
  $$select public.skip_task('00000000-0000-0000-0000-0000000000d5', current_date)$$,
  'P0001', 'NOT_RECURRING', 'a one-off task cannot be skipped'
);

-- reopen_task -----------------------------------------------------------------

select public.reopen_task('00000000-0000-0000-0000-0000000000d1');
select tests.clear_auth();

select is(
  (select count(*)::text || '|' || bool_and(completed_at is null and completed_by is null)
   from public.task_occurrences
   where series_id = (select series_id from public.task_occurrences
                      where id = '00000000-0000-0000-0000-0000000000d1')),
  '1|true',
  'reopening a completed task withdraws its open next occurrence'
);

-- d6 is completed, its next n1 completed too, and n1's next n2 is open.
select tests.authenticate_as(:'bob');
select public.create_task('00000000-0000-0000-0000-0000000000d6', '00000000-0000-0000-0000-0000000000a1',
                          'Barrer', null, null, current_date, '{"kind":"monthly","day":31}');
select public.complete_task('00000000-0000-0000-0000-0000000000d6', current_date);
select tests.clear_auth();
select id as n1 from public.task_occurrences where generated_from = '00000000-0000-0000-0000-0000000000d6' \gset
select tests.authenticate_as(:'bob');
select public.complete_task(:'n1', current_date);

select throws_ok(
  $$select public.reopen_task('00000000-0000-0000-0000-0000000000d6')$$,
  'P0001', 'ALREADY_ADVANCED', 'a task whose next occurrence is done cannot be reopened'
);

select tests.clear_auth();

select is(
  (select count(*)::text || '|' || count(completed_at) || '|'
          || bool_or(id = '00000000-0000-0000-0000-0000000000d6' and completed_at is not null)
   from public.task_occurrences
   where series_id = (select series_id from public.task_occurrences
                      where id = '00000000-0000-0000-0000-0000000000d6')),
  '3|2|true',
  'a refused reopen changes nothing'
);

select tests.authenticate_as(:'bob');
select public.reopen_task('00000000-0000-0000-0000-0000000000d4');
select tests.clear_auth();

select is(
  (select count(*)::text || '|' || bool_and(skipped_at is null and skipped_by is null and completed_at is null)
   from public.task_occurrences
   where series_id = (select series_id from public.task_occurrences
                      where id = '00000000-0000-0000-0000-0000000000d4')),
  '1|true',
  'reopening a skipped task leaves it open and withdraws its next occurrence'
);

-- p_today -----------------------------------------------------------------------

select tests.authenticate_as(:'bob');

select throws_ok(
  $$select public.complete_task('00000000-0000-0000-0000-0000000000d4', current_date + 3)$$,
  'P0001', 'INVALID_TODAY', 'complete_task rejects a today far from the server date'
);

select is(
  (select completed_at is null and skipped_at is null
   from public.task_occurrences where id = '00000000-0000-0000-0000-0000000000d4'),
  true,
  'a rejected today leaves the occurrence open'
);

select throws_ok(
  $$select public.skip_task(gen_random_uuid(), current_date - 3)$$,
  'P0001', 'INVALID_TODAY', 'today is validated before looking the task up'
);

-- update_task -----------------------------------------------------------------

select public.update_task(:'n1', 'Barrer', null, null, current_date, null);
select tests.clear_auth();

select is(
  (select (s.recurrence_rule is null) || '|' || count(o.id)
   from public.task_series s join public.task_occurrences o on o.series_id = s.id
   where s.id = (select series_id from public.task_occurrences
                 where id = '00000000-0000-0000-0000-0000000000d6')
   group by s.recurrence_rule),
  'true|3',
  'update_task with a null rule makes the series one-off and keeps its history'
);

select tests.authenticate_as(:'bob');

select throws_ok(
  $$select public.update_task('00000000-0000-0000-0000-0000000000d5', 'x', null, null, null, '{"kind":"interval","every":1}')$$,
  'P0001', 'RECURRENCE_NEEDS_DATE', 'update_task requires a date for a recurring task'
);

select throws_ok(
  $$select public.update_task('00000000-0000-0000-0000-0000000000d5', 'x', null, null, current_date, '{"kind":"monthly","day":0}')$$,
  'P0001', 'INVALID_RECURRENCE', 'update_task rejects an invalid rule'
);

-- Not a member / anon ---------------------------------------------------------

select tests.authenticate_as(:'carla');

select throws_ok(
  $$select public.skip_task('00000000-0000-0000-0000-0000000000d1', current_date)$$,
  'P0001', 'TASK_NOT_FOUND', 'non-member skip looks like not found'
);

select tests.clear_auth();
set local role anon;

select throws_ok(
  $$select public.skip_task(gen_random_uuid(), current_date)$$,
  '42501', null, 'anon cannot execute skip_task'
);

reset role;
select * from finish();
rollback;
