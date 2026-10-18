begin;
select plan(9);

select tests.create_user('ana@test.dev', 'Ana') as ana \gset
select tests.create_user('bob@test.dev', 'Bob') as bob \gset

insert into public.households (id, name, created_by)
values ('00000000-0000-0000-0000-0000000000a1', 'Casa', :'ana');
insert into public.household_members (household_id, user_id, role)
values ('00000000-0000-0000-0000-0000000000a1', :'ana', 'owner'),
       ('00000000-0000-0000-0000-0000000000a1', :'bob', 'member');

select tests.authenticate_as(:'ana');
select public.set_display_name('  Ana Ruiz  ');
select is((select display_name from public.profiles where user_id = :'ana'), 'Ana Ruiz',
          'a member changes their name, trimmed');
select is((select display_name from public.profiles where user_id = :'bob'), 'Bob',
          'it does not touch another profile');

select public.set_display_name('Anita');
select is((select display_name from public.profiles where user_id = :'ana'), 'Anita',
          'a later call replaces the chosen name');

select lives_ok(format($$select public.set_display_name(%L)$$, repeat('x', 40)),
                '40 characters are accepted');
select throws_ok(format($$select public.set_display_name(%L)$$, repeat('x', 41)),
                 'P0001', 'INVALID_DISPLAY_NAME', '41 characters are rejected');
select throws_ok($$select public.set_display_name('   ')$$, 'P0001', 'INVALID_DISPLAY_NAME',
                 'a blank name is rejected');
select throws_ok($$select public.set_display_name(null)$$, 'P0001', 'INVALID_DISPLAY_NAME',
                 'a null name is rejected');

select tests.clear_auth();
select throws_ok($$select public.set_display_name('X')$$, 'P0001', 'NOT_AUTHENTICATED',
                 'set_display_name needs a session');
select ok(
  not has_function_privilege('anon', 'public.set_display_name(text)', 'execute'),
  'anon cannot execute set_display_name'
);

select * from finish();
rollback;
