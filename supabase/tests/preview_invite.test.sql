begin;
select plan(14);

select tests.create_user('ana@test.dev', 'Ana') as ana \gset
select tests.create_user('gus@test.dev', 'Gus') as gus \gset
select tests.create_user('leo@test.dev', 'Leo') as leo \gset
select tests.create_user('bob@test.dev', 'Bob') as bob \gset

-- Ana (owner) and Gus share Casa; Leo was a member and left. Bob has no household.
insert into public.households (id, name, created_by)
values
  ('00000000-0000-0000-0000-0000000000a1', 'Casa', :'ana'),
  ('00000000-0000-0000-0000-0000000000a2', 'Piso viejo', :'ana');
update public.households set deleted_at = now() where id = '00000000-0000-0000-0000-0000000000a2';
insert into public.household_members (household_id, user_id, role, left_at)
values
  ('00000000-0000-0000-0000-0000000000a1', :'ana', 'owner', null),
  ('00000000-0000-0000-0000-0000000000a1', :'gus', 'member', null),
  ('00000000-0000-0000-0000-0000000000a1', :'leo', 'member', now());

insert into public.household_invites
  (household_id, token_hash, created_by, expires_at, revoked_at, accepted_by, accepted_at)
values
  ('00000000-0000-0000-0000-0000000000a1', encode(extensions.digest('tok-ok', 'sha256'), 'hex'),
   :'ana', now() + interval '7 days', null, null, null),
  ('00000000-0000-0000-0000-0000000000a1', encode(extensions.digest('tok-anon', 'sha256'), 'hex'),
   null, now() + interval '7 days', null, null, null),
  ('00000000-0000-0000-0000-0000000000a1', encode(extensions.digest('tok-revoked', 'sha256'), 'hex'),
   :'ana', now() + interval '7 days', now(), null, null),
  ('00000000-0000-0000-0000-0000000000a1', encode(extensions.digest('tok-used', 'sha256'), 'hex'),
   :'ana', now() + interval '7 days', null, :'gus', now()),
  ('00000000-0000-0000-0000-0000000000a1', encode(extensions.digest('tok-old', 'sha256'), 'hex'),
   :'ana', now() - interval '1 minute', null, null, null),
  ('00000000-0000-0000-0000-0000000000a2', encode(extensions.digest('tok-gone', 'sha256'), 'hex'),
   :'ana', now() + interval '7 days', null, null, null);

select tests.authenticate_as(:'bob');

select results_eq(
  $$select household_name, inviter_name, member_count from public.preview_invite('tok-ok')$$,
  $$values ('Casa'::text, 'Ana'::text, 2)$$,
  'a valid token shows the household, who invites and the active members'
);

select is(
  (select inviter_name from public.preview_invite('tok-anon')),
  null::text,
  'an inviter whose account is gone shows no name'
);

select throws_ok($$select * from public.preview_invite('nope')$$, 'P0001', 'INVITE_INVALID',
  'an unknown token reveals nothing');
select throws_ok($$select * from public.preview_invite(null)$$, 'P0001', 'INVITE_INVALID',
  'a null token reveals nothing');
select throws_ok($$select * from public.preview_invite('tok-revoked')$$, 'P0001', 'INVITE_INVALID',
  'a revoked invite reveals nothing');
select throws_ok($$select * from public.preview_invite('tok-used')$$, 'P0001', 'INVITE_INVALID',
  'an accepted invite reveals nothing');
select throws_ok($$select * from public.preview_invite('tok-gone')$$, 'P0001', 'INVITE_INVALID',
  'an invite to a deleted household reveals nothing');
select throws_ok($$select * from public.preview_invite('tok-old')$$, 'P0001', 'INVITE_EXPIRED',
  'an expired invite says so');

-- A member previewing an invite to their own household gets the same answer.
select tests.authenticate_as(:'gus');
select is(
  (select member_count from public.preview_invite('tok-ok')),
  2,
  'members see the same preview'
);

select tests.clear_auth();
-- Previewing changes nothing: the invite can still be accepted.
select is(
  (select accepted_at from public.household_invites
   where token_hash = encode(extensions.digest('tok-ok', 'sha256'), 'hex')),
  null::timestamptz,
  'previewing does not use the invite'
);

select throws_ok($$select * from public.preview_invite('tok-ok')$$, 'P0001', 'NOT_AUTHENTICATED',
  'preview without session is rejected');

set local role anon;
select throws_ok($$select * from public.preview_invite('tok-ok')$$, '42501', null,
  'anon cannot execute preview_invite');
reset role;

select ok(
  (select prosecdef from pg_proc where oid = 'public.preview_invite(text)'::regprocedure),
  'preview_invite is security definer'
);
select ok(
  (select proconfig @> array['search_path=""'] from pg_proc
   where oid = 'public.preview_invite(text)'::regprocedure),
  'preview_invite pins an empty search_path'
);

select * from finish();
rollback;
