begin;
select plan(10);

select is(
  (select count(*) from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relkind in ('r', 'p') and not c.relrowsecurity),
  0::bigint,
  'every public table has RLS enabled'
);

select is(
  (select count(*) from information_schema.role_table_grants
    where grantee = 'anon' and table_schema = 'public'),
  0::bigint,
  'anon has no table privileges in public'
);

select is(
  (select count(*) from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and not exists (
        select 1 from pg_depend d
        where d.classid = 'pg_proc'::regclass and d.objid = p.oid and d.deptype = 'e'
      )
      and has_function_privilege('anon', p.oid, 'execute')),
  0::bigint,
  'anon cannot execute any public function'
);

select is(
  (select count(*) from information_schema.role_table_grants
    where grantee = 'authenticated'
      and table_schema = 'public'
      and privilege_type in ('INSERT', 'UPDATE', 'DELETE', 'TRUNCATE')),
  0::bigint,
  'authenticated cannot write public tables directly'
);

select is(
  (select count(*) from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'private'
      and has_function_privilege('public', p.oid, 'execute')),
  0::bigint,
  'public cannot execute private functions'
);

select is(
  (select count(*) from information_schema.column_privileges
    where grantee = 'anon' and table_schema = 'public'),
  0::bigint,
  'anon has no column privileges in public'
);

select is(
  (select count(*) from information_schema.column_privileges
    where grantee = 'authenticated'
      and table_schema = 'public'
      and privilege_type in ('INSERT', 'UPDATE')
      and not (
        table_name = 'profiles'
        and privilege_type = 'UPDATE'
        and column_name in ('display_name', 'avatar_url', 'locale')
      )),
  0::bigint,
  'authenticated has no column write privileges in public beyond profiles'
);

select is(current_user::text, 'postgres', 'guard tests run as the migration role');

create function private.grants_guard_probe() returns void
language sql as 'select';

select ok(
  not has_function_privilege('authenticated', 'private.grants_guard_probe()', 'execute')
    and not has_function_privilege('anon', 'private.grants_guard_probe()', 'execute')
    and not has_function_privilege('public', 'private.grants_guard_probe()', 'execute'),
  'new private functions are not executable by default'
);

create function public.grants_guard_probe() returns void
language sql as 'select';

select ok(
  not has_function_privilege('anon', 'public.grants_guard_probe()', 'execute')
    and not has_function_privilege('authenticated', 'public.grants_guard_probe()', 'execute')
    and not has_function_privilege('public', 'public.grants_guard_probe()', 'execute'),
  'new public functions are not executable by default'
);

select * from finish();
rollback;
