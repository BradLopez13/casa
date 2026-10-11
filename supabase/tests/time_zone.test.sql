begin;
select plan(16);

select tests.create_user('ana@test.dev', 'Ana') as ana \gset
select tests.create_user('bob@test.dev', 'Bob') as bob \gset

insert into public.households (id, name, created_by)
values ('00000000-0000-0000-0000-0000000000a1', 'Casa', :'ana');
insert into public.household_members (household_id, user_id, role)
values ('00000000-0000-0000-0000-0000000000a1', :'ana', 'owner'),
       ('00000000-0000-0000-0000-0000000000a1', :'bob', 'member');

-- set_time_zone ---------------------------------------------------------------

select tests.clear_auth();
select throws_ok($$select public.set_time_zone('Europe/Madrid')$$, 'P0001', 'NOT_AUTHENTICATED',
                 'set_time_zone needs a session');

select tests.authenticate_as(:'ana');
select public.set_time_zone('Europe/Madrid');
select is((select time_zone from public.profiles where user_id = :'ana'), 'Europe/Madrid',
          'set_time_zone stores the zone');
select is((select time_zone from public.profiles where user_id = :'bob'), null,
          'it does not touch another profile');

select throws_ok($$select public.set_time_zone('Mars/Olympus')$$, 'P0001', 'INVALID_TIME_ZONE',
                 'an unknown zone is rejected');
select throws_ok($$select public.set_time_zone('')$$, 'P0001', 'INVALID_TIME_ZONE',
                 'an empty zone is rejected');
select throws_ok($$select public.set_time_zone(null)$$, 'P0001', 'INVALID_TIME_ZONE',
                 'a null zone is rejected');
select is((select time_zone from public.profiles where user_id = :'ana'), 'Europe/Madrid',
          'a rejected zone leaves the stored one');

-- today_for -------------------------------------------------------------------

select tests.clear_auth();

update public.profiles set time_zone = 'Asia/Tokyo' where user_id = :'ana';
select is(private.today_for(:'ana', '2026-10-11 23:30+00'), '2026-10-12'::date, 'Tokyo is already on the 12th');
update public.profiles set time_zone = 'Europe/Madrid' where user_id = :'ana';
select is(private.today_for(:'ana', '2026-10-11 23:30+00'), '2026-10-12'::date, 'Madrid is already on the 12th');
update public.profiles set time_zone = 'America/New_York' where user_id = :'ana';
select is(private.today_for(:'ana', '2026-10-11 23:30+00'), '2026-10-11'::date, 'New York is still on the 11th');
update public.profiles set time_zone = null where user_id = :'ana';
select is(private.today_for(:'ana', '2026-10-11 23:30+00'), '2026-10-11'::date, 'no zone falls back to UTC');

-- close_occurrence ------------------------------------------------------------

update public.profiles set time_zone = 'Pacific/Kiritimati' where user_id = :'ana';
insert into public.task_series (id, household_id, title, recurrence_rule, created_by)
values ('00000000-0000-0000-0000-0000000000e1', '00000000-0000-0000-0000-0000000000a1',
        'Diaria', '{"kind":"interval","every":1}', :'ana');
insert into public.task_occurrences (id, series_id, household_id, due_on, assignee_id)
values ('00000000-0000-0000-0000-0000000000d1', '00000000-0000-0000-0000-0000000000e1',
        '00000000-0000-0000-0000-0000000000a1', (now() at time zone 'utc')::date, :'ana');

select tests.authenticate_as(:'ana');
select public.complete_task('00000000-0000-0000-0000-0000000000d1', (now() at time zone 'utc')::date);
select tests.clear_auth();

select is(
  (select o.due_on from public.task_occurrences o
   where o.generated_from = '00000000-0000-0000-0000-0000000000d1'),
  greatest((now() at time zone 'utc')::date, (now() at time zone 'Pacific/Kiritimati')::date) + 1,
  'the next occurrence starts from the date in the person''s zone'
);

-- A far-off p_today is ignored when the person has a zone...
insert into public.task_series (id, household_id, title, recurrence_rule, created_by)
values ('00000000-0000-0000-0000-0000000000e2', '00000000-0000-0000-0000-0000000000a1',
        'Otra', '{"kind":"interval","every":1}', :'ana');
insert into public.task_occurrences (id, series_id, household_id, due_on, assignee_id)
values ('00000000-0000-0000-0000-0000000000d2', '00000000-0000-0000-0000-0000000000e2',
        '00000000-0000-0000-0000-0000000000a1', (now() at time zone 'utc')::date, :'ana');
select tests.authenticate_as(:'ana');
select lives_ok(
  $$select public.complete_task('00000000-0000-0000-0000-0000000000d2', current_date + 30)$$,
  'with a zone, p_today is not validated'
);
select tests.clear_auth();
select is(
  (select o.due_on from public.task_occurrences o
   where o.generated_from = '00000000-0000-0000-0000-0000000000d2'),
  greatest((now() at time zone 'utc')::date, (now() at time zone 'Pacific/Kiritimati')::date) + 1,
  'the next occurrence ignores a far p_today and uses the zone date'
);
select isnt(
  (select o.due_on from public.task_occurrences o
   where o.generated_from = '00000000-0000-0000-0000-0000000000d2'),
  current_date + 31,
  'p_today does not feed the next occurrence'
);
select tests.authenticate_as(:'ana');

-- ...but checked as before without one.
select tests.clear_auth();
update public.profiles set time_zone = null where user_id = :'ana';
insert into public.task_series (id, household_id, title, recurrence_rule, created_by)
values ('00000000-0000-0000-0000-0000000000e3', '00000000-0000-0000-0000-0000000000a1',
        'Y otra', '{"kind":"interval","every":1}', :'ana');
insert into public.task_occurrences (id, series_id, household_id, due_on, assignee_id)
values ('00000000-0000-0000-0000-0000000000d3', '00000000-0000-0000-0000-0000000000e3',
        '00000000-0000-0000-0000-0000000000a1', (now() at time zone 'utc')::date, :'ana');
select tests.authenticate_as(:'ana');
select throws_ok(
  $$select public.complete_task('00000000-0000-0000-0000-0000000000d3', current_date + 3)$$,
  'P0001', 'INVALID_TODAY', 'without a zone, a far p_today is rejected'
);

select * from finish();
rollback;
