begin;
select plan(22);

-- Bloque 15.2: a pending invitation is reused (decisión 2 A), and a membership that ends says why.

select tests.create_user('ana@test.dev', 'Ana') as ana \gset
select tests.create_user('bob@test.dev', 'Bob') as bob \gset
select tests.create_user('carla@test.dev', 'Carla') as carla \gset

insert into public.households (id, name, created_by)
values ('00000000-0000-0000-0000-0000000000e1', 'Casa', :'ana');
insert into public.household_members (household_id, user_id, role)
values
  ('00000000-0000-0000-0000-0000000000e1', :'ana', 'owner'),
  ('00000000-0000-0000-0000-0000000000e1', :'bob', 'member');

-- 1-4. the same invitation twice ------------------------------------------------------

select tests.authenticate_as(:'ana');
select * from public.create_invite('00000000-0000-0000-0000-0000000000e1') \gset first_
select * from public.create_invite('00000000-0000-0000-0000-0000000000e1') \gset second_
select is(:'second_token'::text, :'first_token'::text, 'a second create_invite hands out the same token');
select is(:'second_invite_id'::uuid, :'first_invite_id'::uuid, 'and the same invitation');
select is(:'second_expires_at'::timestamptz, now() + interval '7 days', 'renewed to seven days from now');
select tests.authenticate_as(:'bob');
select * from public.create_invite('00000000-0000-0000-0000-0000000000e1') \gset bob_
select is(:'bob_token'::text, :'first_token'::text, 'another member inviting gets the same link too');

-- 4b. kept encrypted, never in the clear (decisión de Brad, 5 de noviembre de 2026) ---------

select tests.clear_auth();
select hasnt_column('private', 'invite_tokens', 'token', 'the token is not kept in the clear');
select has_column('private', 'invite_tokens', 'token_enc', 'it is kept encrypted');
select is(
  (select count(*) from private.invite_tokens t
   where position(convert_to(:'first_token', 'UTF8') in t.token_enc) > 0),
  0::bigint,
  'what is kept does not contain the token'
);
select ok(
  not has_function_privilege('authenticated', 'private.invite_token_key()', 'execute')
    and not has_function_privilege('anon', 'private.invite_token_key()', 'execute'),
  'no role of the API can get the key'
);

-- 5-6. the first link still works --------------------------------------------------------

select is(
  (select count(*) from public.household_invites
   where household_id = '00000000-0000-0000-0000-0000000000e1' and revoked_at is null),
  1::bigint,
  'nothing was revoked'
);
select tests.authenticate_as(:'carla');
select is(
  public.accept_invite(:'first_token'::text),
  '00000000-0000-0000-0000-0000000000e1'::uuid,
  'the link that was shared first lets Carla in'
);

-- 7-8. used: the next invite is a new one, and the token is forgotten ----------------------

select tests.authenticate_as(:'ana');
select * from public.create_invite('00000000-0000-0000-0000-0000000000e1') \gset third_
select isnt(:'third_token'::text, :'first_token'::text, 'once accepted, the next invite is a new one');
select tests.clear_auth();
select is(
  (select count(*) from private.invite_tokens where invite_id = :'first_invite_id'::uuid),
  0::bigint,
  'the accepted invitation keeps no token'
);

-- 9-10. revoked: a new one next time, the token forgotten ----------------------------------

select tests.authenticate_as(:'ana');
select public.revoke_invite(:'third_invite_id'::uuid);
select * from public.create_invite('00000000-0000-0000-0000-0000000000e1') \gset fourth_
select isnt(:'fourth_token'::text, :'third_token'::text, 'after «Anular invitación», the next invite is a new one');
select tests.clear_auth();
select is(
  (select count(*) from private.invite_tokens where invite_id = :'third_invite_id'::uuid),
  0::bigint,
  'the revoked invitation keeps no token'
);

-- 11b. almost expired: the same link, seven days again (revisión del PR #67) ------------------
-- An invitation with an hour left, shared again, used to die within the hour.

update public.household_invites set expires_at = now() + interval '1 hour'
where id = :'fourth_invite_id'::uuid;
select tests.authenticate_as(:'ana');
select * from public.create_invite('00000000-0000-0000-0000-0000000000e1') \gset again_
select is(:'again_token'::text, :'fourth_token'::text, 'an invitation about to expire is still reused');
select tests.clear_auth();
select is(
  (select expires_at from public.household_invites where id = :'fourth_invite_id'::uuid),
  now() + interval '7 days',
  'and it lasts seven days again from now'
);

-- 11. expired: a new one ------------------------------------------------------------------

update public.household_invites set expires_at = now() - interval '1 hour'
where id = :'fourth_invite_id'::uuid;
select tests.authenticate_as(:'ana');
select * from public.create_invite('00000000-0000-0000-0000-0000000000e1') \gset fifth_
select isnt(:'fifth_token'::text, :'fourth_token'::text, 'an expired invitation is replaced');

-- 12. the tokens are out of reach of the API ---------------------------------------------

select throws_ok(
  $$select * from private.invite_tokens$$,
  '42501',
  null,
  'authenticated cannot read the kept tokens'
);

-- 13-16. membership_end ----------------------------------------------------------------------

select tests.authenticate_as(:'carla');
select is(public.membership_end('00000000-0000-0000-0000-0000000000e1'), null, 'still in: no end');
select public.leave_household('00000000-0000-0000-0000-0000000000e1');
select is(public.membership_end('00000000-0000-0000-0000-0000000000e1'), 'left', 'left on their own');
select tests.authenticate_as(:'ana');
select public.remove_member('00000000-0000-0000-0000-0000000000e1', :'bob');
select tests.authenticate_as(:'bob');
select is(public.membership_end('00000000-0000-0000-0000-0000000000e1'), 'removed', 'taken out by the owner');
select tests.authenticate_as(:'ana');
select public.delete_household('00000000-0000-0000-0000-0000000000e1');
select tests.authenticate_as(:'bob');
select is(public.membership_end('00000000-0000-0000-0000-0000000000e1'), 'deleted', 'the household was deleted, whatever came before');

select * from finish();
rollback;
