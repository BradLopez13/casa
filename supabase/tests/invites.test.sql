begin;
select plan(53);

select tests.create_user('ana@test.dev', 'Ana') as ana \gset
select tests.create_user('bob@test.dev', 'Bob') as bob \gset
select tests.create_user('gus@test.dev', 'Gus') as gus \gset
select tests.create_user('carla@test.dev', 'Carla') as carla \gset
select tests.create_user('dani@test.dev', 'Dani') as dani \gset

-- Ana (owner) and Gus (member) share a household; Bob has none.
insert into public.households (id, name, created_by)
values ('00000000-0000-0000-0000-0000000000a1', 'Casa', :'ana');
insert into public.household_members (household_id, user_id, role)
values
  ('00000000-0000-0000-0000-0000000000a1', :'ana', 'owner'),
  ('00000000-0000-0000-0000-0000000000a1', :'gus', 'member');
insert into public.household_invites (id, household_id, token_hash, created_by, expires_at)
values (
  '00000000-0000-0000-0000-0000000000b1',
  '00000000-0000-0000-0000-0000000000a1',
  'hash-fixture', :'ana', now() + interval '7 days'
);

-- Table and column privileges ------------------------------------------------

select tests.authenticate_as(:'ana');

select is(
  (select count(*) from public.household_invites where id = '00000000-0000-0000-0000-0000000000b1'),
  1::bigint,
  'member sees the invites of the household'
);

select is(
  (select created_by from public.household_invites limit 1),
  :'ana'::uuid,
  'member can read every column except token_hash'
);

select throws_ok(
  $$select token_hash from public.household_invites$$,
  '42501',
  null,
  'token_hash is not readable'
);

select throws_ok(
  $$select * from public.household_invites$$,
  '42501',
  null,
  'select * is rejected because it includes token_hash'
);

select throws_ok(
  $$insert into public.household_invites (household_id, token_hash, expires_at)
    values ('00000000-0000-0000-0000-0000000000a1', 'x', now())$$,
  '42501',
  null,
  'client cannot insert invites directly'
);

select throws_ok(
  $$update public.household_invites set revoked_at = now()$$,
  '42501',
  null,
  'client cannot update invites directly'
);

select throws_ok(
  $$delete from public.household_invites$$,
  '42501',
  null,
  'client cannot delete invites directly'
);

select tests.authenticate_as(:'bob');

select is(
  (select count(*) from public.household_invites),
  0::bigint,
  'non-member sees no invites'
);

-- create_invite ---------------------------------------------------------------

select tests.authenticate_as(:'ana');
select * from public.create_invite('00000000-0000-0000-0000-0000000000a1') \gset inv_

select is(char_length(:'inv_token'), 48, 'member creates an invite with a 48-char token');

select ok(:'inv_token' ~ '^[0-9a-f]{48}$', 'the token is lowercase hex');

select ok(
  :'inv_expires_at'::timestamptz between now() + interval '7 days' - interval '1 minute'
                                     and now() + interval '7 days' + interval '1 minute',
  'the invite expires in about 7 days'
);

select tests.clear_auth();

select is(
  (select token_hash from public.household_invites where id = :'inv_invite_id'),
  encode(extensions.digest(:'inv_token', 'sha256'), 'hex'),
  'only the sha256 of the token is stored'
);

select is(
  (select created_by from public.household_invites where id = :'inv_invite_id'),
  :'ana'::uuid,
  'the invite records its creator'
);

select tests.authenticate_as(:'bob');

select throws_ok(
  $$select public.create_invite('00000000-0000-0000-0000-0000000000a1')$$,
  'P0001',
  'NOT_A_MEMBER',
  'non-member cannot create invite'
);

select tests.clear_auth();

select throws_ok(
  $$select public.create_invite('00000000-0000-0000-0000-0000000000a1')$$,
  'P0001',
  'NOT_AUTHENTICATED',
  'create_invite without session is rejected'
);

set local role anon;

select throws_ok(
  $$select public.create_invite('00000000-0000-0000-0000-0000000000a1')$$,
  '42501',
  null,
  'anon cannot execute create_invite'
);

select throws_ok(
  $$select public.revoke_invite('00000000-0000-0000-0000-0000000000b1')$$,
  '42501',
  null,
  'anon cannot execute revoke_invite'
);

reset role;

-- revoke_invite ---------------------------------------------------------------

-- Gus (plain member) creates one; Ana (owner, not the creator) another.
select tests.authenticate_as(:'gus');
select invite_id as gus_inv from public.create_invite('00000000-0000-0000-0000-0000000000a1') \gset
select tests.authenticate_as(:'ana');
select invite_id as ana_inv from public.create_invite('00000000-0000-0000-0000-0000000000a1') \gset

select tests.authenticate_as(:'gus');

select throws_ok(
  format($$select public.revoke_invite(%L)$$, :'ana_inv'),
  'P0001',
  'NOT_OWNER',
  'plain member cannot revoke someone else''s invite'
);

select tests.authenticate_as(:'bob');

select throws_ok(
  format($$select public.revoke_invite(%L)$$, :'ana_inv'),
  'P0001',
  'INVITE_INVALID',
  'non-member gets INVITE_INVALID for an existing invite'
);

select throws_ok(
  $$select public.revoke_invite('00000000-0000-0000-0000-00000000dead')$$,
  'P0001',
  'INVITE_INVALID',
  'unknown invite id gets INVITE_INVALID'
);

select tests.clear_auth();

select throws_ok(
  format($$select public.revoke_invite(%L)$$, :'ana_inv'),
  'P0001',
  'NOT_AUTHENTICATED',
  'revoke_invite without session is rejected'
);

select tests.authenticate_as(:'gus');

select lives_ok(
  format($$select public.revoke_invite(%L)$$, :'gus_inv'),
  'the creator can revoke their own invite'
);

select tests.clear_auth();
update public.household_invites set revoked_at = timestamptz '2020-01-01 00:00:00+00' where id = :'gus_inv';
select revoked_at as gus_revoked_at from public.household_invites where id = :'gus_inv' \gset

select tests.authenticate_as(:'ana');

select lives_ok(
  format($$select public.revoke_invite(%L)$$, :'gus_inv'),
  'revoking an already revoked invite is a no-op'
);

select lives_ok(
  format($$select public.revoke_invite(%L)$$, :'ana_inv'),
  'the owner can revoke an invite created by someone else'
);

select tests.clear_auth();

select ok(
  (select revoked_at is not null from public.household_invites where id = :'ana_inv'),
  'the revoked invite is marked revoked'
);

select is(
  (select revoked_at from public.household_invites where id = :'gus_inv'),
  :'gus_revoked_at'::timestamptz,
  'a repeated revoke keeps the original revoked_at'
);

-- one active invite per household -----------------------------------------------

select tests.create_user('zoe@test.dev', 'Zoe') as zoe \gset
insert into public.households (id, name, created_by)
values ('00000000-0000-0000-0000-0000000000a2', 'Otra casa', :'zoe');
insert into public.household_members (household_id, user_id, role)
values ('00000000-0000-0000-0000-0000000000a2', :'zoe', 'owner');
insert into public.household_invites (id, household_id, token_hash, created_by, expires_at)
values ('00000000-0000-0000-0000-0000000000b2',
        '00000000-0000-0000-0000-0000000000a2', 'hash-other', :'zoe', now() + interval '7 days');
insert into public.household_invites (id, household_id, token_hash, created_by, accepted_by, accepted_at, expires_at)
values ('00000000-0000-0000-0000-0000000000b3',
        '00000000-0000-0000-0000-0000000000a1', 'hash-accepted', :'ana', :'gus', now(), now() + interval '7 days');
select accepted_at as acc_at from public.household_invites
  where id = '00000000-0000-0000-0000-0000000000b3' \gset

select tests.authenticate_as(:'ana');
select invite_id as old_inv, token as old_token from public.create_invite('00000000-0000-0000-0000-0000000000a1') \gset
-- The newest invite takes over the inv_ variables used by the accept_invite tests below.
select * from public.create_invite('00000000-0000-0000-0000-0000000000a1') \gset inv_
select tests.clear_auth();

select is(
  (select count(*) from public.household_invites
    where household_id = '00000000-0000-0000-0000-0000000000a1'
      and accepted_at is null and revoked_at is null),
  1::bigint,
  'after two create_invite calls the household has exactly one open invite'
);

select is(
  (select id from public.household_invites
    where household_id = '00000000-0000-0000-0000-0000000000a1'
      and accepted_at is null and revoked_at is null),
  :'inv_invite_id'::uuid,
  'the open invite is the newest one'
);

select ok(
  (select revoked_at is not null from public.household_invites where id = :'old_inv'),
  'the previous invite is revoked'
);

select tests.authenticate_as(:'bob');

select throws_ok(
  format($$select public.accept_invite(%L)$$, :'old_token'),
  'P0001',
  'INVITE_INVALID',
  'the token of a replaced invite can no longer be accepted'
);

select tests.clear_auth();

select ok(
  (select revoked_at is null and accepted_at is null
     from public.household_invites where id = '00000000-0000-0000-0000-0000000000b2'),
  'invites of other households are untouched'
);

select ok(
  (select accepted_at = :'acc_at'::timestamptz and revoked_at is null and accepted_by = :'gus'::uuid
     from public.household_invites where id = '00000000-0000-0000-0000-0000000000b3'),
  'an accepted invite is not modified'
);

-- accept_invite ---------------------------------------------------------------

select tests.authenticate_as(:'bob');
select public.accept_invite(:'inv_token') as accepted_hid \gset

select is(
  :'accepted_hid'::uuid,
  '00000000-0000-0000-0000-0000000000a1'::uuid,
  'accept_invite returns the id of the household'
);

select is(
  (select count(*) from public.household_members
    where user_id = :'bob' and role = 'member' and left_at is null
      and household_id = '00000000-0000-0000-0000-0000000000a1'),
  1::bigint,
  'accept joins as member'
);

select is(
  (select count(*) from public.households where id = '00000000-0000-0000-0000-0000000000a1'),
  1::bigint,
  'the new member sees the household'
);

select is(
  (select count(*) from public.profiles where user_id = :'ana'),
  1::bigint,
  'the new member sees the profile of the owner'
);

select tests.clear_auth();

select ok(
  (select accepted_by = :'bob'::uuid and accepted_at is not null
     from public.household_invites where id = :'inv_invite_id'),
  'the invite records who accepted it and when'
);

select tests.authenticate_as(:'carla');

select throws_ok(
  format($$select public.accept_invite(%L)$$, :'inv_token'),
  'P0001',
  'INVITE_INVALID',
  'invite is single use'
);

-- Idempotent retry: the same user accepting the same token again (lost response).
select tests.authenticate_as(:'bob');
select public.accept_invite(:'inv_token') as retry_hid \gset

select is(
  :'retry_hid'::uuid,
  '00000000-0000-0000-0000-0000000000a1'::uuid,
  'the same user retrying an accepted token gets the same household id'
);

select is(
  (select count(*) from public.household_members
    where user_id = :'bob' and household_id = '00000000-0000-0000-0000-0000000000a1'),
  1::bigint,
  'the retry does not add a second membership'
);

select tests.authenticate_as(:'gus');

select throws_ok(
  format($$select public.accept_invite(%L)$$, :'inv_token'),
  'P0001',
  'INVITE_INVALID',
  'a different user still gets INVITE_INVALID for an accepted token'
);

-- Joined and then left: the retry must not re-join.
select tests.clear_auth();
select tests.create_user('eva@test.dev', 'Eva') as eva \gset
select tests.authenticate_as(:'ana');
select token as eva_token from public.create_invite('00000000-0000-0000-0000-0000000000a1') \gset
select tests.authenticate_as(:'eva');
select public.accept_invite(:'eva_token');
select public.leave_household('00000000-0000-0000-0000-0000000000a1');

select throws_ok(
  format($$select public.accept_invite(%L)$$, :'eva_token'),
  'P0001',
  'INVITE_INVALID',
  'a user who accepted and then left gets INVITE_INVALID on retry'
);

select is(
  (select count(*) from public.household_members where user_id = :'eva' and left_at is null),
  0::bigint,
  'the user who left is not re-joined'
);

select throws_ok(
  $$select public.accept_invite('nope')$$,
  'P0001',
  'INVITE_INVALID',
  'garbage token'
);

-- Expired
select tests.authenticate_as(:'ana');
select token as exp_token, invite_id as exp_inv from public.create_invite('00000000-0000-0000-0000-0000000000a1') \gset
select tests.clear_auth();
update public.household_invites set expires_at = now() - interval '1 minute' where id = :'exp_inv';
select tests.authenticate_as(:'carla');

select throws_ok(
  format($$select public.accept_invite(%L)$$, :'exp_token'),
  'P0001',
  'INVITE_EXPIRED',
  'expired invite'
);

-- Revoked
select tests.authenticate_as(:'ana');
select token as rev_token, invite_id as rev_inv from public.create_invite('00000000-0000-0000-0000-0000000000a1') \gset
select public.revoke_invite(:'rev_inv'::uuid);
select tests.authenticate_as(:'carla');

select throws_ok(
  format($$select public.accept_invite(%L)$$, :'rev_token'),
  'P0001',
  'INVITE_INVALID',
  'revoked invite'
);

-- Someone already in that household cannot consume an invite; having another household is no
-- obstacle (bloque 12).
select tests.authenticate_as(:'ana');
select token as own_token, invite_id as own_inv from public.create_invite('00000000-0000-0000-0000-0000000000a1') \gset
select tests.authenticate_as(:'bob');

select throws_ok(
  format($$select public.accept_invite(%L)$$, :'own_token'),
  'P0001',
  'ALREADY_A_MEMBER',
  'accepting an invite to a household you are already in is rejected'
);

select tests.clear_auth();

select is(
  (select accepted_by from public.household_invites where id = :'own_inv'),
  null::uuid,
  'and the invite stays unused'
);

select tests.authenticate_as(:'dani');
select public.create_household('Casa de Dani') as dani_hid \gset

select lives_ok(
  format($$select public.accept_invite(%L)$$, :'own_token'),
  'someone with another household of their own can accept it'
);

-- Revoking an accepted invite does nothing
select tests.authenticate_as(:'ana');
select public.revoke_invite(:'inv_invite_id'::uuid);
select tests.clear_auth();

select ok(
  (select revoked_at is null and accepted_by = :'bob'::uuid
     from public.household_invites where id = :'inv_invite_id'),
  'revoking an accepted invite is a no-op'
);

-- Without session / anon
select throws_ok(
  $$select public.accept_invite('nope')$$,
  'P0001',
  'NOT_AUTHENTICATED',
  'accept_invite without session is rejected'
);

set local role anon;

select throws_ok(
  $$select public.accept_invite('nope')$$,
  '42501',
  null,
  'anon cannot execute accept_invite'
);

reset role;

-- Soft-deleted household: its invites die with it
select tests.create_user('hana@test.dev', 'Hana') as hana \gset
select tests.authenticate_as(:'ana');
select token as del_token from public.create_invite('00000000-0000-0000-0000-0000000000a1') \gset
select tests.clear_auth();
update public.households set deleted_at = now() where id = '00000000-0000-0000-0000-0000000000a1';
select tests.authenticate_as(:'hana');

select throws_ok(
  format($$select public.accept_invite(%L)$$, :'del_token'),
  'P0001',
  'INVITE_INVALID',
  'invite of a deleted household is invalid'
);

select tests.clear_auth();
select * from finish();
rollback;
