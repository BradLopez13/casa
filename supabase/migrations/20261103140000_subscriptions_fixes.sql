-- Bloque 15.6, revisión: what the first model got wrong, fixed before anyone pays.
--
-- 1. A lapsed subscription bought again (Play gives it a new purchase token) must cover the
--    households the old one covered: only a live subscription holds a household.
-- 2. Going down a level lets go of the last chosen household «at the period's end»: a licence
--    canceled with time left is still licensed until then.
-- 3. A household sits in one subscription at most (unique), also when the payer chooses.
-- 4. A soft-deleted household gives its slot back.
-- 5. Play reports its products as «casas_2:mensual» (product:base plan): the level is the part
--    before the colon.
-- 6. Nobody but the payer can learn who pays a subscription: the policy asks «is it mine?».
-- 7. An event counts as applied only once it was applied; one refused keeps its id free.
-- 8. RevenueCat's TRANSFER names no subscription, only who loses and who gains them:
--    transfer_subscriptions moves every subscription of those people.

-- 2 ------------------------------------------------------------------------------------------------
create or replace function private.household_is_licensed(p_household_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select not private.billing_enabled() or exists (
    select 1
    from public.household_licenses l
    cross join private.app_settings s
    where l.household_id = p_household_id
      and (
        l.status = 'complimentary'
        or (l.status = 'active'
            and coalesce(l.current_period_end, 'infinity'::timestamptz)
                + make_interval(days => s.grace_days) > now())
        or (l.status = 'trial' and l.trial_ends_at > now())
        or (l.status = 'past_due'
            and coalesce(l.current_period_end, l.updated_at)
                + make_interval(days => s.grace_days) > now())
        -- Canceled, but paid until then (a level gone down, a subscription that will not renew).
        or (l.status = 'canceled' and l.current_period_end > now())
      )
  );
$$;

-- 3 ------------------------------------------------------------------------------------------------
alter table public.subscription_households
  add constraint subscription_households_one_subscription unique (household_id);

-- 6 ------------------------------------------------------------------------------------------------
create function private.pays_subscription(p_provider text, p_subscription_id text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from private.subscriptions s
    where s.provider = p_provider and s.subscription_id = p_subscription_id
      and s.paid_by = (select auth.uid())
  );
$$;

revoke execute on function private.pays_subscription(text, text) from public, anon;
grant execute on function private.pays_subscription(text, text) to authenticated;

drop policy subscription_households_select_payer on public.subscription_households;
create policy subscription_households_select_payer on public.subscription_households
  for select to authenticated
  using (private.pays_subscription(provider, subscription_id));

revoke execute on function private.subscription_payer(text, text) from public, anon, authenticated;

-- 1, 4, 5 ------------------------------------------------------------------------------------------
create or replace function private.apply_subscription_coverage(p_provider text, p_subscription_id text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_sub private.subscriptions;
  v_have int;
  v_next int;
  v_dropped uuid;
begin
  select * into v_sub from private.subscriptions s
  where s.provider = p_provider and s.subscription_id = p_subscription_id
  for update;
  if not found then
    return;
  end if;

  -- A household that was deleted gives its slot back (the cascade only fires on the purge).
  delete from public.subscription_households sh
  where sh.provider = p_provider and sh.subscription_id = p_subscription_id
    and exists (select 1 from public.households h where h.id = sh.household_id and h.deleted_at is not null);

  -- A household stays covered though its payer handed it over (the licence stays with the
  -- household, decisión de Brad, 26 oct): only cancelling, or the new lead's own subscription
  -- naming it, takes it out.

  select count(*), coalesce(max(position), -1) + 1 into v_have, v_next
  from public.subscription_households sh
  where sh.provider = p_provider and sh.subscription_id = p_subscription_id;

  -- Fill up to the level with what the payer leads and no live subscription covers; a canceled
  -- subscription lets go of what the payer leads (bought again after a lapse: a new token).
  if v_have < v_sub.level and v_sub.paid_by is not null and v_sub.status <> 'canceled' then
    delete from public.subscription_households x
    using private.subscriptions s
    where s.provider = x.provider and s.subscription_id = x.subscription_id
      and s.status = 'canceled'
      and (x.provider, x.subscription_id) <> (p_provider, p_subscription_id)
      and x.household_id in (select private.households_led_by(v_sub.paid_by));
    insert into public.subscription_households (provider, subscription_id, household_id, position)
    select p_provider, p_subscription_id, led, v_next - 1 + row_number() over ()
    from (
      select led
      from private.households_led_by(v_sub.paid_by) as led
      where not exists (
        select 1
        from public.subscription_households x
        join private.subscriptions s on s.provider = x.provider and s.subscription_id = x.subscription_id
        where x.household_id = led and s.status <> 'canceled'
      )
      limit v_sub.level - v_have
    ) as fill
    on conflict (household_id) do nothing;
  end if;

  -- Over the level: the last chosen go, canceled at the period's end (licensed until then).
  for v_dropped in
    delete from public.subscription_households sh
    where sh.provider = p_provider and sh.subscription_id = p_subscription_id
      and sh.household_id in (
        select household_id from public.subscription_households
        where provider = p_provider and subscription_id = p_subscription_id
        order by position
        offset v_sub.level
      )
    returning sh.household_id
  loop
    update public.household_licenses
    set status = 'canceled',
        current_period_end = coalesce(v_sub.current_period_end, now()),
        updated_at = now()
    where household_id = v_dropped;
  end loop;

  -- What is covered follows the subscription.
  update public.household_licenses l
  set status = v_sub.status,
      current_period_end = v_sub.current_period_end,
      provider = v_sub.provider,
      provider_subscription_id = v_sub.subscription_id,
      paid_by = coalesce(v_sub.paid_by, l.paid_by),
      last_event_at = coalesce(v_sub.last_event_at, l.last_event_at),
      updated_at = now()
  where l.household_id in (
    select household_id from public.subscription_households
    where provider = p_provider and subscription_id = p_subscription_id
  );
end;
$$;

-- The level from a product id, with or without Play's base plan («casas_2:mensual»).
create function private.level_of_product(p_product_id text)
returns int
language sql
immutable
set search_path = ''
as $$
  select case
    when split_part(p_product_id, ':', 1) ~ '^casas_(10|[1-9])$'
      then substring(split_part(p_product_id, ':', 1) from 7)::int
    else null
  end;
$$;

revoke execute on function private.level_of_product(text) from public, anon, authenticated;

-- 5, 7 ----------------------------------------------------------------------------------------------
create or replace function public.apply_billing_event(
  p_household_id uuid,
  p_status text,
  p_period_end timestamptz,
  p_provider text,
  p_subscription_id text,
  p_paid_by uuid,
  p_initial boolean,
  p_event_at timestamptz,
  p_product_id text default null,
  p_event_id text default null
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_sub private.subscriptions;
  v_payer uuid;
  v_level int;
begin
  if not private.billing_enabled() then
    return false;
  end if;

  if p_status is not null and p_status not in ('active', 'past_due', 'canceled') then
    raise exception 'INVALID_LICENSE_STATUS' using errcode = 'P0001';
  end if;

  if p_subscription_id is null or p_provider is null
     or p_provider not in ('revenuecat', 'stripe') then
    return false;
  end if;

  -- Applied already: a retried delivery changes nothing (the id is taken at the end, so an
  -- event refused here keeps its id free for a later, complete delivery).
  if p_event_id is not null and exists (
    select 1 from private.billing_events e where e.provider = p_provider and e.event_id = p_event_id
  ) then
    return false;
  end if;

  v_level := private.level_of_product(p_product_id);

  -- A payer the database does not know is left as it was.
  select p.user_id into v_payer from public.profiles p where p.user_id = p_paid_by;

  select * into v_sub from private.subscriptions s
  where s.provider = p_provider and s.subscription_id = p_subscription_id
  for update;

  if not found then
    if not coalesce(p_initial, false) or v_payer is null or p_status is null then
      return false;
    end if;
    if p_household_id is not null and p_household_id not in (
      select private.households_led_by(v_payer)
    ) then
      return false;
    end if;

    insert into private.subscriptions
      (provider, subscription_id, paid_by, product_id, level, status, current_period_end, last_event_at)
    values (
      p_provider, p_subscription_id, v_payer, p_product_id, coalesce(v_level, 1), p_status,
      coalesce(p_period_end, case when p_status = 'past_due' then now() end),
      coalesce(p_event_at, now())
    );
    if p_household_id is not null then
      -- The new lead takes the household over from whoever's subscription covered it.
      delete from public.subscription_households sh where sh.household_id = p_household_id;
      insert into public.subscription_households (provider, subscription_id, household_id, position)
      values (p_provider, p_subscription_id, p_household_id, 0);
    end if;
  else
    if p_event_at is not null and v_sub.last_event_at is not null
       and p_event_at < v_sub.last_event_at then
      return false;
    end if;

    update private.subscriptions s
    set status = coalesce(p_status, s.status),
        product_id = coalesce(p_product_id, s.product_id),
        level = coalesce(v_level, s.level),
        current_period_end = coalesce(
          p_period_end,
          s.current_period_end,
          case when p_status = 'past_due' then now() end
        ),
        paid_by = coalesce(v_payer, s.paid_by),
        last_event_at = coalesce(p_event_at, now()),
        updated_at = now()
    where s.provider = p_provider and s.subscription_id = p_subscription_id;
  end if;

  perform private.apply_subscription_coverage(p_provider, p_subscription_id);

  if p_event_id is not null then
    insert into private.billing_events (provider, event_id) values (p_provider, p_event_id)
    on conflict do nothing;
  end if;
  return true;
end;
$$;

-- 3 (the payer's choice) --------------------------------------------------------------------------------
create or replace function public.choose_covered_households(
  p_provider text,
  p_subscription_id text,
  p_household_ids uuid[]
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := (select auth.uid());
  v_sub private.subscriptions;
  v_dropped uuid;
  v_i int;
begin
  if v_user is null then
    raise exception 'NOT_AUTHENTICATED' using errcode = 'P0001';
  end if;

  select * into v_sub from private.subscriptions s
  where s.provider = p_provider and s.subscription_id = p_subscription_id and s.paid_by = v_user
  for update;
  if not found then
    raise exception 'NOT_OWNER' using errcode = 'P0001';
  end if;

  if p_household_ids is null or array_length(p_household_ids, 1) is null
     or array_length(p_household_ids, 1) > v_sub.level
     or (select count(distinct id) from unnest(p_household_ids) as id) <> array_length(p_household_ids, 1)
     or exists (
       select 1 from unnest(p_household_ids) as id
       where id not in (select private.households_led_by(v_user))
     ) then
    raise exception 'NOT_OWNER' using errcode = 'P0001';
  end if;

  for v_dropped in
    delete from public.subscription_households sh
    where sh.provider = p_provider and sh.subscription_id = p_subscription_id
      and sh.household_id <> all (p_household_ids)
    returning sh.household_id
  loop
    update public.household_licenses
    set status = 'canceled',
        current_period_end = coalesce(v_sub.current_period_end, now()),
        updated_at = now()
    where household_id = v_dropped;
  end loop;

  -- A chosen household leaves whoever else's subscription covered it.
  delete from public.subscription_households sh
  where sh.household_id = any (p_household_ids)
    and (sh.provider, sh.subscription_id) <> (p_provider, p_subscription_id);

  for v_i in 1..array_length(p_household_ids, 1) loop
    insert into public.subscription_households (provider, subscription_id, household_id, position)
    values (p_provider, p_subscription_id, p_household_ids[v_i], v_i - 1)
    on conflict (provider, subscription_id, household_id) do update set position = v_i - 1;
  end loop;

  perform private.apply_subscription_coverage(p_provider, p_subscription_id);
end;
$$;

-- 8 ------------------------------------------------------------------------------------------------
-- RevenueCat's TRANSFER: every subscription of the people who lose them goes to the one who gains
-- them, keeping its state and what it covers (the licence stays with the household).
create function public.transfer_subscriptions(
  p_from uuid[],
  p_to uuid,
  p_event_id text,
  p_event_at timestamptz
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_to uuid;
  v_sub record;
  v_moved boolean := false;
begin
  if not private.billing_enabled() then
    return false;
  end if;
  if p_event_id is not null and exists (
    select 1 from private.billing_events e where e.provider = 'revenuecat' and e.event_id = p_event_id
  ) then
    return false;
  end if;
  select p.user_id into v_to from public.profiles p where p.user_id = p_to;
  if v_to is null or p_from is null then
    return false;
  end if;

  for v_sub in
    update private.subscriptions s
    set paid_by = v_to, last_event_at = coalesce(p_event_at, now()), updated_at = now()
    where s.provider = 'revenuecat' and s.paid_by = any (p_from)
    returning s.provider, s.subscription_id
  loop
    v_moved := true;
    perform private.apply_subscription_coverage(v_sub.provider, v_sub.subscription_id);
  end loop;

  if p_event_id is not null then
    insert into private.billing_events (provider, event_id) values ('revenuecat', p_event_id)
    on conflict do nothing;
  end if;
  return v_moved;
end;
$$;

revoke execute on function public.transfer_subscriptions(uuid[], uuid, text, timestamptz)
  from public, anon, authenticated;
grant execute on function public.transfer_subscriptions(uuid[], uuid, text, timestamptz) to service_role;
