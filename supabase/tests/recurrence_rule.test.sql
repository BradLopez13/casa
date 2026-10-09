begin;
select plan(28);

-- valid_recurrence: the same shapes recurrenceRuleSchema accepts ---------------

select ok(private.valid_recurrence('{"kind":"interval","every":1}'), 'accepts interval every 1');
select ok(private.valid_recurrence('{"kind":"interval","every":365}'), 'accepts interval every 365');
select ok(private.valid_recurrence('{"kind":"weekly","days":[1]}'), 'accepts weekly on one day');
select ok(private.valid_recurrence('{"kind":"weekly","days":[1,2,3,4,5,6,7]}'), 'accepts weekly on every day');
select ok(private.valid_recurrence('{"kind":"monthly","day":1}'), 'accepts monthly on day 1');
select ok(private.valid_recurrence('{"kind":"monthly","day":31}'), 'accepts monthly on day 31');

-- ...and the shapes it rejects -------------------------------------------------

select ok(not private.valid_recurrence('{"kind":"interval","every":0}'), 'rejects interval every 0');
select ok(not private.valid_recurrence('{"kind":"interval","every":366}'), 'rejects interval every 366');
select ok(not private.valid_recurrence('{"kind":"interval","every":1.5}'), 'rejects a fractional interval');
select ok(not private.valid_recurrence('{"kind":"weekly","days":[]}'), 'rejects weekly with no days');
select ok(not private.valid_recurrence('{"kind":"weekly","days":[4,1]}'), 'rejects weekly days out of order');
select ok(not private.valid_recurrence('{"kind":"weekly","days":[1,1]}'), 'rejects repeated weekly days');
select ok(not private.valid_recurrence('{"kind":"weekly","days":[8]}'), 'rejects a weekday above 7');
select ok(not private.valid_recurrence('{"kind":"monthly","day":0}'), 'rejects monthly day 0');
select ok(not private.valid_recurrence('{"kind":"monthly","day":32}'), 'rejects monthly day 32');
select ok(not private.valid_recurrence('{"kind":"yearly"}'), 'rejects an unknown kind');
select ok(not private.valid_recurrence('{"kind":"interval","every":2,"extra":1}'), 'rejects extra keys');
select ok(not private.valid_recurrence('null'::jsonb), 'rejects json null');
select ok(not private.valid_recurrence('[]'::jsonb), 'rejects an array');
select ok(not private.valid_recurrence('{"kind":"interval","every":"2"}'), 'rejects a numeric string');

-- next_due_on: integral numbers that are not canonical ints --------------------

select is(
  private.next_due_on('{"kind":"interval","every":3.0}', '2026-10-09', '2026-10-09'),
  '2026-10-12'::date,
  'next_due_on reads an interval written as 3.0'
);

select is(
  private.next_due_on('{"kind":"monthly","day":9.0}', '2026-10-09', '2026-10-09'),
  '2026-11-09'::date,
  'next_due_on reads a monthly day written as 9.0'
);

select throws_ok(
  $$select private.next_due_on('{"kind":"yearly"}', '2026-10-09', '2026-10-09')$$,
  '22023',
  null,
  'next_due_on raises on an invalid rule'
);

-- the check constraint on task_series -------------------------------------------

select tests.create_user('ana@test.dev', 'Ana') as ana \gset

insert into public.households (id, name, created_by)
values ('00000000-0000-0000-0000-0000000000a1', 'Casa', :'ana');

select throws_ok(
  $$insert into public.task_series (household_id, title, recurrence_rule)
    values ('00000000-0000-0000-0000-0000000000a1', 'Fregar', '{"kind":"weekly","days":[]}')$$,
  '23514',
  null,
  'a series cannot store an invalid rule'
);

select lives_ok(
  $$insert into public.task_series (household_id, title, recurrence_rule)
    values ('00000000-0000-0000-0000-0000000000a1', 'Fregar', '{"kind":"weekly","days":[1,4]}')$$,
  'a series stores a valid rule'
);

-- privileges --------------------------------------------------------------------

select ok(
  not has_function_privilege('authenticated', 'private.valid_recurrence(jsonb)', 'execute'),
  'authenticated cannot execute valid_recurrence'
);

select ok(
  not has_function_privilege('authenticated', 'private.next_due_on(jsonb, date, date)', 'execute'),
  'authenticated cannot execute next_due_on'
);

select ok(
  not has_function_privilege('authenticated', 'private.close_occurrence(uuid, date, boolean)', 'execute'),
  'authenticated cannot execute close_occurrence'
);

select * from finish();
rollback;
