begin;
select plan(26);

select tests.create_user('ana@test.dev', 'Ana') as ana \gset
select tests.create_user('bob@test.dev', 'Bob') as bob \gset

-- Privileges and session ------------------------------------------------------

set local role anon;
select throws_ok($$select public.register_push_token('ExponentPushToken[aaaaaaaaaa]', 'android')$$,
                 '42501', null, 'anon cannot execute register_push_token');
select throws_ok($$select public.unregister_push_token('ExponentPushToken[aaaaaaaaaa]')$$,
                 '42501', null, 'anon cannot execute unregister_push_token');
select throws_ok($$select public.set_notification_prefs(true, true)$$,
                 '42501', null, 'anon cannot execute set_notification_prefs');
reset role;

select tests.clear_auth();
select throws_ok($$select public.register_push_token('ExponentPushToken[aaaaaaaaaa]', 'android')$$,
                 'P0001', 'NOT_AUTHENTICATED', 'register_push_token needs a session');
select throws_ok($$select public.unregister_push_token('ExponentPushToken[aaaaaaaaaa]')$$,
                 'P0001', 'NOT_AUTHENTICATED', 'unregister_push_token needs a session');
select throws_ok($$select public.set_notification_prefs(true, true)$$,
                 'P0001', 'NOT_AUTHENTICATED', 'set_notification_prefs needs a session');

-- Tokens ----------------------------------------------------------------------

select tests.authenticate_as(:'ana');
select public.register_push_token('ExponentPushToken[aaaaaaaaaa]', 'android');
select is((select user_id from public.push_tokens where token = 'ExponentPushToken[aaaaaaaaaa]'),
          :'ana'::uuid, 'Ana registers a token and it is hers');

select tests.authenticate_as(:'bob');
select public.register_push_token('ExponentPushToken[aaaaaaaaaa]', 'android');
select is((select user_id from public.push_tokens where token = 'ExponentPushToken[aaaaaaaaaa]'),
          :'bob'::uuid, 'registering the same token moves it to Bob');

select tests.authenticate_as(:'ana');
select is((select count(*) from public.push_tokens), 0::bigint, 'Ana cannot read Bob''s tokens');
select public.unregister_push_token('ExponentPushToken[aaaaaaaaaa]');
select tests.clear_auth();
select is((select count(*) from public.push_tokens where user_id = :'bob'), 1::bigint,
          'unregistering someone else''s token does nothing');

select tests.authenticate_as(:'ana');
select throws_ok($$select public.register_push_token('short', 'android')$$,
                 'P0001', 'INVALID_PUSH_TOKEN', 'a 5-character token is rejected');
select throws_ok($$select public.register_push_token('ExponentPushToken[bbbbbbbbbb]', 'web')$$,
                 'P0001', 'INVALID_PUSH_TOKEN', 'the web platform is rejected');
select throws_ok($$select public.register_push_token(null, 'android')$$,
                 'P0001', 'INVALID_PUSH_TOKEN', 'a null token is rejected');
select throws_ok($$select public.register_push_token('ExponentPushToken[bbbbbbbbbb]', null)$$,
                 'P0001', 'INVALID_PUSH_TOKEN', 'a null platform is rejected');
select throws_ok($$select public.register_push_token('garbage-token-123', 'android')$$,
                 'P0001', 'INVALID_PUSH_TOKEN', 'a token that is not an Expo push token is rejected');
select lives_ok($$select public.register_push_token('ExpoPushToken[cccccccccc]', 'ios')$$,
                'the ExpoPushToken[...] form is accepted too');

-- Ten tokens per user at most: the eleventh evicts the oldest.
select tests.clear_auth();
update public.push_tokens set updated_at = now() - interval '1 hour'
where token = 'ExpoPushToken[cccccccccc]';
select tests.authenticate_as(:'ana');
do $$
begin
  perform public.register_push_token(format('ExponentPushToken[ana-%s]', n), 'android')
  from generate_series(2, 11) n;
end;
$$;
select tests.clear_auth();
select is((select count(*) from public.push_tokens where user_id = :'ana'), 10::bigint,
          'a user keeps at most ten tokens');
select ok(not exists (select 1 from public.push_tokens where token = 'ExpoPushToken[cccccccccc]'),
          'the eleventh token evicts the oldest');
delete from public.push_tokens where user_id = :'ana';

select tests.authenticate_as(:'bob');
select public.unregister_push_token('ExponentPushToken[aaaaaaaaaa]');
select is((select count(*) from public.push_tokens), 0::bigint, 'Bob removes his own token');
select public.register_push_token('ExponentPushToken[aaaaaaaaaa]', 'android');

-- Preferences -----------------------------------------------------------------

select tests.clear_auth();
select is(private.push_enabled(:'bob', 'task_assigned'), true, 'no prefs row means enabled');

select tests.authenticate_as(:'bob');
select public.set_notification_prefs(false, true);
select tests.clear_auth();
select is((select task_assigned from public.notification_prefs where user_id = :'bob'), false,
          'set_notification_prefs stores the preference');
select is(private.push_enabled(:'bob', 'task_assigned'), false, 'push_enabled is false after turning it off');

select tests.authenticate_as(:'bob');
select throws_ok($$select public.set_notification_prefs(null, true)$$,
                 'P0001', 'INVALID_PREFS', 'a null preference is rejected');

-- Outbox and account deletion --------------------------------------------------

select throws_ok($$select * from private.push_outbox$$, '42501', null,
                 'authenticated cannot read private.push_outbox');

select public.delete_account();
select tests.clear_auth();
select is((select count(*) from public.push_tokens where user_id = :'bob')
        + (select count(*) from public.notification_prefs where user_id = :'bob'),
          0::bigint, 'delete_account removes tokens and preferences');
select is((select count(*) from public.profiles where user_id = :'bob'), 0::bigint,
          'the profile is gone');

select * from finish();
rollback;
