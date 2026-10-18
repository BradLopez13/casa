begin;
select plan(29);

select tests.create_user('ana@test.dev', 'Ana') as ana \gset
select tests.create_user('bob@test.dev', 'Bob') as bob \gset
select tests.create_user('carla@test.dev', 'Carla') as carla \gset
select tests.create_user('dora@test.dev', 'Dora') as dora \gset

-- Ana owns Casa (Bob is a member); Carla owns Otra; Dora has no household.
insert into public.households (id, name, created_by)
values
  ('00000000-0000-0000-0000-0000000000a1', 'Casa', :'ana'),
  ('00000000-0000-0000-0000-0000000000a2', 'Otra', :'carla');
insert into public.household_members (household_id, user_id, role)
values
  ('00000000-0000-0000-0000-0000000000a1', :'ana', 'owner'),
  ('00000000-0000-0000-0000-0000000000a1', :'bob', 'member'),
  ('00000000-0000-0000-0000-0000000000a2', :'carla', 'owner');

-- 1. set_item_category ----------------------------------------------------------

select tests.authenticate_as(:'ana');
select public.add_shopping_item(
  '00000000-0000-0000-0000-0000000000b1', '00000000-0000-0000-0000-0000000000a1',
  'Leche de avena', null
);

select public.set_item_category('00000000-0000-0000-0000-0000000000b1', 'drinks');
select is(
  (select category from public.shopping_items where id = '00000000-0000-0000-0000-0000000000b1'),
  'drinks',
  'set_item_category sets the item category'
);
select is(
  (select category from public.household_item_categories
   where household_id = '00000000-0000-0000-0000-0000000000a1'
     and normalized_name = 'leche de avena'),
  'drinks',
  'and remembers it for the household under the normalized name'
);

select public.set_item_category('00000000-0000-0000-0000-0000000000b1', 'dairy_eggs');
select is(
  (select category from public.shopping_items where id = '00000000-0000-0000-0000-0000000000b1'),
  'dairy_eggs',
  'a later call replaces the item category'
);
select is(
  (select count(*) from public.household_item_categories
   where household_id = '00000000-0000-0000-0000-0000000000a1'),
  1::bigint,
  'one correction per name, replaced in place'
);
select lives_ok(
  $$select public.set_item_category('00000000-0000-0000-0000-0000000000b1', 'dairy_eggs')$$,
  'repeating the same category is a no-op'
);

select throws_ok(
  $$select public.set_item_category('00000000-0000-0000-0000-0000000000b1', 'fruit')$$,
  'P0001', 'INVALID_CATEGORY', 'an unknown category is rejected'
);
select throws_ok(
  $$select public.set_item_category('00000000-0000-0000-0000-0000000000b1', null)$$,
  'P0001', 'INVALID_CATEGORY', 'a null category is rejected'
);
select throws_ok(
  $$select public.set_item_category('00000000-0000-0000-0000-0000000000ff', 'drinks')$$,
  'P0001', 'ITEM_NOT_FOUND', 'a missing item is ITEM_NOT_FOUND'
);

-- 2. The correction is reused in the household ---------------------------------------

select tests.authenticate_as(:'bob');
select is(
  (select count(*) from public.household_item_categories
   where household_id = '00000000-0000-0000-0000-0000000000a1'),
  1::bigint,
  'another member reads the correction'
);

select public.set_item_bought('00000000-0000-0000-0000-0000000000b1', true);
select public.add_shopping_item(
  '00000000-0000-0000-0000-0000000000b2', '00000000-0000-0000-0000-0000000000a1',
  '  LECHE de Ávena ', null
);
select is(
  (select category from public.shopping_items where id = '00000000-0000-0000-0000-0000000000b2'),
  'dairy_eggs',
  'adding the same name again takes the correction'
);

select public.add_shopping_item(
  '00000000-0000-0000-0000-0000000000b3', '00000000-0000-0000-0000-0000000000a1', 'Pan', null
);
select is(
  (select category from public.shopping_items where id = '00000000-0000-0000-0000-0000000000b3'),
  null::text,
  'a name without a correction is added without a category'
);

-- A rename takes the new name's correction; an edit that keeps the name keeps the category.
select public.set_item_category('00000000-0000-0000-0000-0000000000b3', 'bakery');
select public.set_item_bought('00000000-0000-0000-0000-0000000000b3', true);
select public.add_shopping_item(
  '00000000-0000-0000-0000-0000000000b4', '00000000-0000-0000-0000-0000000000a1', 'Barra', null
);
select public.set_item_category('00000000-0000-0000-0000-0000000000b4', 'frozen');
select public.update_shopping_item('00000000-0000-0000-0000-0000000000b4', 'Pan', null);
select is(
  (select category from public.shopping_items where id = '00000000-0000-0000-0000-0000000000b4'),
  'bakery',
  'a rename takes the new name''s correction'
);
select public.set_item_category('00000000-0000-0000-0000-0000000000b4', 'pantry');
select public.update_shopping_item('00000000-0000-0000-0000-0000000000b4', 'pan', '2');
select is(
  (select category from public.shopping_items where id = '00000000-0000-0000-0000-0000000000b4'),
  'pantry',
  'an edit that keeps the name keeps the category'
);

select is(
  (select category from public.shopping_history('00000000-0000-0000-0000-0000000000a1')
   where normalized_name = 'leche de avena'),
  'dairy_eggs',
  'shopping_history carries the category'
);

-- 3. Other households -----------------------------------------------------------------

select tests.authenticate_as(:'carla');
select is(
  (select count(*) from public.household_item_categories
   where household_id = '00000000-0000-0000-0000-0000000000a1'),
  0::bigint,
  'another household does not see the corrections'
);
select throws_ok(
  $$select public.set_item_category('00000000-0000-0000-0000-0000000000b2', 'drinks')$$,
  'P0001', 'ITEM_NOT_FOUND', 'a non-member cannot recategorise an item'
);
select public.add_shopping_item(
  '00000000-0000-0000-0000-0000000000c1', '00000000-0000-0000-0000-0000000000a2',
  'Leche de avena', null
);
select is(
  (select category from public.shopping_items where id = '00000000-0000-0000-0000-0000000000c1'),
  null::text,
  'a correction does not cross households'
);
select throws_ok(
  $$insert into public.household_item_categories (household_id, normalized_name, category)
    values ('00000000-0000-0000-0000-0000000000a2', 'sal', 'pantry')$$,
  '42501', null, 'client cannot write household_item_categories'
);

-- 4. set_category_order -----------------------------------------------------------------

select public.set_category_order(array['drinks', 'produce']);
select is(
  (select category_order from public.households where id = '00000000-0000-0000-0000-0000000000a2'),
  array['drinks', 'produce']::text[],
  'set_category_order stores the household order'
);
select throws_ok(
  $$select public.set_category_order(array['drinks', 'fruit'])$$,
  'P0001', 'INVALID_CATEGORY', 'an unknown category in the order is rejected'
);
select throws_ok(
  $$select public.set_category_order(array['drinks', 'drinks'])$$,
  'P0001', 'INVALID_CATEGORY', 'a repeated category is rejected'
);
select throws_ok(
  $$select public.set_category_order(array['drinks', null])$$,
  'P0001', 'INVALID_CATEGORY', 'a null in the order is rejected'
);
select public.set_category_order('{}'::text[]);
select is(
  (select category_order from public.households where id = '00000000-0000-0000-0000-0000000000a2'),
  null::text[],
  'an empty order goes back to the default'
);

select tests.authenticate_as(:'dora');
select throws_ok(
  $$select public.set_category_order(array['drinks'])$$,
  'P0001', 'NOT_A_MEMBER', 'set_category_order needs a household'
);

-- 5. Sessions, constraints and grants ------------------------------------------------------

select tests.clear_auth();
select throws_ok(
  $$select public.set_item_category('00000000-0000-0000-0000-0000000000b2', 'drinks')$$,
  'P0001', 'NOT_AUTHENTICATED', 'set_item_category needs a session'
);
select throws_ok(
  $$select public.set_category_order(array['drinks'])$$,
  'P0001', 'NOT_AUTHENTICATED', 'set_category_order needs a session'
);
select throws_ok(
  $$update public.shopping_items set category = 'fruit'
    where id = '00000000-0000-0000-0000-0000000000b2'$$,
  '23514', null, 'the item category is checked by the table'
);
select throws_ok(
  $$update public.households set category_order = array['produce', 'produce']
    where id = '00000000-0000-0000-0000-0000000000a1'$$,
  '23514', null, 'the household order is checked by the table'
);
select ok(
  not has_function_privilege('anon', 'public.set_item_category(uuid, text)', 'execute')
    and not has_function_privilege('anon', 'public.set_category_order(text[])', 'execute'),
  'anon cannot execute the category RPCs'
);

select * from finish();
rollback;
