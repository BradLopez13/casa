-- One licence per household behind a switch (bloque 12): the table only the server writes, the
-- licence a new household gets with the switch off and on, the write guard with every state,
-- reading never blocked, my_households, the checkout and the billing webhook's door.
begin;
select plan(52);

select tests.create_user('ana@test.dev', 'Ana') as ana \gset
select tests.create_user('bob@test.dev', 'Bob') as bob \gset
select tests.create_user('eva@test.dev', 'Eva') as eva \gset

-- Ana leads «Casa» with Bob. Eva is not in it.
select tests.authenticate_as(:'ana');
select public.create_household('Casa') as hid \gset
select token as tok from public.create_invite(:'hid') \gset
select tests.authenticate_as(:'bob');
select public.accept_invite(:'tok');

-- Content to read and write.
select tests.authenticate_as(:'ana');
select public.create_task('00000000-0000-0000-0000-0000000000c1', :'hid', 'Barrer', null, null,
  current_date, null);
select public.create_task('00000000-0000-0000-0000-0000000000c2', :'hid', 'Fregar', null, null,
  current_date, '{"kind":"interval","every":1}'::jsonb);
select public.add_shopping_item('00000000-0000-0000-0000-0000000000d1', :'hid', 'Leche', null);
select public.add_shopping_item('00000000-0000-0000-0000-0000000000d2', :'hid', 'Pan', null);

-- The table: members read it, nobody writes it from the client ------------------

select is(
  (select status || ' ' || (paid_by = :'ana'::uuid)::text from public.household_licenses),
  'complimentary true',
  'with billing off a new household gets a complimentary licence, paid by whoever created it'
);

select is(
  (select trial_ends_at from public.household_licenses),
  null::timestamptz,
  'and no trial'
);

select tests.authenticate_as(:'bob');

select is(
  (select count(*) from public.household_licenses where household_id = :'hid'),
  1::bigint,
  'a member reads the household''s licence'
);

select throws_ok(
  format($$update public.household_licenses set status = 'active' where household_id = %L$$, :'hid'),
  '42501', null, 'a member cannot update a licence'
);

select throws_ok(
  format($$insert into public.household_licenses (household_id, status) values (%L, 'active')$$, :'hid'),
  '42501', null, 'nor insert one'
);

select throws_ok(
  format($$delete from public.household_licenses where household_id = %L$$, :'hid'),
  '42501', null, 'nor delete one'
);

select tests.authenticate_as(:'eva');

select is(
  (select count(*) from public.household_licenses),
  0::bigint,
  'someone outside the household does not see its licence'
);

set local role anon;
select throws_ok(
  $$select count(*) from public.household_licenses$$,
  '42501', null, 'anon cannot read licences'
);
reset role;

select tests.authenticate_as(:'ana');

select throws_ok(
  format($$select public.apply_billing_event(%L, 'active', null, 'revenuecat', 'sub', null)$$, :'hid'),
  '42501', null, 'the client cannot call the webhook''s door'
);

select is(public.billing_enabled(), false, 'billing_enabled says the switch is off');

-- my_households -------------------------------------------------------------

select results_eq(
  $$select name, role, member_count, license_status, licensed from public.my_households()$$,
  $$values ('Casa'::text, 'owner'::text, 2, 'complimentary'::text, true)$$,
  'my_households lists the household with its role, size and licence'
);

-- With billing off every state is licensed ------------------------------------

select tests.clear_auth();
update public.household_licenses set status = 'canceled', current_period_end = now() - interval '30 days'
where household_id = :'hid';
select tests.authenticate_as(:'ana');

select lives_ok(
  format($$select public.add_shopping_item('00000000-0000-0000-0000-0000000000d3', %L, 'Sal', null)$$, :'hid'),
  'with billing off even a canceled licence lets the household write'
);

select is(
  (select licensed from public.my_households()),
  true,
  'and my_households says it is licensed'
);

select throws_ok(
  format($$select public.start_household_checkout(%L)$$, :'hid'),
  'P0001', 'BILLING_DISABLED', 'with billing off the checkout says so'
);

select tests.clear_auth();
select tests.authenticate_as(:'bob');
select throws_ok(
  format($$select public.start_household_checkout(%L)$$, :'hid'),
  'P0001', 'NOT_OWNER', 'only whoever leads the household starts the checkout'
);

set local role service_role;
select is(
  public.apply_billing_event(:'hid', 'active', now() + interval '30 days', 'revenuecat', 'sub_1', :'bob'),
  false,
  'with billing off the webhook changes nothing'
);
reset role;

select tests.clear_auth();
select is(
  (select status from public.household_licenses where household_id = :'hid'),
  'canceled',
  'and the licence is as it was'
);

-- Billing on ------------------------------------------------------------------

update private.app_settings set billing_enabled = true;

select tests.authenticate_as(:'eva');
select public.create_household('Casa de Eva') as eva_hid \gset

select ok(
  (select status = 'trial'
      and trial_ends_at between now() + interval '14 days' - interval '1 minute'
                            and now() + interval '14 days' + interval '1 minute'
    from public.household_licenses where household_id = :'eva_hid'),
  'with billing on a new household starts a 14-day trial'
);

select is(
  public.start_household_checkout(:'eva_hid'),
  jsonb_build_object('provider', 'revenuecat', 'offering', 'household_monthly', 'household_id', :'eva_hid'::uuid),
  'and its lead gets what the provider needs to pay'
);

select lives_ok(
  format($$select public.add_shopping_item('00000000-0000-0000-0000-0000000000e1', %L, 'Sal', null)$$, :'eva_hid'),
  'a running trial lets the household write'
);

-- Ana's household is canceled: every write RPC answers LICENSE_REQUIRED.
select tests.authenticate_as(:'ana');

select is((select licensed from public.my_households()), false, 'a canceled licence is not licensed');

select is(
  (select license_ends_at < now() from public.my_households()),
  true,
  'and my_households says when it ended'
);

select throws_ok(
  format($$select public.create_task('00000000-0000-0000-0000-0000000000c9', %L, 'Planchar', null, null, null, null)$$, :'hid'),
  'P0001', 'LICENSE_REQUIRED', 'create_task is guarded'
);
select throws_ok(
  $$select public.update_task('00000000-0000-0000-0000-0000000000c1', 'Barrer bien', null, null, null, null)$$,
  'P0001', 'LICENSE_REQUIRED', 'update_task is guarded'
);
select throws_ok(
  $$select public.complete_task('00000000-0000-0000-0000-0000000000c1', current_date)$$,
  'P0001', 'LICENSE_REQUIRED', 'complete_task is guarded'
);
select throws_ok(
  $$select public.skip_task('00000000-0000-0000-0000-0000000000c2', current_date)$$,
  'P0001', 'LICENSE_REQUIRED', 'skip_task is guarded'
);
select throws_ok(
  $$select public.reopen_task('00000000-0000-0000-0000-0000000000c1')$$,
  'P0001', 'LICENSE_REQUIRED', 'reopen_task is guarded'
);
select throws_ok(
  $$select public.delete_task('00000000-0000-0000-0000-0000000000c1')$$,
  'P0001', 'LICENSE_REQUIRED', 'delete_task is guarded'
);
select throws_ok(
  format($$select public.add_shopping_item('00000000-0000-0000-0000-0000000000d9', %L, 'Huevos', null)$$, :'hid'),
  'P0001', 'LICENSE_REQUIRED', 'add_shopping_item is guarded'
);
select throws_ok(
  $$select public.set_item_bought('00000000-0000-0000-0000-0000000000d1', true)$$,
  'P0001', 'LICENSE_REQUIRED', 'set_item_bought is guarded'
);
select throws_ok(
  $$select public.update_shopping_item('00000000-0000-0000-0000-0000000000d1', 'Leche', '2')$$,
  'P0001', 'LICENSE_REQUIRED', 'update_shopping_item is guarded'
);
select throws_ok(
  $$select public.delete_shopping_item('00000000-0000-0000-0000-0000000000d2')$$,
  'P0001', 'LICENSE_REQUIRED', 'delete_shopping_item is guarded'
);
select throws_ok(
  format($$select public.clear_bought_items(%L)$$, :'hid'),
  'P0001', 'LICENSE_REQUIRED', 'clear_bought_items is guarded'
);
select throws_ok(
  format($$select public.create_invite(%L)$$, :'hid'),
  'P0001', 'LICENSE_REQUIRED', 'create_invite is guarded'
);

-- Reading is never blocked.
select is((select count(*) from public.task_occurrences where household_id = :'hid'), 2::bigint,
  'the tasks still read');
select is((select count(*) from public.shopping_items where household_id = :'hid'), 3::bigint,
  'the shopping still reads');
select is((select count(*) from public.household_members where household_id = :'hid'), 2::bigint,
  'the members still read');

-- Nor is getting out.
select tests.authenticate_as(:'bob');
select lives_ok(
  format($$select public.leave_household(%L)$$, :'hid'),
  'leaving an unlicensed household is never blocked'
);

-- Each state with billing on.
select tests.authenticate_as(:'ana');

create function pg_temp.licensed_as(p_status text, p_trial_ends timestamptz, p_period_end timestamptz)
returns boolean language plpgsql as $$
begin
  reset role;
  update public.household_licenses
  set status = p_status, trial_ends_at = p_trial_ends, current_period_end = p_period_end,
      updated_at = now()
  where household_id = (select id from public.households where name = 'Casa');
  set local role authenticated;
  return (select licensed from public.my_households() where name = 'Casa');
end;
$$;

select is(pg_temp.licensed_as('complimentary', null, null), true, 'complimentary is licensed');
select is(pg_temp.licensed_as('active', null, now() + interval '20 days'), true, 'active is licensed');
select is(pg_temp.licensed_as('trial', now() + interval '1 day', null), true, 'a running trial is licensed');
select is(pg_temp.licensed_as('trial', now() - interval '1 minute', null), false, 'an ended trial is not');
select is(pg_temp.licensed_as('past_due', null, now() - interval '6 days'), true, 'past_due within the 7-day grace is licensed');
select is(pg_temp.licensed_as('past_due', null, now() - interval '8 days'), false, 'past_due beyond the grace is not');
select is(pg_temp.licensed_as('canceled', null, now() + interval '1 day'), false, 'canceled is not');

-- The webhook's door with billing on.
select tests.clear_auth();
set local role service_role;
select is(
  public.apply_billing_event(:'hid', 'active', now() + interval '30 days', 'revenuecat', 'sub_1', :'ana'),
  true,
  'with billing on the webhook updates the licence'
);
reset role;

select is(
  (select status || ' ' || provider || ' ' || provider_subscription_id
    from public.household_licenses where household_id = :'hid'),
  'active revenuecat sub_1',
  'to the new state'
);

set local role service_role;
select throws_ok(
  format($$select public.apply_billing_event(%L, 'complimentary', null, null, null, null)$$, :'hid'),
  'P0001', 'INVALID_LICENSE_STATUS', 'the webhook cannot hand out a complimentary licence'
);
reset role;

select tests.authenticate_as(:'ana');
select lives_ok(
  format($$select public.add_shopping_item('00000000-0000-0000-0000-0000000000d8', %L, 'Huevos', null)$$, :'hid'),
  'once paid, the household writes again'
);

-- Passing the household on keeps the payer.
select tests.authenticate_as(:'eva');
select token as tok_eva from public.create_invite(:'eva_hid') \gset
select tests.authenticate_as(:'bob');
select public.accept_invite(:'tok_eva');
select tests.authenticate_as(:'eva');
select public.transfer_ownership(:'eva_hid', :'bob');
select tests.clear_auth();

select is(
  (select paid_by from public.household_licenses where household_id = :'eva_hid'),
  :'eva'::uuid,
  'passing the household on keeps who pays its licence'
);

-- The switch back off.
update private.app_settings set billing_enabled = false;
update public.household_licenses set status = 'canceled' where household_id = :'hid';
select tests.authenticate_as(:'ana');

select lives_ok(
  format($$select public.add_shopping_item('00000000-0000-0000-0000-0000000000d7', %L, 'Aceite', null)$$, :'hid'),
  'switching billing off lets every household write again'
);

select tests.clear_auth();
select is(
  (select count(*) from public.households h
    where not exists (select 1 from public.household_licenses l where l.household_id = h.id)),
  0::bigint,
  'every household has its licence'
);

select * from finish();
rollback;
