-- One person, several households (bloque 12): each household's data stays its own, a person in
-- two sees each and nothing of a third, and leaving or deleting the account deals with each one.
begin;
select plan(25);

select tests.create_user('hijo@test.dev', 'Hijo') as hijo \gset
select tests.create_user('pareja@test.dev', 'Pareja') as pareja \gset
select tests.create_user('mama@test.dev', 'Mamá') as mama \gset
select tests.create_user('vecina@test.dev', 'Vecina') as vecina \gset

-- Hijo leads «Casa» (with Pareja) and «Casa de mamá» (with Mamá). Vecina leads «Otra» alone.
insert into public.households (id, name, created_by) values
  ('00000000-0000-0000-0000-0000000000a1', 'Casa', :'hijo'),
  ('00000000-0000-0000-0000-0000000000a2', 'Casa de mamá', :'hijo'),
  ('00000000-0000-0000-0000-0000000000a3', 'Otra', :'vecina');
insert into public.household_members (household_id, user_id, role, joined_at) values
  ('00000000-0000-0000-0000-0000000000a1', :'hijo', 'owner', now() - interval '2 days'),
  ('00000000-0000-0000-0000-0000000000a1', :'pareja', 'member', now() - interval '2 days'),
  ('00000000-0000-0000-0000-0000000000a2', :'hijo', 'owner', now() - interval '1 day'),
  ('00000000-0000-0000-0000-0000000000a2', :'mama', 'member', now() - interval '1 day'),
  ('00000000-0000-0000-0000-0000000000a3', :'vecina', 'owner', now());

-- Each household's content, written through the RPCs.
select tests.authenticate_as(:'hijo');
select public.create_task('00000000-0000-0000-0000-0000000000c1',
  '00000000-0000-0000-0000-0000000000a1', 'Barrer', null, :'pareja', null, null);
select public.create_task('00000000-0000-0000-0000-0000000000c2',
  '00000000-0000-0000-0000-0000000000a2', 'Pedir la receta', null, :'mama', null, null);
select public.add_shopping_item('00000000-0000-0000-0000-0000000000d1',
  '00000000-0000-0000-0000-0000000000a1', 'Leche', null);
select public.add_shopping_item('00000000-0000-0000-0000-0000000000d2',
  '00000000-0000-0000-0000-0000000000a2', 'Pan', null);
select tests.authenticate_as(:'vecina');
select public.add_shopping_item('00000000-0000-0000-0000-0000000000d3',
  '00000000-0000-0000-0000-0000000000a3', 'Sal', null);

-- Who sees what --------------------------------------------------------------

select tests.authenticate_as(:'hijo');

select is(
  (select array_agg(name order by name) from public.households),
  array['Casa', 'Casa de mamá'],
  'a person in two households sees both, and not a third'
);

select is(
  (select array_agg(name order by name) from public.shopping_items),
  array['Leche', 'Pan'],
  'and the shopping of each, nothing of the third'
);

select is(
  (select count(*) from public.task_occurrences),
  2::bigint,
  'and the tasks of each'
);

select is(
  (select count(*) from public.profiles where user_id in (:'pareja', :'mama', :'vecina')),
  2::bigint,
  'and the people of each, not those of a household they are not in'
);

select tests.authenticate_as(:'pareja');

select is(
  (select array_agg(name order by name) from public.households),
  array['Casa'],
  'a housemate in one of them sees only that one'
);

select is(
  (select array_agg(name) from public.shopping_items),
  array['Leche'],
  'and only its shopping'
);

select is(
  (select count(*) from public.task_occurrences
    where household_id = '00000000-0000-0000-0000-0000000000a2'),
  0::bigint,
  'and none of the other household''s tasks'
);

select is(
  (select count(*) from public.profiles where user_id = :'mama'),
  0::bigint,
  'sharing a person is not sharing a household: Mamá''s profile stays hidden from Pareja'
);

select is(
  (select count(*) from public.household_members
    where household_id = '00000000-0000-0000-0000-0000000000a2'),
  0::bigint,
  'nor the members of the other household'
);

select throws_ok(
  $$select public.add_shopping_item('00000000-0000-0000-0000-0000000000d4',
    '00000000-0000-0000-0000-0000000000a2', 'Huevos', null)$$,
  'P0001',
  'NOT_A_MEMBER',
  'nor can write into it'
);

-- An assignee must be in the task's household, even if they share another one with you.
select tests.authenticate_as(:'hijo');

select throws_ok(
  $$select public.create_task('00000000-0000-0000-0000-0000000000c3',
    '00000000-0000-0000-0000-0000000000a2', 'Fregar', null,
    (select user_id from public.profiles where display_name = 'Pareja'), null, null)$$,
  'P0001',
  'INVALID_ASSIGNEE',
  'a task in Casa de mamá cannot go to someone who is only in Casa'
);

-- preview_invite says whether you are already in the household ----------------

select tests.authenticate_as(:'hijo');
select token as tok_a1 from public.create_invite('00000000-0000-0000-0000-0000000000a1') \gset

select is(
  (select already_member::text || ' ' || household_id from public.preview_invite(:'tok_a1')),
  'true 00000000-0000-0000-0000-0000000000a1',
  'preview_invite says you are already in that household, and which it is'
);

select tests.authenticate_as(:'vecina');

select is(
  (select already_member from public.preview_invite(:'tok_a1')),
  false,
  'and that you are not, to someone who has another household'
);

select is(
  public.accept_invite(:'tok_a1'),
  '00000000-0000-0000-0000-0000000000a1'::uuid,
  'who then joins it while keeping their own'
);

select is(
  (select array_agg(name order by name) from public.households),
  array['Casa', 'Otra'],
  'and sees both'
);

-- set_household_rooms by household ------------------------------------------

select tests.authenticate_as(:'hijo');

select lives_ok(
  $$select public.set_household_rooms('00000000-0000-0000-0000-0000000000a2', array['kitchen'])$$,
  'set_household_rooms takes the household'
);

select is(
  (select array_agg(name order by name) from public.households where rooms = array['kitchen']),
  array['Casa de mamá'],
  'and changes only that one'
);

select tests.authenticate_as(:'pareja');

select throws_ok(
  $$select public.set_household_rooms('00000000-0000-0000-0000-0000000000a2', array['kitchen'])$$,
  'P0001',
  'NOT_A_MEMBER',
  'nobody outside the household can change its rooms'
);

-- Leaving one keeps the other -----------------------------------------------

select tests.authenticate_as(:'vecina');
select public.leave_household('00000000-0000-0000-0000-0000000000a1');

select is(
  (select array_agg(name) from public.households),
  array['Otra'],
  'leaving one household keeps the other'
);

-- delete_account with several households ------------------------------------

select tests.authenticate_as(:'hijo');

create function pg_temp.owner_must_transfer_detail() returns text
language plpgsql as $$
declare
  v_detail text;
begin
  perform public.delete_account();
  return null;
exception when sqlstate 'P0001' then
  get stacked diagnostics v_detail = pg_exception_detail;
  return sqlerrm || ' ' || v_detail;
end;
$$;

select is(
  pg_temp.owner_must_transfer_detail(),
  'OWNER_MUST_TRANSFER ["Casa", "Casa de mamá"]',
  'deleting the account while leading two shared households names both'
);

select is(
  (select count(*) from public.household_members where left_at is null),
  4::bigint,
  'and leaves nothing'
);

-- Hijo passes Casa to Pareja; Casa de mamá is still shared.
select public.transfer_ownership('00000000-0000-0000-0000-0000000000a1', :'pareja');

select is(
  pg_temp.owner_must_transfer_detail(),
  'OWNER_MUST_TRANSFER ["Casa de mamá"]',
  'after passing one, only the other is named'
);

-- Mamá leaves: Hijo leads Casa de mamá alone and is a member of Casa.
select tests.authenticate_as(:'mama');
select public.leave_household('00000000-0000-0000-0000-0000000000a2');
select tests.authenticate_as(:'hijo');

select lives_ok(
  $$select public.delete_account()$$,
  'leading only households alone, the account can go'
);

select tests.clear_auth();

select ok(
  (select deleted_at is not null from public.households
    where id = '00000000-0000-0000-0000-0000000000a2'),
  'the household led alone is deleted with it'
);

select ok(
  (select deleted_at is null from public.households
    where id = '00000000-0000-0000-0000-0000000000a1'),
  'and the other one stays, with Pareja'
);

select * from finish();
rollback;
