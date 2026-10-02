begin;
create extension if not exists pgtap with schema extensions;
select plan(26);

select tests.create_user('ana@test.dev', 'Ana') as ana \gset
select tests.create_user('bob@test.dev', 'Bob') as bob \gset
select tests.create_user('gus@test.dev', 'Gus') as gus \gset

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

select * from finish();
rollback;
