begin;
create extension if not exists pgtap with schema extensions;
select plan(47);

select tests.create_user('ana@test.dev', 'Ana') as ana \gset
select tests.create_user('bob@test.dev', 'Bob') as bob \gset
select tests.create_user('carla@test.dev', 'Carla') as carla \gset
select tests.create_user('eva@test.dev', 'Eva') as eva \gset
select tests.create_user('dani@test.dev', 'Dani') as dani \gset

-- Ana owns the household; Bob and Carla are members; Eva has none.
insert into public.households (id, name, created_by)
values ('00000000-0000-0000-0000-0000000000a1', 'Casa', :'ana');
insert into public.household_members (household_id, user_id, role)
values
  ('00000000-0000-0000-0000-0000000000a1', :'ana', 'owner'),
  ('00000000-0000-0000-0000-0000000000a1', :'bob', 'member'),
  ('00000000-0000-0000-0000-0000000000a1', :'carla', 'member');

-- Privileges ------------------------------------------------------------------

set local role anon;

select throws_ok(
  $$select public.leave_household('00000000-0000-0000-0000-0000000000a1')$$,
  '42501', null, 'anon cannot execute leave_household'
);

select throws_ok(
  $$select public.remove_member('00000000-0000-0000-0000-0000000000a1', gen_random_uuid())$$,
  '42501', null, 'anon cannot execute remove_member'
);

reset role;
select tests.clear_auth();

select throws_ok(
  $$select public.leave_household('00000000-0000-0000-0000-0000000000a1')$$,
  'P0001', 'NOT_AUTHENTICATED', 'leave_household without session is rejected'
);

select throws_ok(
  $$select public.remove_member('00000000-0000-0000-0000-0000000000a1', gen_random_uuid())$$,
  'P0001', 'NOT_AUTHENTICATED', 'remove_member without session is rejected'
);

-- remove_member ---------------------------------------------------------------

select tests.authenticate_as(:'bob');

select throws_ok(
  format($$update public.household_members set role = 'owner' where user_id = %L$$, :'bob'),
  '42501', null, 'member cannot promote self'
);

select throws_ok(
  format($$select public.remove_member('00000000-0000-0000-0000-0000000000a1', %L)$$, :'carla'),
  'P0001', 'NOT_OWNER', 'member cannot remove others'
);

select tests.authenticate_as(:'eva');

select throws_ok(
  format($$select public.remove_member('00000000-0000-0000-0000-0000000000a1', %L)$$, :'carla'),
  'P0001', 'NOT_OWNER', 'non-member cannot remove members'
);

select tests.authenticate_as(:'ana');

select throws_ok(
  format($$select public.remove_member('00000000-0000-0000-0000-0000000000a1', %L)$$, :'ana'),
  'P0001', 'CANNOT_REMOVE_SELF', 'owner cannot remove self'
);

select throws_ok(
  format($$select public.remove_member('00000000-0000-0000-0000-0000000000a1', %L)$$, :'eva'),
  'P0001', 'NOT_A_MEMBER', 'owner cannot remove someone who is not a member'
);

select lives_ok(
  format($$select public.remove_member('00000000-0000-0000-0000-0000000000a1', %L)$$, :'carla'),
  'owner removes member'
);

select throws_ok(
  format($$select public.remove_member('00000000-0000-0000-0000-0000000000a1', %L)$$, :'carla'),
  'P0001', 'NOT_A_MEMBER', 'removing an already removed member is NOT_A_MEMBER'
);

select tests.authenticate_as(:'carla');

select is(
  (select count(*) from public.households) + (select count(*) from public.household_members)
    + (select count(*) from public.profiles where user_id <> :'carla'),
  0::bigint,
  'removed member no longer sees the household, its members or their profiles'
);

select ok(
  public.create_household('Casa de Carla') is not null,
  'removed member can create a household of their own'
);

select tests.clear_auth();

select ok(
  (select left_at is not null from public.household_members
    where household_id = '00000000-0000-0000-0000-0000000000a1' and user_id = :'carla'),
  'the removed membership keeps its row with left_at set'
);

-- leave_household -------------------------------------------------------------

select tests.authenticate_as(:'bob');

select lives_ok(
  $$select public.leave_household('00000000-0000-0000-0000-0000000000a1')$$,
  'member can leave'
);

select is(
  (select count(*) from public.households), 0::bigint,
  'a member who left no longer sees the household'
);

select throws_ok(
  $$select public.leave_household('00000000-0000-0000-0000-0000000000a1')$$,
  'P0001', 'NOT_A_MEMBER', 'leaving twice is NOT_A_MEMBER'
);

select tests.clear_auth();

select ok(
  (select left_at is not null and role = 'member' from public.household_members
    where household_id = '00000000-0000-0000-0000-0000000000a1' and user_id = :'bob'),
  'the member who left has left_at set'
);

-- Bob comes back through a new invite.
select tests.authenticate_as(:'ana');
select token as back_token from public.create_invite('00000000-0000-0000-0000-0000000000a1') \gset
select tests.authenticate_as(:'bob');
select public.accept_invite(:'back_token');

select tests.authenticate_as(:'ana');

select throws_ok(
  $$select public.leave_household('00000000-0000-0000-0000-0000000000a1')$$,
  'P0001', 'OWNER_MUST_TRANSFER', 'owner with other members must transfer first'
);

select tests.clear_auth();

select ok(
  (select count(*) = 1 from public.household_members
    where household_id = '00000000-0000-0000-0000-0000000000a1'
      and user_id = :'ana' and role = 'owner' and left_at is null),
  'the owner is still an active owner after the rejected leave'
);

select tests.authenticate_as(:'eva');
select public.create_household('Casa de Eva') as eva_hid \gset
select public.leave_household(:'eva_hid'::uuid);
select tests.clear_auth();

select ok(
  (select deleted_at is not null from public.households where id = :'eva_hid'),
  'owner alone leaving deletes the household'
);

select ok(
  (select count(*) = 0 from public.household_members
    where household_id = :'eva_hid' and left_at is null),
  'owner alone leaving leaves no active members'
);

select tests.authenticate_as(:'eva');

select ok(
  public.create_household('Otra casa de Eva') is not null,
  'the former owner can create a new household'
);


-- transfer_ownership ----------------------------------------------------------
-- State now: Ana owner, Bob member (Carla left, Eva's households are deleted).

select tests.clear_auth();

select throws_ok(
  format($$select public.transfer_ownership('00000000-0000-0000-0000-0000000000a1', %L)$$, :'bob'),
  'P0001', 'NOT_AUTHENTICATED', 'transfer_ownership without session is rejected'
);

select throws_ok(
  $$select public.delete_household('00000000-0000-0000-0000-0000000000a1')$$,
  'P0001', 'NOT_AUTHENTICATED', 'delete_household without session is rejected'
);

set local role anon;

select throws_ok(
  $$select public.transfer_ownership('00000000-0000-0000-0000-0000000000a1', gen_random_uuid())$$,
  '42501', null, 'anon cannot execute transfer_ownership'
);

select throws_ok(
  $$select public.delete_household('00000000-0000-0000-0000-0000000000a1')$$,
  '42501', null, 'anon cannot execute delete_household'
);

reset role;

select tests.authenticate_as(:'bob');

select throws_ok(
  format($$select public.transfer_ownership('00000000-0000-0000-0000-0000000000a1', %L)$$, :'bob'),
  'P0001', 'NOT_OWNER', 'member cannot transfer ownership'
);

select throws_ok(
  $$select public.delete_household('00000000-0000-0000-0000-0000000000a1')$$,
  'P0001', 'NOT_OWNER', 'member cannot delete the household'
);

select tests.authenticate_as(:'dani');

select throws_ok(
  $$select public.delete_household('00000000-0000-0000-0000-0000000000a1')$$,
  'P0001', 'NOT_OWNER', 'non-member cannot delete the household'
);

select tests.authenticate_as(:'ana');

select throws_ok(
  format($$select public.transfer_ownership('00000000-0000-0000-0000-0000000000a1', %L)$$, :'dani'),
  'P0001', 'NOT_A_MEMBER', 'cannot transfer to someone who is not a member'
);

select throws_ok(
  format($$select public.transfer_ownership('00000000-0000-0000-0000-0000000000a1', %L)$$, :'carla'),
  'P0001', 'NOT_A_MEMBER', 'cannot transfer to someone who left'
);

select lives_ok(
  format($$select public.transfer_ownership('00000000-0000-0000-0000-0000000000a1', %L)$$, :'ana'),
  'transferring to yourself is a no-op'
);

select is(
  (select role from public.household_members
    where household_id = '00000000-0000-0000-0000-0000000000a1' and user_id = :'ana' and left_at is null),
  'owner',
  'the owner is still owner after transferring to self'
);

select lives_ok(
  format($$select public.transfer_ownership('00000000-0000-0000-0000-0000000000a1', %L)$$, :'bob'),
  'owner transfers ownership to a member'
);

select tests.clear_auth();

select is(
  (select role from public.household_members
    where household_id = '00000000-0000-0000-0000-0000000000a1' and user_id = :'bob' and left_at is null),
  'owner',
  'the new owner is owner'
);

select is(
  (select role from public.household_members
    where household_id = '00000000-0000-0000-0000-0000000000a1' and user_id = :'ana' and left_at is null),
  'member',
  'the former owner is now a member'
);

select is(
  (select count(*) from public.household_members
    where household_id = '00000000-0000-0000-0000-0000000000a1'
      and role = 'owner' and left_at is null),
  1::bigint,
  'exactly one active owner after the transfer'
);

select tests.authenticate_as(:'ana');

select throws_ok(
  format($$select public.remove_member('00000000-0000-0000-0000-0000000000a1', %L)$$, :'bob'),
  'P0001', 'NOT_OWNER', 'the former owner has lost owner powers'
);

-- delete_household ------------------------------------------------------------

select tests.authenticate_as(:'bob');
select token as del_token, invite_id as del_inv from public.create_invite('00000000-0000-0000-0000-0000000000a1') \gset
select public.delete_household('00000000-0000-0000-0000-0000000000a1');
select tests.clear_auth();

select is(
  (select count(*) from public.household_members
    where household_id = '00000000-0000-0000-0000-0000000000a1' and left_at is null),
  0::bigint,
  'delete leaves no active members'
);

select ok(
  (select deleted_at is not null from public.households
    where id = '00000000-0000-0000-0000-0000000000a1'),
  'delete sets deleted_at on the household'
);

select ok(
  (select revoked_at is not null from public.household_invites where id = :'del_inv'),
  'delete revokes the active invites'
);

select is(
  (select count(*) from public.household_members
    where household_id = '00000000-0000-0000-0000-0000000000a1'),
  4::bigint,
  'delete is soft: no membership row disappears'
);

select tests.authenticate_as(:'ana');

select is(
  (select count(*) from public.households), 0::bigint,
  'a former member sees no household after the delete'
);

select throws_ok(
  $$select public.delete_household('00000000-0000-0000-0000-0000000000a1')$$,
  'P0001', 'NOT_OWNER', 'deleting an already deleted household is NOT_OWNER'
);

select ok(
  public.create_household('Nueva de Ana') is not null,
  'a former member can create a new household after the delete'
);

select tests.authenticate_as(:'bob');

select ok(
  public.create_household('Nueva de Bob') is not null,
  'the former owner can create a new household after the delete'
);

select tests.clear_auth();
select * from finish();
rollback;
