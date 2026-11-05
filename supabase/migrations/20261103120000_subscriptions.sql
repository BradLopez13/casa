-- Bloque 15.6: the billing model decided on 27 October, built (DESIGN.md, «El cobro que permiten
-- las tiendas»): one subscription group per person with a level per number of households
-- (casas_1 … casas_10). The person who pays chooses which of the households they lead the level
-- covers (by default the ones they lead, oldest first); each covered household's licence follows
-- the subscription. Going down a level lets go of the last ones chosen. The licence stays with
-- the household when it is handed over: paid_by only changes when a subscription that covers it
-- changes hands (TRANSFER) or someone else's covers it. Every webhook event is applied once, by
-- its id. Billing stays off: nothing here runs until private.enable_billing().

-- Tables ------------------------------------------------------------------------------------------

-- Which provider events were applied: a retried delivery changes nothing twice.
create table private.billing_events (
  provider text not null,
  event_id text not null,
  applied_at timestamptz not null default now(),
  primary key (provider, event_id)
);

-- One row per subscription the provider knows: whose, which level, in which state.
create table private.subscriptions (
  provider text not null check (provider in ('revenuecat', 'stripe')),
  subscription_id text not null,
  paid_by uuid references public.profiles (user_id) on delete set null,
  product_id text,
  level int not null default 1 check (level between 1 and 10),
  status text not null check (status in ('active', 'past_due', 'canceled')),
  current_period_end timestamptz,
  last_event_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (provider, subscription_id)
);

revoke all on table private.billing_events from public, anon, authenticated;
revoke all on table private.subscriptions from public, anon, authenticated;

-- The households a subscription covers, in the order the payer chose (the last go first when the
-- level goes down). The payer reads it; only the server writes it.
create table public.subscription_households (
  provider text not null,
  subscription_id text not null,
  household_id uuid not null references public.households (id) on delete cascade,
  position int not null,
  chosen_at timestamptz not null default now(),
  primary key (provider, subscription_id, household_id),
  foreign key (provider, subscription_id)
    references private.subscriptions (provider, subscription_id) on delete cascade
);

alter table public.subscription_households enable row level security;
revoke all on public.subscription_households from public, anon, authenticated;
grant select on public.subscription_households to authenticated;

create function private.subscription_payer(p_provider text, p_subscription_id text)
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select s.paid_by from private.subscriptions s
  where s.provider = p_provider and s.subscription_id = p_subscription_id;
$$;

-- The policy below runs it as the reader: executable, but it only answers who pays a
-- subscription whose id the reader already knows.
revoke execute on function private.subscription_payer(text, text) from public, anon;
grant execute on function private.subscription_payer(text, text) to authenticated;

create policy subscription_households_select_payer on public.subscription_households
  for select to authenticated
  using (private.subscription_payer(provider, subscription_id) = (select auth.uid()));

-- The default offering RevenueCat serves is called «default» (store/productos.md).
update private.app_settings set checkout_offering = 'default'
where checkout_offering = 'household_monthly';
alter table private.app_settings alter column checkout_offering set default 'default';

-- Coverage ----------------------------------------------------------------------------------------

/* The households a person leads (owner, still in, household not deleted), oldest first. */
create function private.households_led_by(p_user uuid)
returns setof uuid
language sql
stable
security definer
set search_path = ''
as $$
  select h.id
  from public.households h
  join public.household_members m on m.household_id = h.id
  where m.user_id = p_user and m.role = 'owner' and m.left_at is null and h.deleted_at is null
  order by h.created_at, h.id;
$$;

revoke execute on function private.households_led_by(uuid) from public, anon, authenticated;

/*
 * Puts a subscription's coverage right and writes it into the licences: the chosen households
 * the payer still leads, filled up to the level with the ones they lead that no subscription
 * covers (oldest first), and never more than the level (the last chosen let go, their licence
 * canceled at the period's end). Every covered household's licence takes the subscription's
 * state, date and payer.
 */
create function private.apply_subscription_coverage(p_provider text, p_subscription_id text)
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

  -- A household stays covered though its payer handed it over (the licence stays with the
  -- household, decisión de Brad, 26 oct): only cancelling, or the new lead's own subscription
  -- naming it, takes it out. A deleted household leaves by itself (cascade).

  select count(*), coalesce(max(position), -1) + 1 into v_have, v_next
  from public.subscription_households sh
  where sh.provider = p_provider and sh.subscription_id = p_subscription_id;

  -- Fill up to the level with what the payer leads and nothing covers yet.
  if v_have < v_sub.level and v_sub.paid_by is not null then
    insert into public.subscription_households (provider, subscription_id, household_id, position)
    select p_provider, p_subscription_id, led, v_next - 1 + row_number() over ()
    from (
      select led
      from private.households_led_by(v_sub.paid_by) as led
      where not exists (select 1 from public.subscription_households x where x.household_id = led)
      limit v_sub.level - v_have
    ) as fill;
  end if;

  -- Over the level: the last chosen go, canceled at the period's end.
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

revoke execute on function private.apply_subscription_coverage(text, text)
  from public, anon, authenticated;

-- The webhook's door, with levels and idempotence ----------------------------------------------------

drop function public.apply_billing_event(uuid, text, timestamptz, text, text, uuid, boolean, timestamptz);

-- The billing webhook's only door into the licences (service role only). With billing off it
-- changes nothing and says so (false). An event already applied (p_event_id) changes nothing. A
-- first purchase (p_initial) by someone ties the subscription to that person and, when the event
-- names a household they lead, to it first; the level comes from the product (casas_n). Every
-- later event finds the subscription by its id, ignores the household the event names, and may
-- keep the state (p_status null: a transfer) or change the payer (p_paid_by: a transfer). An event
-- older than the last one applied changes nothing. Returns whether something changed.
create function public.apply_billing_event(
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

  if p_event_id is not null then
    insert into private.billing_events (provider, event_id) values (p_provider, p_event_id)
    on conflict do nothing;
    if not found then
      return false;
    end if;
  end if;

  v_level := case
    when p_product_id ~ '^casas_(10|[1-9])$' then substring(p_product_id from 7)::int
    else null
  end;

  -- A payer the database does not know is left as it was.
  select p.user_id into v_payer from public.profiles p where p.user_id = p_paid_by;

  select * into v_sub from private.subscriptions s
  where s.provider = p_provider and s.subscription_id = p_subscription_id
  for update;

  if not found then
    -- Only a first purchase, by someone the database knows, makes a subscription; a household
    -- the event names must be one they lead.
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
      delete from public.subscription_households sh
      where sh.household_id = p_household_id
        and (sh.provider, sh.subscription_id) <> (p_provider, p_subscription_id);
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
        -- past_due without a date keeps the one it had, or starts its grace now, once.
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
  return true;
end;
$$;

revoke execute on function public.apply_billing_event(
  uuid, text, timestamptz, text, text, uuid, boolean, timestamptz, text, text
) from public, anon, authenticated;
grant execute on function public.apply_billing_event(
  uuid, text, timestamptz, text, text, uuid, boolean, timestamptz, text, text
) to service_role;

-- What the person pays, and choosing what it covers ---------------------------------------------------

-- The caller's subscription, with the households it covers in their order; none when they pay
-- nothing.
create function public.my_subscription()
returns table (
  provider text,
  subscription_id text,
  product_id text,
  level int,
  status text,
  current_period_end timestamptz,
  household_ids uuid[]
)
language sql
stable
security definer
set search_path = ''
as $$
  select s.provider, s.subscription_id, s.product_id, s.level, s.status, s.current_period_end,
    coalesce(
      (select array_agg(sh.household_id order by sh.position)
       from public.subscription_households sh
       where sh.provider = s.provider and sh.subscription_id = s.subscription_id),
      '{}'::uuid[]
    )
  from private.subscriptions s
  where s.paid_by = (select auth.uid()) and s.status <> 'canceled'
  order by s.updated_at desc
  limit 1;
$$;

revoke execute on function public.my_subscription() from public, anon;
grant execute on function public.my_subscription() to authenticated;

-- The payer chooses which households their level covers: only ones they lead, no more than the
-- level, in the order given (the last let go first). The ones left out lose their licence at the
-- period's end.
create function public.choose_covered_households(
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

  for v_i in 1..array_length(p_household_ids, 1) loop
    insert into public.subscription_households (provider, subscription_id, household_id, position)
    values (p_provider, p_subscription_id, p_household_ids[v_i], v_i - 1)
    on conflict (provider, subscription_id, household_id) do update set position = v_i - 1;
  end loop;

  perform private.apply_subscription_coverage(p_provider, p_subscription_id);
end;
$$;

revoke execute on function public.choose_covered_households(text, text, uuid[]) from public, anon;
grant execute on function public.choose_covered_households(text, text, uuid[]) to authenticated;

-- The checkout says which level the person needs: the households they lead (one at least).
create or replace function public.start_household_checkout(p_household_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_user uuid := (select auth.uid());
  v_settings private.app_settings;
  v_level int;
begin
  if v_user is null then
    raise exception 'NOT_AUTHENTICATED' using errcode = 'P0001';
  end if;

  if not private.is_owner(p_household_id) then
    raise exception 'NOT_OWNER' using errcode = 'P0001';
  end if;

  select * into v_settings from private.app_settings;
  if not coalesce(v_settings.billing_enabled, false) then
    raise exception 'BILLING_DISABLED' using errcode = 'P0001';
  end if;

  select least(10, greatest(1, count(*))) into v_level from private.households_led_by(v_user);

  return jsonb_build_object(
    'provider', v_settings.billing_provider,
    'offering', v_settings.checkout_offering,
    'household_id', p_household_id,
    'level', v_level,
    'product_id', 'casas_' || v_level
  );
end;
$$;
