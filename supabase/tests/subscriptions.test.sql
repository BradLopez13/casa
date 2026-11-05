-- Bloque 15.6: one subscription per person with a level per number of households.
begin;
select plan(30);

select tests.create_user('ana@test.dev', 'Ana') as ana \gset
select tests.create_user('bob@test.dev', 'Bob') as bob \gset

-- Ana leads «Casa» and «Pueblo»; Bob is in «Casa».
select tests.authenticate_as(:'ana');
select public.create_household('Casa') as casa \gset
select public.create_household('Pueblo') as pueblo \gset
select token as tok from public.create_invite(:'casa') \gset
select tests.authenticate_as(:'bob');
select public.accept_invite(:'tok');
select tests.clear_auth();

-- Billing on: both households fall into a trial.
select private.enable_billing();

set local role service_role;
select is(
  public.apply_billing_event(:'casa', 'active', now() + interval '30 days', 'revenuecat', 'sub_a',
    :'ana', true, now() - interval '5 minutes', 'casas_1', 'ev-1'),
  true,
  '1 · the first purchase of casas_1 ties the subscription to Ana and covers Casa'
);
reset role;
select is(
  (select status || ' ' || provider_subscription_id from public.household_licenses where household_id = :'casa'),
  'active sub_a', '2 · Casa is active under sub_a'
);
select is(
  (select status from public.household_licenses where household_id = :'pueblo'),
  'trial', '3 · Pueblo stays on its trial: the level covers one'
);

-- The same event again changes nothing.
set local role service_role;
select is(
  public.apply_billing_event(:'casa', 'active', now() + interval '30 days', 'revenuecat', 'sub_a',
    :'ana', true, now() - interval '5 minutes', 'casas_1', 'ev-1'),
  false, '4 · an event already applied changes nothing'
);

-- Up to casas_2: Pueblo is covered too.
select is(
  public.apply_billing_event(null, 'active', now() + interval '30 days', 'revenuecat', 'sub_a',
    :'ana', false, now() - interval '4 minutes', 'casas_2', 'ev-2'),
  true, '5 · a product change up to casas_2 is applied'
);
reset role;
select is(
  (select status || ' ' || provider_subscription_id from public.household_licenses where household_id = :'pueblo'),
  'active sub_a', '6 · and Pueblo is covered'
);
select tests.authenticate_as(:'ana');
select is(
  (select level || ' ' || array_length(household_ids, 1) from public.my_subscription()),
  '2 2', '7 · my_subscription says the level and the two households'
);
select is(
  (select count(*) from public.subscription_households where subscription_id = 'sub_a'),
  2::bigint, '8 · the payer reads the coverage'
);
select tests.authenticate_as(:'bob');
select is(
  (select count(*) from public.subscription_households where subscription_id = 'sub_a'),
  0::bigint, '9 · nobody else does'
);
select is((select count(*) from public.my_subscription()), 0::bigint, '10 · Bob pays nothing');

-- Ana chooses Pueblo first.
select tests.authenticate_as(:'ana');
select lives_ok(
  format($$select public.choose_covered_households('revenuecat', 'sub_a', array[%L, %L]::uuid[])$$, :'pueblo', :'casa'),
  '11 · the payer orders what the level covers'
);
select throws_ok(
  format($$select public.choose_covered_households('revenuecat', 'sub_a', array[%L, %L, %L]::uuid[])$$, :'pueblo', :'casa', :'casa'),
  'P0001', 'NOT_OWNER', '12 · never more than the level'
);
select tests.authenticate_as(:'bob');
select throws_ok(
  format($$select public.choose_covered_households('revenuecat', 'sub_a', array[%L]::uuid[])$$, :'casa'),
  'P0001', 'NOT_OWNER', '13 · nor someone who does not pay'
);

-- Down to casas_1: the last chosen (Casa) is let go at the period's end.
set local role service_role;
select is(
  public.apply_billing_event(null, 'active', now() + interval '30 days', 'revenuecat', 'sub_a',
    :'ana', false, now() - interval '3 minutes', 'casas_1', 'ev-3'),
  true, '14 · a product change down to casas_1 is applied'
);
reset role;
select is(
  (select status from public.household_licenses where household_id = :'casa'),
  'canceled', '15 · Casa, the last chosen, is canceled'
);
select is(
  (select status from public.household_licenses where household_id = :'pueblo'),
  'active', '16 · Pueblo, chosen first, stays'
);

-- A billing issue, then an expiry.
set local role service_role;
select public.apply_billing_event(null, 'past_due', null, 'revenuecat', 'sub_a', null, false,
  now() - interval '2 minutes', null, 'ev-4');
reset role;
select is(
  (select status from public.household_licenses where household_id = :'pueblo'),
  'past_due', '17 · an unpaid renewal is past_due on what it covers'
);
set local role service_role;
select is(
  public.apply_billing_event(null, 'active', now() + interval '30 days', 'revenuecat', 'sub_a', null,
    false, now() - interval '10 minutes', null, 'ev-old'),
  false, '18 · an older event changes nothing'
);
select public.apply_billing_event(null, 'canceled', now(), 'revenuecat', 'sub_a', null, false,
  now() - interval '1 minute', null, 'ev-5');
reset role;
select is(
  (select status from public.household_licenses where household_id = :'pueblo'),
  'canceled', '19 · an expiry cancels what it covers'
);

-- Ana hands Casa over to Bob; Bob buys his own: the licence of Casa goes with Bob's subscription.
select tests.authenticate_as(:'ana');
select public.transfer_ownership(:'casa', :'bob');
set local role service_role;
select is(
  public.apply_billing_event(:'casa', 'active', now() + interval '30 days', 'revenuecat', 'sub_b',
    :'bob', true, now(), 'casas_1', 'ev-6'),
  true, '20 · the new lead buys a subscription that covers Casa'
);
reset role;
select is(
  (select paid_by = :'bob'::uuid and provider_subscription_id = 'sub_b' from public.household_licenses where household_id = :'casa'),
  true, '21 · Casa is now paid by Bob'
);
-- And a transfer (RevenueCat TRANSFER names people, not subscriptions): Bob's go to Ana, the
-- state stays and the payer changes.
set local role service_role;
select is(
  public.transfer_subscriptions(array[:'bob']::uuid[], :'ana', 'ev-7', now()),
  true, '22 · a transfer moves every subscription of the people who lose them'
);
select is(
  public.transfer_subscriptions(array[:'bob']::uuid[], :'ana', 'ev-7', now()),
  false, '23 · once'
);
reset role;
select is(
  (select status || ' ' || (paid_by = :'ana'::uuid)::text from public.household_licenses where household_id = :'casa'),
  'active true', '24 · the covered household keeps its state and follows the payer'
);

-- Bought again after a lapse (Play gives a new token): the new subscription covers what the
-- canceled one covered (revisión 15.6).
set local role service_role;
select is(
  public.apply_billing_event(null, 'active', now() + interval '30 days', 'revenuecat', 'sub_c',
    :'ana', true, now(), 'casas_2:mensual', 'ev-8'),
  true, '25 · a new purchase with Play''s base plan suffix is applied at its level'
);
reset role;
select is(
  (select count(*) from public.subscription_households where subscription_id = 'sub_c'),
  1::bigint, '26 · and covers Pueblo, the one Ana still leads, which the canceled sub_a let go of'
);
select is(
  (select status from public.household_licenses where household_id = :'pueblo'),
  'active', '27 · Pueblo, canceled under sub_a, is active again under sub_c'
);

-- A household sits in one subscription at most, also when chosen.
select tests.authenticate_as(:'ana');
select is(
  (select count(distinct subscription_id) from public.subscription_households where household_id = :'casa'),
  1::bigint, '28 · Casa is in one subscription'
);
select is(
  (select count(*) from public.my_subscription() where status = 'canceled'),
  0::bigint, '29 · my_subscription never shows a canceled one'
);

-- A deleted household gives its slot back.
select public.delete_household(:'pueblo');
set local role service_role;
select public.apply_billing_event(null, 'active', now() + interval '30 days', 'revenuecat', 'sub_c',
  null, false, now() + interval '1 minute', null, 'ev-9');
reset role;
select is(
  (select count(*) from public.subscription_households where subscription_id = 'sub_c' and household_id = :'pueblo'),
  0::bigint, '30 · a deleted household leaves the coverage'
);

select * from finish();
rollback;
