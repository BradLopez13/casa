-- Before switching billing on (bloque 13, 13.7): the cap on households per person, one trial per
-- person, the complimentary licences when billing is switched on, a push token not taken from
-- its owner, and the old functions marked for removal.
begin;
select plan(17);

select tests.create_user('ana@test.dev', 'Ana') as ana \gset
select tests.create_user('bob@test.dev', 'Bob') as bob \gset
select tests.create_user('eva@test.dev', 'Eva') as eva \gset

-- 1 · The cap ---------------------------------------------------------------------------------

select tests.authenticate_as(:'ana');
select public.create_household('Casa ' || n) from generate_series(1, 10) as n;

select is(
  (select count(*) from public.household_members where user_id = :'ana'::uuid and left_at is null),
  10::bigint,
  'a person can be in ten households'
);

select throws_ok(
  $$select public.create_household('Casa 11')$$,
  'P0001', 'TOO_MANY_HOUSEHOLDS',
  'the eleventh is refused with TOO_MANY_HOUSEHOLDS'
);

-- Leaving one makes room again.
select hid as last_hid from (
  select h.id as hid from public.households h where h.name = 'Casa 10'
) s \gset
select public.delete_household(:'last_hid');

select lives_ok(
  $$select public.create_household('Casa 11')$$,
  'once one is gone, another can be created'
);

-- 2 · One trial per person -------------------------------------------------------------------

reset role;
update private.app_settings set billing_enabled = true;

select tests.authenticate_as(:'bob');
select public.create_household('Piso de Bob') as bob_first \gset

select ok(
  (select status = 'trial' and trial_ends_at > now() + interval '13 days'
   from public.household_licenses where household_id = :'bob_first'),
  'the first household someone creates with billing on starts its 14-day trial'
);

select public.create_household('Casa de la madre de Bob') as bob_second \gset

select ok(
  (select status = 'trial' and trial_ends_at <= now()
   from public.household_licenses where household_id = :'bob_second'),
  'the second one does not start another trial: it is over from the start'
);

select is(
  (select licensed from public.my_households() where household_id = :'bob_second'),
  false,
  'so that household waits for its licence to write'
);

select public.delete_household(:'bob_first');
select public.create_household('Otro piso de Bob') as bob_third \gset

select ok(
  (select trial_ends_at <= now() from public.household_licenses where household_id = :'bob_third'),
  'deleting the first household gives no second trial'
);

reset role;
select is(
  (select count(*) from private.trial_grants where user_id = :'bob'::uuid),
  1::bigint,
  'the trial is recorded once per person'
);

-- 3 · Switching billing on: the complimentary licences get a 14-day trial ----------------------

update private.app_settings set billing_enabled = false;
select tests.authenticate_as(:'eva');
select public.create_household('Casa de Eva') as eva_hid \gset

select is(
  (select status from public.household_licenses where household_id = :'eva_hid'),
  'complimentary',
  'with billing off Eva''s household is complimentary'
);

reset role;
select private.enable_billing();

select ok(
  (select status = 'trial'
      and trial_ends_at between now() + interval '14 days' - interval '1 minute'
                            and now() + interval '14 days' + interval '1 minute'
   from public.household_licenses where household_id = :'eva_hid'),
  'switching billing on gives every complimentary household 14 days of trial from then'
);

select is(
  (select count(*) from public.household_licenses where status = 'complimentary'),
  0::bigint,
  'and leaves no complimentary licence behind'
);

select ok(
  exists (select 1 from private.trial_grants where user_id = :'eva'::uuid),
  'Eva has had her trial: her next household starts without one'
);

select is(
  (select billing_enabled from private.app_settings),
  true,
  'enable_billing switches billing on'
);

select throws_ok(
  $$set local role authenticated; select private.enable_billing()$$,
  '42501', null,
  'nobody from the app can switch it on'
);

update private.app_settings set billing_enabled = false;

-- 4 · A push token stays with its owner -------------------------------------------------------

select tests.authenticate_as(:'ana');
select public.register_push_token('ExponentPushToken[bbbbbbbbbb]', 'android');
select tests.authenticate_as(:'bob');
select public.register_push_token('ExponentPushToken[bbbbbbbbbb]', 'android');

reset role;
select is(
  (select user_id from public.push_tokens where token = 'ExponentPushToken[bbbbbbbbbb]'),
  :'ana'::uuid,
  'a token its owner refreshed lately is not moved to someone else'
);

update public.push_tokens set updated_at = now() - interval '31 days'
where token = 'ExponentPushToken[bbbbbbbbbb]';
select tests.authenticate_as(:'bob');
select public.register_push_token('ExponentPushToken[bbbbbbbbbb]', 'android');

reset role;
select is(
  (select user_id from public.push_tokens where token = 'ExponentPushToken[bbbbbbbbbb]'),
  :'bob'::uuid,
  'one left unrefreshed for over 30 days goes to whoever registers it'
);

-- 5 · The old functions say when they go ------------------------------------------------------

select ok(
  obj_description('public.set_household_rooms(text[])'::regprocedure, 'pg_proc') like 'Obsoleta%'
  and obj_description('public.accept_invite(text)'::regprocedure, 'pg_proc') like 'Obsoleta%',
  'set_household_rooms(text[]) and accept_invite(text) are marked for removal'
);

select * from finish();
rollback;
