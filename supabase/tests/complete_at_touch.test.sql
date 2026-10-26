begin;
select plan(14);

select tests.create_user('ana@test.dev', 'Ana') as ana \gset

insert into public.households (id, name, created_by)
values ('00000000-0000-0000-0000-0000000000a1', 'Casa', :'ana');
insert into public.household_members (household_id, user_id, role)
values ('00000000-0000-0000-0000-0000000000a1', :'ana', 'owner');

-- One-off tasks t1..t6 and a daily one, r1, due three days ago.
insert into public.task_series (id, household_id, title, created_by)
select ('00000000-0000-0000-0000-0000000000e' || i)::uuid,
       '00000000-0000-0000-0000-0000000000a1', 'Tarea ' || i, :'ana'
from generate_series(1, 7) as i;
insert into public.task_occurrences (id, series_id, household_id)
select ('00000000-0000-0000-0000-0000000000f' || i)::uuid,
       ('00000000-0000-0000-0000-0000000000e' || i)::uuid,
       '00000000-0000-0000-0000-0000000000a1'
from generate_series(1, 7) as i;
insert into public.task_series (id, household_id, title, recurrence_rule, created_by)
values ('00000000-0000-0000-0000-0000000000e9', '00000000-0000-0000-0000-0000000000a1',
        'Diaria', '{"kind":"interval","every":1}', :'ana');
insert into public.task_occurrences (id, series_id, household_id, due_on)
values ('00000000-0000-0000-0000-0000000000d9', '00000000-0000-0000-0000-0000000000e9',
        '00000000-0000-0000-0000-0000000000a1', (now() at time zone 'utc')::date - 3);

select tests.authenticate_as(:'ana');

-- Without a time zone in the profile -----------------------------------------

-- Marked two hours ago without a connection: the note keeps that time.
select public.complete_task('00000000-0000-0000-0000-0000000000f1',
  ((now() - interval '2 hours') at time zone 'utc')::date, now() - interval '2 hours');
select is(
  (select completed_at from public.task_occurrences where id = '00000000-0000-0000-0000-0000000000f1'),
  now() - interval '2 hours',
  'complete_task keeps the time of the tap'
);

-- Marked three days ago, sent today: its own day still passes the one-day check.
select lives_ok(
  $$select public.complete_task('00000000-0000-0000-0000-0000000000f2',
      ((now() - interval '3 days') at time zone 'utc')::date, now() - interval '3 days')$$,
  'a tap queued days ago is checked against its own day, not today'
);
select is(
  (select completed_at from public.task_occurrences where id = '00000000-0000-0000-0000-0000000000f2'),
  now() - interval '3 days',
  'and keeps its time'
);

-- Out of the window: now, as before.
select public.complete_task('00000000-0000-0000-0000-0000000000f3',
  (now() at time zone 'utc')::date, now() - interval '10 days');
select is(
  (select completed_at from public.task_occurrences where id = '00000000-0000-0000-0000-0000000000f3'),
  now(),
  'a time older than seven days is not trusted'
);
select public.complete_task('00000000-0000-0000-0000-0000000000f4',
  (now() at time zone 'utc')::date, now() + interval '1 day');
select is(
  (select completed_at from public.task_occurrences where id = '00000000-0000-0000-0000-0000000000f4'),
  now(),
  'a time in the future is not trusted'
);
select public.complete_task('00000000-0000-0000-0000-0000000000f5',
  (now() at time zone 'utc')::date, now() + interval '2 minutes');
select is(
  (select completed_at from public.task_occurrences where id = '00000000-0000-0000-0000-0000000000f5'),
  now(),
  'a clock a little ahead is clamped to now'
);

-- Too old to trust, with its own old day: it still closes, on today, at now.
select lives_ok(
  $$select public.complete_task('00000000-0000-0000-0000-0000000000f7',
      ((now() - interval '10 days') at time zone 'utc')::date, now() - interval '10 days')$$,
  'a tap too old to trust is not refused for its old day'
);
select is(
  (select completed_at from public.task_occurrences where id = '00000000-0000-0000-0000-0000000000f7'),
  now(),
  'and closes at now'
);

-- An older build sends no time.
select public.complete_task('00000000-0000-0000-0000-0000000000f6', (now() at time zone 'utc')::date);
select is(
  (select completed_at from public.task_occurrences where id = '00000000-0000-0000-0000-0000000000f6'),
  now(),
  'without a time it is now, as before'
);

select throws_ok(
  $$select public.complete_task('00000000-0000-0000-0000-0000000000d9',
      (now() at time zone 'utc')::date, now() - interval '3 days')$$,
  'P0001', 'INVALID_TODAY', 'a today far from the tap is still rejected'
);

-- With a time zone: the repeat starts from the day of the tap ---------------

select tests.clear_auth();
update public.profiles set time_zone = 'UTC' where user_id = :'ana';
select tests.authenticate_as(:'ana');

select public.complete_task('00000000-0000-0000-0000-0000000000d9',
  (now() at time zone 'utc')::date, now() - interval '3 days');
select is(
  (select due_on from public.task_occurrences
   where generated_from = '00000000-0000-0000-0000-0000000000d9'),
  ((now() - interval '3 days') at time zone 'utc')::date + 1,
  'the next occurrence starts from the day it was marked, not the day it arrived'
);

-- Skipping is online only: always now.
select lives_ok(
  $$select public.skip_task(
      (select id from public.task_occurrences
       where generated_from = '00000000-0000-0000-0000-0000000000d9'),
      (now() at time zone 'utc')::date)$$,
  'skip_task still works with the new close_occurrence'
);

select tests.clear_auth();
select ok(
  not has_function_privilege('authenticated',
    'private.close_occurrence(uuid, date, boolean, timestamptz)', 'execute'),
  'authenticated cannot execute close_occurrence'
);
select ok(
  has_function_privilege('authenticated', 'public.complete_task(uuid, date, timestamptz)', 'execute')
  and not has_function_privilege('anon', 'public.complete_task(uuid, date, timestamptz)', 'execute'),
  'complete_task is for signed-in people only'
);

select * from finish();
rollback;
