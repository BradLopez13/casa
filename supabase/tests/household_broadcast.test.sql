begin;
select plan(19);

select tests.create_user('ana@test.dev', 'Ana') as ana \gset
select tests.create_user('bob@test.dev', 'Bob') as bob \gset
select tests.create_user('carla@test.dev', 'Carla') as carla \gset

-- Ana owns Casa (Bob is a member); Carla owns Otra.
insert into public.households (id, name, created_by)
values
  ('00000000-0000-0000-0000-0000000000a1', 'Casa', :'ana'),
  ('00000000-0000-0000-0000-0000000000a2', 'Otra', :'carla');
insert into public.household_members (household_id, user_id, role)
values
  ('00000000-0000-0000-0000-0000000000a1', :'ana', 'owner'),
  ('00000000-0000-0000-0000-0000000000a1', :'bob', 'member'),
  ('00000000-0000-0000-0000-0000000000a2', :'carla', 'owner');

insert into public.task_series (id, household_id, title, created_by)
values
  ('00000000-0000-0000-0000-0000000000e1', '00000000-0000-0000-0000-0000000000a1', 'Fregar', :'ana'),
  ('00000000-0000-0000-0000-0000000000e2', '00000000-0000-0000-0000-0000000000a1', 'Barrer', :'ana');
insert into public.task_occurrences (id, series_id, household_id)
values
  ('00000000-0000-0000-0000-0000000000f1', '00000000-0000-0000-0000-0000000000e1', '00000000-0000-0000-0000-0000000000a1'),
  ('00000000-0000-0000-0000-0000000000f2', '00000000-0000-0000-0000-0000000000e2', '00000000-0000-0000-0000-0000000000a1');
insert into public.shopping_items (id, household_id, name, created_by)
values ('00000000-0000-0000-0000-0000000000b9', '00000000-0000-0000-0000-0000000000a2', 'Arroz', :'carla');

-- Counts run as the migration role, which bypasses RLS on realtime.messages.
create function pg_temp.casa_messages(p_table text default null)
returns bigint
language sql
as $$
  select count(*) from realtime.messages
  where topic = 'household:00000000-0000-0000-0000-0000000000a1'
    and extension = 'broadcast'
    and event = 'changed'
    and private
    and (p_table is null or payload->>'table' = p_table);
$$;

-- 1. Triggers -----------------------------------------------------------------

select count(*) as all_before from realtime.messages
where topic = 'household:00000000-0000-0000-0000-0000000000a1' \gset
select pg_temp.casa_messages('shopping_items') as items_before \gset

select tests.authenticate_as(:'bob');
select public.add_shopping_item(
  '00000000-0000-0000-0000-0000000000d1', '00000000-0000-0000-0000-0000000000a1', 'Leche', null
);
select tests.clear_auth();

select is(
  (select count(*) from realtime.messages
   where topic = 'household:00000000-0000-0000-0000-0000000000a1') - :all_before,
  1::bigint,
  'adding an item sends exactly one message on the household topic'
);
select is(
  pg_temp.casa_messages('shopping_items') - :items_before,
  1::bigint,
  'that message is a private changed broadcast for shopping_items'
);

select pg_temp.casa_messages('task_occurrences') as occ_before \gset

select tests.authenticate_as(:'bob');
select lives_ok(
  $$select public.complete_task('00000000-0000-0000-0000-0000000000f1', current_date)$$,
  'complete_task still works with the broadcast triggers'
);
select tests.clear_auth();

select cmp_ok(
  pg_temp.casa_messages('task_occurrences') - :occ_before,
  '>=',
  1::bigint,
  'completing a task sends at least one task_occurrences message'
);

select pg_temp.casa_messages('shopping_items') as items_before \gset

select tests.authenticate_as(:'bob');
select public.delete_shopping_item('00000000-0000-0000-0000-0000000000d1');
select tests.clear_auth();

select is(
  pg_temp.casa_messages('shopping_items') - :items_before,
  1::bigint,
  'deleting an item sends exactly one shopping_items message'
);

select pg_temp.casa_messages('task_series') as series_before \gset
select pg_temp.casa_messages('task_occurrences') as occ_before \gset

select tests.authenticate_as(:'ana');
select lives_ok(
  $$select public.delete_task('00000000-0000-0000-0000-0000000000f2')$$,
  'delete_task still works with the broadcast triggers'
);
select tests.clear_auth();

select is(
  pg_temp.casa_messages('task_series') - :series_before,
  1::bigint,
  'deleting a task sends a task_series message'
);
select is(
  pg_temp.casa_messages('task_occurrences') - :occ_before,
  1::bigint,
  'the occurrence removed by cascade sends a task_occurrences message'
);

-- 2. Topic parsing ------------------------------------------------------------

select is(
  private.household_topic_id('household:00000000-0000-0000-0000-0000000000a1'),
  '00000000-0000-0000-0000-0000000000a1'::uuid,
  'household_topic_id reads the uuid of a household topic'
);
select ok(
  private.household_topic_id('household:not-a-uuid') is null
    and private.household_topic_id('other:00000000-0000-0000-0000-0000000000a1') is null
    and private.household_topic_id('household:') is null
    and private.household_topic_id(null) is null,
  'household_topic_id returns null for anything else'
);

-- 3. Grants -------------------------------------------------------------------

select ok(
  has_function_privilege('authenticated', 'private.household_topic_id(text)', 'execute')
    and not has_function_privilege('anon', 'private.household_topic_id(text)', 'execute'),
  'only authenticated can execute household_topic_id'
);
select ok(
  not has_function_privilege('authenticated', 'private.broadcast_household_change()', 'execute')
    and not has_function_privilege('anon', 'private.broadcast_household_change()', 'execute'),
  'clients cannot execute broadcast_household_change'
);

-- 4. Policy -------------------------------------------------------------------

select pg_temp.casa_messages() as casa_total \gset

select tests.authenticate_as(:'bob');
select set_config('realtime.topic', 'household:00000000-0000-0000-0000-0000000000a1', true);

select cmp_ok(:casa_total::bigint, '>', 0::bigint, 'the household topic has messages');
select is(
  (select count(*) from realtime.messages
   where topic = 'household:00000000-0000-0000-0000-0000000000a1'),
  :casa_total::bigint,
  'a member receives the messages of their household topic'
);

select set_config('realtime.topic', 'household:00000000-0000-0000-0000-0000000000a2', true);
select is(
  (select count(*) from realtime.messages),
  0::bigint,
  'a member receives nothing on another household topic'
);

select set_config('realtime.topic', 'household:not-a-uuid', true);
select lives_ok(
  $$select count(*) from realtime.messages$$,
  'a malformed household topic does not raise'
);
select is(
  (select count(*) from realtime.messages),
  0::bigint,
  'a malformed household topic receives nothing'
);

select set_config('realtime.topic', 'other:00000000-0000-0000-0000-0000000000a1', true);
select is(
  (select count(*) from realtime.messages),
  0::bigint,
  'a topic outside household: receives nothing'
);

select tests.authenticate_as(:'carla');
select set_config('realtime.topic', 'household:00000000-0000-0000-0000-0000000000a1', true);
select is(
  (select count(*) from realtime.messages),
  0::bigint,
  'a non-member receives nothing on the household topic'
);

select * from finish();
rollback;
