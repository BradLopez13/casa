begin;
select plan(6);

-- Bloque 15.4: the Apple refresh token is the service role's business only.

select tests.create_user('ana@test.dev', 'Ana') as ana \gset

select tests.authenticate_as(:'ana');
select throws_ok(
  format($$select public.apple_token_save(%L, 'r')$$, :'ana'),
  '42501', null,
  'authenticated cannot keep a token'
);
select throws_ok(
  format($$select public.apple_token_load(%L)$$, :'ana'),
  '42501', null,
  'nor read one'
);
select throws_ok(
  $$select * from private.apple_tokens$$,
  '42501', null,
  'nor see the table'
);

select tests.clear_auth();
set local role service_role;
select lives_ok(
  format($$select public.apple_token_save(%L, 'r-1')$$, :'ana'),
  'the service role keeps the token'
);
select is(public.apple_token_load(:'ana'::uuid), 'r-1', 'and reads it back');
select public.apple_token_forget(:'ana'::uuid);
select is(public.apple_token_load(:'ana'::uuid), null, 'and forgets it');
reset role;

select * from finish();
rollback;
