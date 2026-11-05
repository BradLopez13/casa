begin;
select plan(11);

-- Bloque 15.3 (P3-9): a member drops a name from «lo de siempre»; adding it again brings it back.

select tests.create_user('ana@test.dev', 'Ana') as ana \gset
select tests.create_user('bob@test.dev', 'Bob') as bob \gset
select tests.create_user('carla@test.dev', 'Carla') as carla \gset

insert into public.households (id, name, created_by)
values
  ('00000000-0000-0000-0000-0000000000c1', 'Casa', :'ana'),
  ('00000000-0000-0000-0000-0000000000c2', 'Otra', :'carla');
insert into public.household_members (household_id, user_id, role)
values
  ('00000000-0000-0000-0000-0000000000c1', :'ana', 'owner'),
  ('00000000-0000-0000-0000-0000000000c1', :'bob', 'member'),
  ('00000000-0000-0000-0000-0000000000c2', :'carla', 'owner');

insert into public.shopping_items (id, household_id, name, created_at, bought_at, cleared_at)
values
  (gen_random_uuid(), '00000000-0000-0000-0000-0000000000c1', 'Bolsa aa', now() - interval '3 days', now(), now()),
  (gen_random_uuid(), '00000000-0000-0000-0000-0000000000c1', 'Pan', now() - interval '2 days', now(), now()),
  (gen_random_uuid(), '00000000-0000-0000-0000-0000000000c1', 'Leche', now() - interval '1 day', now(), now());

-- 1-3. hiding -----------------------------------------------------------------

select tests.authenticate_as(:'bob');
select lives_ok(
  $$select public.hide_shopping_suggestion('00000000-0000-0000-0000-0000000000c1', '  BOLSA   aa ')$$,
  'any member hides a name, written any way'
);
select is(
  (select string_agg(h.normalized_name, ',' order by h.normalized_name)
   from public.shopping_history('00000000-0000-0000-0000-0000000000c1') h),
  'leche,pan',
  'the hidden name leaves the history'
);
select lives_ok(
  $$select public.hide_shopping_suggestion('00000000-0000-0000-0000-0000000000c1', 'Bolsa aa')$$,
  'hiding it again is idempotent'
);

-- 4-5. undo -------------------------------------------------------------------

select tests.authenticate_as(:'ana');
select lives_ok(
  $$select public.unhide_shopping_suggestion('00000000-0000-0000-0000-0000000000c1', 'bolsa aa')$$,
  '«Deshacer» from another member'
);
select is(
  (select count(*) from public.shopping_history('00000000-0000-0000-0000-0000000000c1')),
  3::bigint,
  'and the name is offered again'
);

-- 6-7. adding the name again shows it again -----------------------------------

select public.hide_shopping_suggestion('00000000-0000-0000-0000-0000000000c1', 'Pan');
select public.add_shopping_item(
  '00000000-0000-0000-0000-0000000000d1', '00000000-0000-0000-0000-0000000000c1', 'pan', null
);
select tests.clear_auth();
select is(
  (select count(*) from public.shopping_hidden_suggestions
   where household_id = '00000000-0000-0000-0000-0000000000c1'),
  0::bigint,
  'listing a hidden name takes it out of the hidden ones'
);
select tests.authenticate_as(:'ana');
select is(
  (select count(*) from public.shopping_history('00000000-0000-0000-0000-0000000000c1')),
  3::bigint,
  'so the history offers it again'
);

-- 8-11. who may -----------------------------------------------------------------

select tests.authenticate_as(:'carla');
select throws_ok(
  $$select public.hide_shopping_suggestion('00000000-0000-0000-0000-0000000000c1', 'Leche')$$,
  'P0001', 'NOT_A_MEMBER',
  'a non-member cannot hide'
);
select throws_ok(
  $$select public.unhide_shopping_suggestion('00000000-0000-0000-0000-0000000000c1', 'Leche')$$,
  'P0001', 'NOT_A_MEMBER',
  'nor unhide'
);
select tests.authenticate_as(:'ana');
select throws_ok(
  $$select public.hide_shopping_suggestion('00000000-0000-0000-0000-0000000000c1', '   ')$$,
  'P0001', 'INVALID_ITEM_NAME',
  'an empty name is refused'
);
select tests.clear_auth();
select throws_ok(
  $$select public.hide_shopping_suggestion('00000000-0000-0000-0000-0000000000c1', 'Leche')$$,
  'P0001', 'NOT_AUTHENTICATED',
  'and so is a call without a session'
);

select * from finish();
rollback;
