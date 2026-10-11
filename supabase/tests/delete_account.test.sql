begin;
select plan(19);

select tests.create_user('ana@test.dev', 'Ana') as ana \gset
select tests.create_user('bob@test.dev', 'Bob') as bob \gset
select tests.create_user('carla@test.dev', 'Carla') as carla \gset
select tests.create_user('dani@test.dev', 'Dani') as dani \gset
select tests.create_user('eva@test.dev', 'Eva') as eva \gset
select tests.create_user('felix@test.dev', 'Felix') as felix \gset

-- Ana owns the household; Bob and Carla are members.
insert into public.households (id, name, created_by)
values ('00000000-0000-0000-0000-0000000000a1', 'Casa', :'ana');
insert into public.household_members (household_id, user_id, role)
values
  ('00000000-0000-0000-0000-0000000000a1', :'ana', 'owner'),
  ('00000000-0000-0000-0000-0000000000a1', :'bob', 'member'),
  ('00000000-0000-0000-0000-0000000000a1', :'carla', 'member'),
  ('00000000-0000-0000-0000-0000000000a1', :'felix', 'member');

-- Bob: a series he created, an open occurrence assigned to him, a bought item.
insert into public.task_series (id, household_id, title, created_by)
values ('00000000-0000-0000-0000-0000000000b1', '00000000-0000-0000-0000-0000000000a1', 'Barrer', :'bob');
insert into public.task_occurrences (id, series_id, household_id, assignee_id)
values ('00000000-0000-0000-0000-0000000000c1', '00000000-0000-0000-0000-0000000000b1',
        '00000000-0000-0000-0000-0000000000a1', :'bob');
insert into public.shopping_items (id, household_id, name, created_by, bought_at, bought_by)
values ('00000000-0000-0000-0000-0000000000d1', '00000000-0000-0000-0000-0000000000a1',
        'Leche', :'bob', now(), :'bob');

-- Dani owns a household alone, with an open invite.
insert into public.households (id, name, created_by)
values ('00000000-0000-0000-0000-0000000000a2', 'Casa de Dani', :'dani');
insert into public.household_members (household_id, user_id, role)
values ('00000000-0000-0000-0000-0000000000a2', :'dani', 'owner');
insert into public.household_invites (id, household_id, token_hash, created_by, expires_at)
values ('00000000-0000-0000-0000-0000000000e1', '00000000-0000-0000-0000-0000000000a2',
        encode(extensions.digest('dani-token', 'sha256'), 'hex'), :'dani', now() + interval '7 days');

-- Privileges ------------------------------------------------------------------

set local role anon;

select throws_ok(
  $$select public.delete_account()$$,
  '42501', null, 'anon cannot execute delete_account'
);

reset role;
select tests.clear_auth();

select throws_ok(
  $$select public.delete_account()$$,
  'P0001', 'NOT_AUTHENTICATED', 'delete_account without session is rejected'
);

-- Owner with other members ----------------------------------------------------

select tests.authenticate_as(:'ana');

select throws_ok(
  $$select public.delete_account()$$,
  'P0001', 'OWNER_MUST_TRANSFER', 'an owner with other members cannot delete the account'
);

select tests.clear_auth();

select ok(
  exists (select 1 from auth.users where id = :'ana'),
  'the owner is still in auth.users after the rejected delete'
);

-- Member ----------------------------------------------------------------------

select tests.authenticate_as(:'bob');
select lives_ok($$select public.delete_account()$$, 'a member deletes the account');
select tests.clear_auth();

select ok(
  not exists (select 1 from auth.users where id = :'bob'),
  'the member is gone from auth.users'
);

select ok(
  not exists (select 1 from public.profiles where user_id = :'bob'),
  'the member profile is gone'
);

select ok(
  not exists (select 1 from public.household_members where user_id = :'bob'),
  'the member rows are gone'
);

select ok(
  (select assignee_id is null from public.task_occurrences
    where id = '00000000-0000-0000-0000-0000000000c1'),
  'the open occurrence is left unassigned'
);

select ok(
  (select created_by is null from public.task_series
    where id = '00000000-0000-0000-0000-0000000000b1'),
  'the series survives with a null author'
);

select ok(
  (select created_by is null and bought_by is null from public.shopping_items
    where id = '00000000-0000-0000-0000-0000000000d1'),
  'the shopping item survives with null author and buyer'
);

-- Owner alone -----------------------------------------------------------------

select tests.authenticate_as(:'dani');
select lives_ok($$select public.delete_account()$$, 'an owner alone deletes the account');
select tests.clear_auth();

select ok(
  (select deleted_at is not null from public.households
    where id = '00000000-0000-0000-0000-0000000000a2'),
  'the owner''s household is soft deleted'
);

select ok(
  (select revoked_at is not null from public.household_invites
    where id = '00000000-0000-0000-0000-0000000000e1'),
  'its open invite is revoked'
);

select ok(
  not exists (select 1 from auth.users where id = :'dani'),
  'the owner is gone from auth.users'
);

-- No household ----------------------------------------------------------------

select tests.authenticate_as(:'eva');
select lives_ok($$select public.delete_account()$$, 'a user without household deletes the account');
select tests.clear_auth();

select ok(
  not exists (select 1 from auth.users where id = :'eva'),
  'the user without household is gone from auth.users'
);

-- Race: the membership already ended ------------------------------------------

update public.household_members set left_at = now() where user_id = :'felix';
select tests.authenticate_as(:'felix');
select lives_ok($$select public.delete_account()$$, 'a membership that just ended does not block the delete');
select tests.clear_auth();

select ok(
  not exists (select 1 from auth.users where id = :'felix'),
  'the user whose membership just ended is gone from auth.users'
);

select * from finish();
rollback;
