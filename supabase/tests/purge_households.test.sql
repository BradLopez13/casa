begin;
select plan(12);

select tests.create_user('ana@test.dev', 'Ana') as ana \gset
select tests.create_user('bob@test.dev', 'Bob') as bob \gset
select tests.create_user('carla@test.dev', 'Carla') as carla \gset

-- a1: deleted 31 days ago, with everything a household holds.
insert into public.households (id, name, created_by, deleted_at)
values ('00000000-0000-0000-0000-0000000000a1', 'Vieja', :'ana', now() - interval '31 days');
insert into public.household_members (household_id, user_id, role, left_at)
values ('00000000-0000-0000-0000-0000000000a1', :'ana', 'owner', now() - interval '31 days');
insert into public.household_invites (id, household_id, token_hash, created_by, expires_at, revoked_at)
values ('00000000-0000-0000-0000-0000000000e1', '00000000-0000-0000-0000-0000000000a1',
        encode(extensions.digest('vieja-token', 'sha256'), 'hex'), :'ana',
        now() - interval '24 days', now() - interval '31 days');
insert into public.task_series (id, household_id, title, created_by)
values ('00000000-0000-0000-0000-0000000000b1', '00000000-0000-0000-0000-0000000000a1', 'Barrer', :'ana');
insert into public.task_occurrences (id, series_id, household_id, assignee_id)
values ('00000000-0000-0000-0000-0000000000c1', '00000000-0000-0000-0000-0000000000b1',
        '00000000-0000-0000-0000-0000000000a1', :'ana');
insert into public.shopping_items (id, household_id, name, created_by)
values ('00000000-0000-0000-0000-0000000000d1', '00000000-0000-0000-0000-0000000000a1', 'Leche', :'ana');

-- a2: deleted 10 days ago, still inside the grace period.
insert into public.households (id, name, created_by, deleted_at)
values ('00000000-0000-0000-0000-0000000000a2', 'Reciente', :'bob', now() - interval '10 days');
insert into public.household_members (household_id, user_id, role, left_at)
values ('00000000-0000-0000-0000-0000000000a2', :'bob', 'owner', now() - interval '10 days');

-- a3: a live household.
insert into public.households (id, name, created_by)
values ('00000000-0000-0000-0000-0000000000a3', 'Viva', :'carla');
insert into public.household_members (household_id, user_id, role)
values ('00000000-0000-0000-0000-0000000000a3', :'carla', 'owner');
insert into public.shopping_items (id, household_id, name, created_by)
values ('00000000-0000-0000-0000-0000000000d3', '00000000-0000-0000-0000-0000000000a3', 'Pan', :'carla');

-- Privileges ------------------------------------------------------------------

select ok(
  not has_function_privilege('anon', 'private.purge_deleted_households()', 'execute')
    and not has_function_privilege('authenticated', 'private.purge_deleted_households()', 'execute'),
  'only the database can purge households'
);

-- Purge -----------------------------------------------------------------------

select is(private.purge_deleted_households(), 1, 'purges the one household deleted over 30 days ago');

select is(
  (select count(*)::int from public.households where id = '00000000-0000-0000-0000-0000000000a1'),
  0, 'the old household is gone'
);
select is(
  (select count(*)::int from public.household_members where household_id = '00000000-0000-0000-0000-0000000000a1'),
  0, 'its members are gone'
);
select is(
  (select count(*)::int from public.household_invites where household_id = '00000000-0000-0000-0000-0000000000a1'),
  0, 'its invites are gone'
);
select is(
  (select count(*)::int from public.task_series where household_id = '00000000-0000-0000-0000-0000000000a1'),
  0, 'its task series are gone'
);
select is(
  (select count(*)::int from public.task_occurrences where household_id = '00000000-0000-0000-0000-0000000000a1'),
  0, 'its task occurrences are gone'
);
select is(
  (select count(*)::int from public.shopping_items where household_id = '00000000-0000-0000-0000-0000000000a1'),
  0, 'its shopping is gone'
);
select is(
  (select count(*)::int from public.households
   where id in ('00000000-0000-0000-0000-0000000000a2', '00000000-0000-0000-0000-0000000000a3')),
  2, 'a recently deleted household and a live one stay'
);
select is(
  (select count(*)::int from public.shopping_items where household_id = '00000000-0000-0000-0000-0000000000a3'),
  1, 'the live household keeps its shopping'
);
select is(private.purge_deleted_households(), 0, 'a second run finds nothing to purge');

-- Daily job -------------------------------------------------------------------

select ok(
  not exists (select 1 from pg_namespace where nspname = 'cron')
    or exists (
      select 1 from cron.job
      where jobname = 'purge-deleted-households'
        and schedule = '30 3 * * *'
        and command = 'select private.purge_deleted_households()'
    ),
  'the purge-deleted-households job runs every night when pg_cron exists'
);

select * from finish();
rollback;
