begin;
select plan(30);

select tests.create_user('ana@test.dev', 'Ana') as ana \gset
select tests.create_user('bob@test.dev', 'Bob') as bob \gset
select tests.create_user('berta@test.dev', 'Berta') as berta \gset
select tests.create_user('carla@test.dev', 'Carla') as carla \gset
select tests.create_user('dani@test.dev', 'Dani') as dani \gset

insert into public.households (id, name, created_by)
values ('00000000-0000-0000-0000-0000000000a1', 'Piso 4B', :'ana');
insert into public.household_members (household_id, user_id, role, left_at)
values
  ('00000000-0000-0000-0000-0000000000a1', :'ana', 'owner', null),
  ('00000000-0000-0000-0000-0000000000a1', :'bob', 'member', null),
  ('00000000-0000-0000-0000-0000000000a1', :'carla', 'member', now());

-- The fixture itself may queue notices (Bob "joined"); start from an empty outbox.
delete from private.push_outbox;

-- Bob lives far ahead of UTC so "today" comes from his zone.
update public.profiles set time_zone = 'Pacific/Kiritimati' where user_id = :'bob';
select private.today_for(:'bob'::uuid) as bob_today \gset

-- format_due_label ------------------------------------------------------------

select is(private.format_due_label('2026-10-15', '2026-10-11'), 'jueves 15', 'a later day is named');
select is(private.format_due_label('2026-11-01', '2026-10-28'), 'domingo 1', 'the day number has no leading zero');
select is(private.format_due_label('2026-10-11', '2026-10-11'), 'hoy', 'same day is hoy');
select is(private.format_due_label('2026-10-12', '2026-10-11'), 'mañana', 'next day is mañana');

-- push_enabled follows the preference -----------------------------------------

select is(private.push_enabled(:'bob', 'member_joined'), true, 'member_joined is on without a row');
insert into public.notification_prefs (user_id, member_joined) values (:'bob', false);
select is(private.push_enabled(:'bob', 'member_joined'), false, 'member_joined off follows the preference');
select is(private.push_enabled(:'bob', 'task_assigned'), true, 'task_assigned stays on');
delete from public.notification_prefs where user_id = :'bob';

-- Assignment ------------------------------------------------------------------

select tests.authenticate_as(:'ana');
select public.create_task('00000000-0000-0000-0000-0000000000c1', '00000000-0000-0000-0000-0000000000a1',
  'Fregar', null, :'bob', :'bob_today'::date, null);
select public.create_task('00000000-0000-0000-0000-0000000000c2', '00000000-0000-0000-0000-0000000000a1',
  'Barrer', null, :'bob', :'bob_today'::date + 1, null);
select public.create_task('00000000-0000-0000-0000-0000000000c3', '00000000-0000-0000-0000-0000000000a1',
  'Regar', null, :'bob', :'bob_today'::date + 4, null);
select public.create_task('00000000-0000-0000-0000-0000000000c4', '00000000-0000-0000-0000-0000000000a1',
  'Sacar basura', null, :'bob', null, null);
select tests.clear_auth();

select is((select count(*) from private.push_outbox where recipient_id = :'bob'), 4::bigint,
          'four tasks assigned to Bob queue four rows');
select is((select body from private.push_outbox where recipient_id = :'bob' and body like 'Fregar%'),
          'Fregar · hoy', 'due today in Bob''s zone says hoy');
select is((select body from private.push_outbox where recipient_id = :'bob' and body like 'Barrer%'),
          'Barrer · mañana', 'due tomorrow says mañana');
select is((select body from private.push_outbox where recipient_id = :'bob' and body like 'Regar%'),
          'Regar · ' || private.format_due_label(:'bob_today'::date + 4, :'bob_today'::date),
          'a later day uses the weekday and number');
select is((select body from private.push_outbox where recipient_id = :'bob' and body like 'Sacar%'),
          'Sacar basura', 'no date: the body is the title');
select is((select title from private.push_outbox where recipient_id = :'bob' and body like 'Sacar%'),
          'Tienes una tarea nueva', 'the title is fixed');
select is((select data from private.push_outbox where recipient_id = :'bob' and body like 'Sacar%'),
          '{"route": "/tasks"}'::jsonb, 'the route is /tasks');

select tests.authenticate_as(:'ana');
select public.create_task('00000000-0000-0000-0000-0000000000c5', '00000000-0000-0000-0000-0000000000a1',
  'Para mí', null, :'ana', null, null);
select public.create_task('00000000-0000-0000-0000-0000000000c6', '00000000-0000-0000-0000-0000000000a1',
  'De nadie', null, null, null, null);
-- Same assignee again: no new notice.
select public.update_task('00000000-0000-0000-0000-0000000000c4', 'Sacar basura', null, :'bob', null, null);
select tests.clear_auth();
select is((select count(*) from private.push_outbox where kind = 'task_assigned'), 4::bigint,
          'self-assignment, nobody and the same assignee queue nothing');

select tests.authenticate_as(:'bob');
select public.update_task('00000000-0000-0000-0000-0000000000c4', 'Sacar basura', null, :'ana', null, null);
select tests.clear_auth();
select is((select count(*) from private.push_outbox where recipient_id = :'ana'), 1::bigint,
          'Bob reassigning to Ana queues one row for Ana');

-- A task generated by recurrence does not notify.
select tests.authenticate_as(:'ana');
select public.create_task('00000000-0000-0000-0000-0000000000c7', '00000000-0000-0000-0000-0000000000a1',
  'Diaria', null, :'bob', :'bob_today'::date, '{"kind":"interval","every":1}');
select tests.clear_auth();
select is((select count(*) from private.push_outbox where recipient_id = :'bob'), 5::bigint,
          'the recurring task itself notifies Bob once');
select tests.authenticate_as(:'bob');
select public.complete_task('00000000-0000-0000-0000-0000000000c7', :'bob_today'::date);
select tests.clear_auth();
select is((select count(*) from private.push_outbox where recipient_id = :'bob'), 5::bigint,
          'the occurrence generated on completion queues nothing');

-- Preference off.
insert into public.notification_prefs (user_id, task_assigned) values (:'bob', false);
select tests.authenticate_as(:'ana');
select public.create_task('00000000-0000-0000-0000-0000000000c8', '00000000-0000-0000-0000-0000000000a1',
  'Silenciada', null, :'bob', null, null);
select tests.clear_auth();
select is((select count(*) from private.push_outbox where recipient_id = :'bob'), 5::bigint,
          'task_assigned off queues nothing');
delete from public.notification_prefs where user_id = :'bob';

-- A person reassigning a recurrence-generated occurrence does notify.
select tests.authenticate_as(:'ana');
select public.create_task('00000000-0000-0000-0000-0000000000ca', '00000000-0000-0000-0000-0000000000a1',
  'Semanal', null, null, :'bob_today'::date, '{"kind":"interval","every":7}');
select public.complete_task('00000000-0000-0000-0000-0000000000ca', :'bob_today'::date);
select id as gen_id from public.task_occurrences
  where generated_from = '00000000-0000-0000-0000-0000000000ca' \gset
select ok(:'gen_id' is not null, 'completing created a generated occurrence');
select public.update_task(:'gen_id', 'Semanal', null, :'bob', :'bob_today'::date + 7, '{"kind":"interval","every":7}');
select tests.clear_auth();
select is((select count(*) from private.push_outbox where recipient_id = :'bob' and body like 'Semanal%'), 1::bigint,
          'reassigning a generated occurrence queues one row');

-- New members -----------------------------------------------------------------

delete from private.push_outbox;
select tests.authenticate_as(:'ana');
select * from public.create_invite('00000000-0000-0000-0000-0000000000a1') \gset inv1_
select tests.authenticate_as(:'berta');
select public.accept_invite(:'inv1_token');
select tests.clear_auth();

select is((select count(*) from private.push_outbox where kind = 'member_joined' and recipient_id in (:'ana', :'bob')),
          2::bigint, 'Berta joining queues a row for Ana and for Bob');
select is((select count(*) from private.push_outbox where recipient_id in (:'berta', :'carla')),
          0::bigint, 'nothing for Berta or for Carla who left');
select is((select distinct body from private.push_outbox where kind = 'member_joined'),
          'Berta se ha unido a Piso 4B', 'the body names the newcomer and the household');
select is((select distinct title || data::text from private.push_outbox where kind = 'member_joined'),
          'Alguien nuevo en casa{"route": "/household/members"}', 'title and route of the joined notice');

-- Creating a household queues nothing.
delete from private.push_outbox;
select tests.authenticate_as(:'dani');
select public.create_household('Casa de Dani');
select tests.clear_auth();
select is((select count(*) from private.push_outbox), 0::bigint, 'creating a household queues nothing');

-- With Bob muted, a new member only tells Ana.
insert into public.notification_prefs (user_id, member_joined) values (:'bob', false);
select tests.create_user('eva@test.dev', 'Eva') as eva \gset
insert into public.household_members (household_id, user_id, role)
values ('00000000-0000-0000-0000-0000000000a1', :'eva', 'member');
select is((select count(*) from private.push_outbox where recipient_id = :'bob'), 0::bigint,
          'Bob with member_joined off is not told');
select is((select count(*) from private.push_outbox where recipient_id = :'ana' and body like 'Eva%'), 1::bigint,
          'Ana is still told');

-- delete_account removes the recipient's pending rows -------------------------

select tests.authenticate_as(:'ana');
select public.create_task('00000000-0000-0000-0000-0000000000c9', '00000000-0000-0000-0000-0000000000a1',
  'Para Berta', null, :'berta', null, null);
select tests.clear_auth();
select is((select count(*) from private.push_outbox where recipient_id = :'berta' and kind = 'task_assigned'), 1::bigint,
          'Berta has a pending row');
select tests.authenticate_as(:'berta');
select public.delete_account();
select tests.clear_auth();
select is((select count(*) from private.push_outbox where recipient_id = :'berta'), 0::bigint,
          'delete_account removes the recipient''s pending rows');

select * from finish();
rollback;
