begin;
create extension if not exists pgtap with schema extensions;
select plan(8);

select tests.create_user('ana@test.dev', 'Ana') as ana \gset
select tests.create_user('bob@test.dev', 'Bob') as bob \gset

-- Ana owns a household; Bob has none.
insert into public.households (id, name, created_by)
values ('00000000-0000-0000-0000-0000000000a1', 'Casa', :'ana');
insert into public.household_members (household_id, user_id, role)
values ('00000000-0000-0000-0000-0000000000a1', :'ana', 'owner');
insert into public.household_invites (id, household_id, token_hash, created_by, expires_at)
values (
  '00000000-0000-0000-0000-0000000000b1',
  '00000000-0000-0000-0000-0000000000a1',
  'hash-fixture', :'ana', now() + interval '7 days'
);

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

select tests.clear_auth();
select * from finish();
rollback;
