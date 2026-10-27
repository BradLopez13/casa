begin;
select plan(22);

select tests.create_user('ana@test.dev', 'Ana') as ana \gset
select tests.create_user('bob@test.dev', 'Bob') as bob \gset
select tests.create_user('eli@test.dev', 'Eli') as eli \gset
select tests.create_user('berta@test.dev', 'Berta') as berta \gset

insert into public.households (id, name, created_by)
values ('00000000-0000-0000-0000-0000000000a1', 'Piso 4B', :'ana');
insert into public.household_members (household_id, user_id, role)
values
  ('00000000-0000-0000-0000-0000000000a1', :'ana', 'owner'),
  ('00000000-0000-0000-0000-0000000000a1', :'bob', 'member'),
  ('00000000-0000-0000-0000-0000000000a1', :'eli', 'member');

delete from private.push_outbox;

-- set_locale ------------------------------------------------------------------

select tests.clear_auth();
select throws_ok($$select public.set_locale('en')$$, 'P0001', 'NOT_AUTHENTICATED',
                 'set_locale needs a session');
select ok(not has_function_privilege('anon', 'public.set_locale(text)', 'execute'),
          'anon cannot execute set_locale');
select ok(has_function_privilege('authenticated', 'public.set_locale(text)', 'execute'),
          'authenticated can execute set_locale');

select tests.authenticate_as(:'eli');
select lives_ok($$select public.set_locale('en')$$, 'en is accepted');
select is((select locale from public.profiles where user_id = :'eli'), 'en', 'set_locale stores the language');
select is((select locale from public.profiles where user_id = :'bob'), 'es', 'it does not touch another profile');
select throws_ok($$select public.set_locale('fr')$$, 'P0001', 'INVALID_LOCALE', 'fr is rejected');
select throws_ok($$select public.set_locale('EN')$$, 'P0001', 'INVALID_LOCALE', 'the code is lower case');
select throws_ok($$select public.set_locale(null)$$, 'P0001', 'INVALID_LOCALE', 'null is rejected');
select is((select locale from public.profiles where user_id = :'eli'), 'en', 'a rejected value keeps the stored one');
select lives_ok($$select public.set_locale('es')$$, 'es is accepted');
select public.set_locale('en');
select tests.clear_auth();

-- format_due_label by language ------------------------------------------------

select is(private.format_due_label('2026-10-15', '2026-10-11', 'en'), 'Thursday 15', 'a later day in English');
select is(private.format_due_label('2026-11-01', '2026-10-28', 'en'), 'Sunday 1', 'English day number has no leading zero');
select is(private.format_due_label('2026-10-11', '2026-10-11', 'en'), 'today', 'same day is today');
select is(private.format_due_label('2026-10-12', '2026-10-11', 'en'), 'tomorrow', 'next day is tomorrow');
select is(private.format_due_label('2026-10-15', '2026-10-11', 'es'), 'jueves 15', 'Spanish still names the day');
select is(private.format_due_label('2026-10-12', '2026-10-11'), 'mañana', 'the two-argument form stays Spanish');

-- task_assigned in the recipient's language -----------------------------------

select private.today_for(:'eli'::uuid) as eli_today \gset
select private.today_for(:'bob'::uuid) as bob_today \gset

select tests.authenticate_as(:'ana');
select public.create_task('00000000-0000-0000-0000-0000000000c1', '00000000-0000-0000-0000-0000000000a1',
  'Barrer', null, :'eli', :'eli_today'::date + 1, null);
select public.create_task('00000000-0000-0000-0000-0000000000c2', '00000000-0000-0000-0000-0000000000a1',
  'Fregar', null, :'bob', :'bob_today'::date + 1, null);
select tests.clear_auth();

select is((select title || ' | ' || body from private.push_outbox where recipient_id = :'eli' and kind = 'task_assigned'),
          'You have a new task | Barrer · tomorrow', 'an English recipient gets the English notice');
select is((select title || ' | ' || body from private.push_outbox where recipient_id = :'bob' and kind = 'task_assigned'),
          'Tienes una tarea nueva | Fregar · mañana', 'a Spanish recipient gets the Spanish notice');

-- member_joined in each recipient's language ----------------------------------

delete from private.push_outbox;
select tests.authenticate_as(:'ana');
select * from public.create_invite('00000000-0000-0000-0000-0000000000a1') \gset inv_
select tests.authenticate_as(:'berta');
select public.accept_invite(:'inv_token');
select tests.clear_auth();

select is((select title || ' | ' || body from private.push_outbox where recipient_id = :'eli' and kind = 'member_joined'),
          'Someone new at home | Berta joined Piso 4B', 'English member_joined');
select is((select title || ' | ' || body from private.push_outbox where recipient_id = :'ana' and kind = 'member_joined'),
          'Alguien nuevo en la casa | Berta se ha unido a Piso 4B', 'Spanish member_joined');
select is((select count(*) from private.push_outbox where kind = 'member_joined'), 3::bigint,
          'one row per housemate, whatever the language');

select * from finish();
rollback;
