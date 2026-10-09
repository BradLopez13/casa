begin;
select plan(46);

select tests.create_user('ana@test.dev', 'Ana') as ana \gset
select tests.create_user('bob@test.dev', 'Bob') as bob \gset
select tests.create_user('carla@test.dev', 'Carla') as carla \gset
select tests.create_user('gus@test.dev', 'Gus') as gus \gset
select tests.create_user('dora@test.dev', 'Dora') as dora \gset
select tests.create_user('eva@test.dev', 'Eva') as eva \gset

-- Ana owns Casa (Bob is a member); Carla owns Otra; Gus owns a soft-deleted household;
-- Dora and Eva own the two history households.
insert into public.households (id, name, created_by, deleted_at)
values
  ('00000000-0000-0000-0000-0000000000a1', 'Casa', :'ana', null),
  ('00000000-0000-0000-0000-0000000000a2', 'Otra', :'carla', null),
  ('00000000-0000-0000-0000-0000000000a3', 'Borrada', :'gus', now()),
  ('00000000-0000-0000-0000-0000000000a4', 'Historial', :'dora', null),
  ('00000000-0000-0000-0000-0000000000a5', 'Muchos', :'eva', null);
insert into public.household_members (household_id, user_id, role)
values
  ('00000000-0000-0000-0000-0000000000a1', :'ana', 'owner'),
  ('00000000-0000-0000-0000-0000000000a1', :'bob', 'member'),
  ('00000000-0000-0000-0000-0000000000a2', :'carla', 'owner'),
  ('00000000-0000-0000-0000-0000000000a3', :'gus', 'owner'),
  ('00000000-0000-0000-0000-0000000000a4', :'dora', 'owner'),
  ('00000000-0000-0000-0000-0000000000a5', :'eva', 'owner');

insert into public.shopping_items (id, household_id, name, created_by)
values
  ('00000000-0000-0000-0000-0000000000b9', '00000000-0000-0000-0000-0000000000a2', 'Arroz', :'carla'),
  ('00000000-0000-0000-0000-0000000000b8', '00000000-0000-0000-0000-0000000000a3', 'Viejo', :'gus');

-- History fixtures: written forms and dates under control.
insert into public.shopping_items (id, household_id, name, created_at, bought_at, cleared_at)
values
  (gen_random_uuid(), '00000000-0000-0000-0000-0000000000a4', 'Pan', now() - interval '10 days', now(), now()),
  (gen_random_uuid(), '00000000-0000-0000-0000-0000000000a4', 'PAN', now() - interval '1 day', null, null),
  (gen_random_uuid(), '00000000-0000-0000-0000-0000000000a4', 'Sal', now() - interval '5 days', now(), now()),
  (gen_random_uuid(), '00000000-0000-0000-0000-0000000000a4', 'sal', now() - interval '4 days', now(), now()),
  (gen_random_uuid(), '00000000-0000-0000-0000-0000000000a4', 'Huevos', now() - interval '2 days', null, null),
  (gen_random_uuid(), '00000000-0000-0000-0000-0000000000a4', 'Café', now() - interval '3 days', now(), now());
insert into public.shopping_items (id, household_id, name)
select gen_random_uuid(), '00000000-0000-0000-0000-0000000000a5', 'producto ' || n
from generate_series(1, 301) as n;

-- 1. Reads --------------------------------------------------------------------

select tests.authenticate_as(:'ana');

select is(
  (select count(*) from public.shopping_items
   where household_id = '00000000-0000-0000-0000-0000000000a2'),
  0::bigint,
  'a non-member reads no rows of another household'
);

-- 2. No direct writes ---------------------------------------------------------

select throws_ok(
  $$insert into public.shopping_items (id, household_id, name) values (gen_random_uuid(), '00000000-0000-0000-0000-0000000000a1', 'x')$$,
  '42501', null, 'client cannot insert shopping_items'
);
select throws_ok(
  $$update public.shopping_items set name = 'y'$$,
  '42501', null, 'client cannot update shopping_items'
);
select throws_ok(
  $$delete from public.shopping_items$$,
  '42501', null, 'client cannot delete shopping_items'
);

-- 3-6. add_shopping_item ------------------------------------------------------

select is(
  public.add_shopping_item('00000000-0000-0000-0000-0000000000d1', '00000000-0000-0000-0000-0000000000a1', 'Leche', ' 2 l '),
  '00000000-0000-0000-0000-0000000000d1'::uuid,
  'add returns its p_id'
);
select is(
  (select name || '|' || normalized_name || '|' || quantity || '|' || (created_by = :'ana')
   from public.shopping_items where id = '00000000-0000-0000-0000-0000000000d1'),
  'Leche|leche|2 l|true',
  'add inserts the item with trimmed quantity and its author'
);

select is(
  public.add_shopping_item('00000000-0000-0000-0000-0000000000d1', '00000000-0000-0000-0000-0000000000a1', 'Otra cosa', null),
  '00000000-0000-0000-0000-0000000000d1'::uuid,
  'repeating add with the same p_id returns p_id'
);
select is(
  (select count(*) from public.shopping_items
   where household_id = '00000000-0000-0000-0000-0000000000a1'),
  1::bigint,
  'repeating add with the same p_id creates no second row'
);

select is(
  public.add_shopping_item('00000000-0000-0000-0000-0000000000d2', '00000000-0000-0000-0000-0000000000a1', 'leche ', null),
  '00000000-0000-0000-0000-0000000000d1'::uuid,
  '"leche " returns the pending "Leche"'
);
select is(
  public.add_shopping_item('00000000-0000-0000-0000-0000000000d3', '00000000-0000-0000-0000-0000000000a1', 'LÉCHE', null),
  '00000000-0000-0000-0000-0000000000d1'::uuid,
  '"LÉCHE" returns the pending "Leche"'
);
select is(
  (select count(*) from public.shopping_items
   where household_id = '00000000-0000-0000-0000-0000000000a1'),
  1::bigint,
  'merged adds leave a single pending item'
);

select is(
  public.add_shopping_item('00000000-0000-0000-0000-0000000000d6', '00000000-0000-0000-0000-0000000000a1', chr(160) || chr(9) || 'Pan  bimbo ' || chr(160), '  '),
  '00000000-0000-0000-0000-0000000000d6'::uuid,
  'add accepts a name padded with the pinned whitespace class'
);
select is(
  (select name || '|' || normalized_name || '|' || coalesce(quantity, 'null')
   from public.shopping_items where id = '00000000-0000-0000-0000-0000000000d6'),
  'Pan  bimbo|pan bimbo|null',
  'the name is trimmed by the pinned class and a blank quantity becomes null'
);

select throws_ok(
  $$select public.add_shopping_item(gen_random_uuid(), '00000000-0000-0000-0000-0000000000a1', '   ', null)$$,
  'P0001', 'INVALID_ITEM_NAME', 'a blank name is INVALID_ITEM_NAME'
);
select throws_ok(
  $$select public.add_shopping_item(gen_random_uuid(), '00000000-0000-0000-0000-0000000000a1', null, null)$$,
  'P0001', 'INVALID_ITEM_NAME', 'a null name is INVALID_ITEM_NAME'
);
select throws_ok(
  $$select public.add_shopping_item(gen_random_uuid(), '00000000-0000-0000-0000-0000000000a1', repeat('a', 61), null)$$,
  'P0001', 'INVALID_ITEM_NAME', 'a 61-character name is INVALID_ITEM_NAME'
);
select is(
  public.add_shopping_item('00000000-0000-0000-0000-0000000000d7', '00000000-0000-0000-0000-0000000000a1', repeat('ñ', 60), repeat('é', 20)),
  '00000000-0000-0000-0000-0000000000d7'::uuid,
  '60 code points of name and 20 of quantity are accepted'
);
select throws_ok(
  $$select public.add_shopping_item(gen_random_uuid(), '00000000-0000-0000-0000-0000000000a1', 'Agua', repeat('x', 21))$$,
  'P0001', 'INVALID_QUANTITY', 'a 21-character quantity is INVALID_QUANTITY'
);
select throws_ok(
  $$select public.add_shopping_item(gen_random_uuid(), '00000000-0000-0000-0000-0000000000a2', 'Agua', null)$$,
  'P0001', 'NOT_A_MEMBER', 'adding to another household is NOT_A_MEMBER'
);
select throws_ok(
  $$select public.add_shopping_item('00000000-0000-0000-0000-0000000000b9', '00000000-0000-0000-0000-0000000000a1', 'Arroz', null)$$,
  'P0001', 'ITEM_NOT_FOUND', 'a p_id that exists in another household is ITEM_NOT_FOUND'
);

select tests.authenticate_as(:'gus');
select throws_ok(
  $$select public.add_shopping_item(gen_random_uuid(), '00000000-0000-0000-0000-0000000000a3', 'Agua', null)$$,
  'P0001', 'NOT_A_MEMBER', 'adding to a deleted household is NOT_A_MEMBER'
);
select throws_ok(
  $$select public.set_item_bought('00000000-0000-0000-0000-0000000000b8', true)$$,
  'P0001', 'ITEM_NOT_FOUND', 'marking an item of a deleted household is ITEM_NOT_FOUND'
);

-- 7-9. set_item_bought --------------------------------------------------------

select tests.authenticate_as(:'bob');
select public.set_item_bought('00000000-0000-0000-0000-0000000000d1', true);
select tests.authenticate_as(:'ana');
select public.set_item_bought('00000000-0000-0000-0000-0000000000d1', true);

select is(
  (select bought_by from public.shopping_items where id = '00000000-0000-0000-0000-0000000000d1'),
  :'bob'::uuid,
  'marking bought twice keeps the first buyer'
);

select public.set_item_bought('00000000-0000-0000-0000-0000000000d1', false);
select is(
  (select bought_at is null and bought_by is null
   from public.shopping_items where id = '00000000-0000-0000-0000-0000000000d1'),
  true,
  'unmarking clears bought_at and bought_by'
);

select public.set_item_bought('00000000-0000-0000-0000-0000000000d1', true);
select is(
  public.add_shopping_item('00000000-0000-0000-0000-0000000000d4', '00000000-0000-0000-0000-0000000000a1', 'leche', null),
  '00000000-0000-0000-0000-0000000000d4'::uuid,
  'a bought item does not absorb a new add of the same name'
);
select lives_ok(
  $$select public.set_item_bought('00000000-0000-0000-0000-0000000000d1', false)$$,
  'unmarking when the name is pending again does not fail'
);
select is(
  (select bought_at is not null
   from public.shopping_items where id = '00000000-0000-0000-0000-0000000000d1'),
  true,
  'unmarking when the name is pending again changes nothing'
);

select throws_ok(
  $$select public.set_item_bought(gen_random_uuid(), true)$$,
  'P0001', 'ITEM_NOT_FOUND', 'marking a missing item is ITEM_NOT_FOUND'
);
select throws_ok(
  $$select public.set_item_bought('00000000-0000-0000-0000-0000000000b9', true)$$,
  'P0001', 'ITEM_NOT_FOUND', 'marking an item of another household is ITEM_NOT_FOUND'
);

-- 10-11. update_shopping_item -------------------------------------------------

select public.add_shopping_item('00000000-0000-0000-0000-0000000000d5', '00000000-0000-0000-0000-0000000000a1', 'Pan', null);

select throws_ok(
  $$select public.update_shopping_item('00000000-0000-0000-0000-0000000000d5', 'LECHE', null)$$,
  'P0001', 'ITEM_ALREADY_LISTED', 'renaming to a pending name is ITEM_ALREADY_LISTED'
);
select lives_ok(
  $$select public.update_shopping_item('00000000-0000-0000-0000-0000000000d5', ' PAN ', ' 1 barra ')$$,
  'renaming to its own normalized name is fine'
);
select is(
  (select name || '|' || quantity from public.shopping_items where id = '00000000-0000-0000-0000-0000000000d5'),
  'PAN|1 barra',
  'update stores the trimmed name and quantity'
);
select throws_ok(
  $$select public.update_shopping_item('00000000-0000-0000-0000-0000000000d1', 'Leche entera', null)$$,
  'P0001', 'ITEM_NOT_FOUND', 'updating a bought item is ITEM_NOT_FOUND'
);
select throws_ok(
  $$select public.update_shopping_item('00000000-0000-0000-0000-0000000000d5', '', null)$$,
  'P0001', 'INVALID_ITEM_NAME', 'updating to a blank name is INVALID_ITEM_NAME'
);
select throws_ok(
  $$select public.update_shopping_item('00000000-0000-0000-0000-0000000000d5', 'Pan', repeat('x', 21))$$,
  'P0001', 'INVALID_QUANTITY', 'updating to a 21-character quantity is INVALID_QUANTITY'
);
select throws_ok(
  $$select public.update_shopping_item('00000000-0000-0000-0000-0000000000b9', 'Arroz', null)$$,
  'P0001', 'ITEM_NOT_FOUND', 'updating an item of another household is ITEM_NOT_FOUND'
);

-- 12. delete_shopping_item ----------------------------------------------------

select tests.authenticate_as(:'bob');
select public.delete_shopping_item('00000000-0000-0000-0000-0000000000d5');
select is(
  (select count(*) from public.shopping_items where id = '00000000-0000-0000-0000-0000000000d5'),
  0::bigint,
  'any member deletes an item'
);
select throws_ok(
  $$select public.delete_shopping_item('00000000-0000-0000-0000-0000000000b9')$$,
  'P0001', 'ITEM_NOT_FOUND', 'deleting an item of another household is ITEM_NOT_FOUND'
);

-- 13. clear_bought_items ------------------------------------------------------

select public.clear_bought_items('00000000-0000-0000-0000-0000000000a1');
select is(
  (select string_agg(id::text || '=' || (cleared_at is not null), ',' order by id)
   from public.shopping_items where household_id = '00000000-0000-0000-0000-0000000000a1'),
  '00000000-0000-0000-0000-0000000000d1=true,00000000-0000-0000-0000-0000000000d4=false,'
  || '00000000-0000-0000-0000-0000000000d6=false,00000000-0000-0000-0000-0000000000d7=false',
  'clear_bought_items archives only bought items'
);
select lives_ok(
  $$select public.set_item_bought('00000000-0000-0000-0000-0000000000d1', false)$$,
  'unmarking an archived item does not fail'
);
select is(
  (select bought_at is not null from public.shopping_items where id = '00000000-0000-0000-0000-0000000000d1'),
  true,
  'unmarking an archived item changes nothing'
);
select throws_ok(
  $$select public.clear_bought_items('00000000-0000-0000-0000-0000000000a2')$$,
  'P0001', 'NOT_A_MEMBER', 'clearing another household is NOT_A_MEMBER'
);

-- 14-15. shopping_history -----------------------------------------------------

select tests.authenticate_as(:'dora');
select is(
  (select string_agg(h.name || ':' || h.normalized_name || ':' || h.uses, ',' order by h.ord)
   from public.shopping_history('00000000-0000-0000-0000-0000000000a4') with ordinality as h(name, normalized_name, uses, last_used_at, ord)),
  'PAN:pan:2,sal:sal:2,Huevos:huevos:1,Café:cafe:1',
  'history groups by normalized name, keeps the last written form and orders by uses then recency'
);
select is(
  (select h.last_used_at from public.shopping_history('00000000-0000-0000-0000-0000000000a4') h
   where h.normalized_name = 'pan'),
  (select max(created_at) from public.shopping_items
   where household_id = '00000000-0000-0000-0000-0000000000a4' and normalized_name = 'pan'),
  'last_used_at is the latest use'
);
select tests.authenticate_as(:'eva');
select is(
  (select count(*) from public.shopping_history('00000000-0000-0000-0000-0000000000a5')),
  300::bigint,
  'history returns at most 300 names'
);
select throws_ok(
  $$select * from public.shopping_history('00000000-0000-0000-0000-0000000000a2')$$,
  'P0001', 'NOT_A_MEMBER', 'history of another household is NOT_A_MEMBER'
);

select * from finish();
rollback;
