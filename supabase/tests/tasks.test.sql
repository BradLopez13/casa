begin;
select plan(17);

select tests.create_user('ana@test.dev', 'Ana') as ana \gset
select tests.create_user('bob@test.dev', 'Bob') as bob \gset
select tests.create_user('carla@test.dev', 'Carla') as carla \gset
select tests.create_user('dani@test.dev', 'Dani') as dani \gset

-- Ana owns the household; Bob and Dani are members; Carla has none.
insert into public.households (id, name, created_by)
values ('00000000-0000-0000-0000-0000000000a1', 'Casa', :'ana');
insert into public.household_members (household_id, user_id, role)
values
  ('00000000-0000-0000-0000-0000000000a1', :'ana', 'owner'),
  ('00000000-0000-0000-0000-0000000000a1', :'bob', 'member'),
  ('00000000-0000-0000-0000-0000000000a1', :'dani', 'member');

insert into public.task_series (id, household_id, title, room, created_by)
values ('00000000-0000-0000-0000-0000000000b1', '00000000-0000-0000-0000-0000000000a1',
        'Fregar', 'kitchen', :'ana');

insert into public.task_occurrences (id, series_id, household_id, due_on, assignee_id, completed_at, completed_by)
values
  ('00000000-0000-0000-0000-0000000000c1', '00000000-0000-0000-0000-0000000000b1',
   '00000000-0000-0000-0000-0000000000a1', current_date, :'bob', null, null),
  ('00000000-0000-0000-0000-0000000000c2', '00000000-0000-0000-0000-0000000000b1',
   '00000000-0000-0000-0000-0000000000a1', current_date, :'bob', now(), :'bob'),
  ('00000000-0000-0000-0000-0000000000c3', '00000000-0000-0000-0000-0000000000b1',
   '00000000-0000-0000-0000-0000000000a1', current_date, :'dani', null, null),
  ('00000000-0000-0000-0000-0000000000c4', '00000000-0000-0000-0000-0000000000b1',
   '00000000-0000-0000-0000-0000000000a1', current_date, :'dani', now(), :'dani');

-- Reads -----------------------------------------------------------------------

select tests.authenticate_as(:'bob');

select is(
  (select count(*) from public.task_series)::text || '/' || (select count(*) from public.task_occurrences)::text,
  '1/4',
  'member reads tasks of their household'
);

-- Writes ----------------------------------------------------------------------

select throws_ok(
  $$insert into public.task_series (household_id, title) values ('00000000-0000-0000-0000-0000000000a1', 'x')$$,
  '42501', null, 'client cannot insert task_series'
);
select throws_ok(
  $$update public.task_series set title = 'y'$$,
  '42501', null, 'client cannot update task_series'
);
select throws_ok(
  $$delete from public.task_series$$,
  '42501', null, 'client cannot delete task_series'
);
select throws_ok(
  $$insert into public.task_occurrences (series_id, household_id) values ('00000000-0000-0000-0000-0000000000b1', '00000000-0000-0000-0000-0000000000a1')$$,
  '42501', null, 'client cannot insert task_occurrences'
);
select throws_ok(
  $$update public.task_occurrences set due_on = null$$,
  '42501', null, 'client cannot update task_occurrences'
);
select throws_ok(
  $$delete from public.task_occurrences$$,
  '42501', null, 'client cannot delete task_occurrences'
);

select tests.authenticate_as(:'carla');

select is(
  (select count(*) from public.task_series)::text || '/' || (select count(*) from public.task_occurrences)::text,
  '0/0',
  'non-member reads nothing'
);

select tests.clear_auth();

-- Constraints -----------------------------------------------------------------

select throws_ok(
  $$insert into public.task_series (household_id, title) values ('00000000-0000-0000-0000-0000000000a1', ' x')$$,
  '23514', null, 'untrimmed title is rejected'
);
select throws_ok(
  $$insert into public.task_series (household_id, title) values ('00000000-0000-0000-0000-0000000000a1', '')$$,
  '23514', null, 'empty title is rejected'
);
select throws_ok(
  $$insert into public.task_series (household_id, title) values ('00000000-0000-0000-0000-0000000000a1', repeat('x', 101))$$,
  '23514', null, 'title over 100 chars is rejected'
);
select throws_ok(
  $$insert into public.task_series (household_id, title, room) values ('00000000-0000-0000-0000-0000000000a1', 'x', 'garage')$$,
  '23514', null, 'room must be a known key'
);

-- Unassign on leaving ---------------------------------------------------------

select tests.authenticate_as(:'bob');
select public.leave_household('00000000-0000-0000-0000-0000000000a1');
select tests.clear_auth();

select is(
  (select assignee_id from public.task_occurrences where id = '00000000-0000-0000-0000-0000000000c1'),
  null,
  'leaving unassigns my open tasks'
);
select is(
  (select assignee_id from public.task_occurrences where id = '00000000-0000-0000-0000-0000000000c2'),
  :'bob'::uuid,
  'leaving keeps my completed tasks assigned'
);

-- Unassign on removal ---------------------------------------------------------

select tests.authenticate_as(:'ana');
select public.remove_member('00000000-0000-0000-0000-0000000000a1', :'dani');
select tests.clear_auth();

select is(
  (select assignee_id from public.task_occurrences where id = '00000000-0000-0000-0000-0000000000c3'),
  null,
  'removal unassigns open tasks'
);
select is(
  (select assignee_id from public.task_occurrences where id = '00000000-0000-0000-0000-0000000000c4'),
  :'dani'::uuid,
  'removal keeps completed tasks assigned'
);

-- Household deletion ----------------------------------------------------------

select tests.authenticate_as(:'ana');
select public.delete_household('00000000-0000-0000-0000-0000000000a1');

select is(
  (select count(*) from public.task_occurrences),
  0::bigint,
  'deleting the household hides its tasks'
);

select * from finish();
rollback;
