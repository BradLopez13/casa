-- Bloque 14.4: a quantity changed offline leaves a name someone else changed (T2), and creating a
-- household twice with the same id is the same household (T8).
begin;
select plan(11);

select tests.create_user('ana@test.dev', 'Ana') as ana \gset
select tests.create_user('bea@test.dev', 'Bea') as bea \gset

-- T8 · create_household with the client's id ---------------------------------------------------

select tests.authenticate_as(:'ana');

select is(
  public.create_household('Casa', '00000000-0000-0000-0000-00000000c001'),
  '00000000-0000-0000-0000-00000000c001'::uuid,
  'a household takes the id the app gave it'
);

select is(
  public.create_household('Casa', '00000000-0000-0000-0000-00000000c001'),
  '00000000-0000-0000-0000-00000000c001'::uuid,
  'the same create sent again answers with the same household'
);

select is(
  (select count(*) from public.households where created_by = :'ana'::uuid),
  1::bigint,
  'and does not make a second one'
);

select is(
  (select count(*) from public.household_members where user_id = :'ana'::uuid and left_at is null),
  1::bigint,
  'nor a second membership'
);

select isnt(
  public.create_household('Otra'),
  null,
  'without an id the server still gives one (older builds)'
);

select tests.authenticate_as(:'bea');

select throws_ok(
  $$select public.create_household('Mía', '00000000-0000-0000-0000-00000000c001')$$,
  'P0001', 'NOT_A_MEMBER',
  'someone else''s id is not taken, nor its household opened'
);

-- T2 · update_shopping_item with no name ------------------------------------------------------

select tests.authenticate_as(:'ana');
select public.add_shopping_item(
  '00000000-0000-0000-0000-0000000000d1', '00000000-0000-0000-0000-00000000c001', 'Leche', null
);

-- Another member (here the same person, online) renames it…
select public.update_shopping_item('00000000-0000-0000-0000-0000000000d1', 'Leche sin lactosa', null);
-- …and a quantity queued offline arrives afterwards, with no name.
select public.update_shopping_item('00000000-0000-0000-0000-0000000000d1', null, '2 l');

select is(
  (select name from public.shopping_items where id = '00000000-0000-0000-0000-0000000000d1'),
  'Leche sin lactosa',
  'a quantity sent without a name leaves the name as it is'
);

select is(
  (select quantity from public.shopping_items where id = '00000000-0000-0000-0000-0000000000d1'),
  '2 l',
  'and sets the quantity'
);

select public.update_shopping_item('00000000-0000-0000-0000-0000000000d1', null, null);

select is(
  (select quantity from public.shopping_items where id = '00000000-0000-0000-0000-0000000000d1'),
  null,
  'a null quantity still clears it'
);

select throws_ok(
  $$select public.update_shopping_item('00000000-0000-0000-0000-0000000000d1', '   ', null)$$,
  'P0001', 'INVALID_ITEM_NAME',
  'a blank name is still refused'
);

select is(
  (select count(*) from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public' and p.proname = 'create_household'),
  1::bigint,
  'one create_household only, so PostgREST never has to choose'
);

select * from finish();
rollback;
