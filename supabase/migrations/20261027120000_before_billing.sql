-- Before switching billing on (bloque 13, 13.7): what is closed in SQL now, so that
-- apply_billing_event is not tied to something the stores do not allow and nobody gets a free ride.
--
-- The billing model is decided and written (decisión 4 de Brad, 27 de octubre; DESIGN.md, README,
-- supabase/functions/_shared/billing.ts): the stores allow one subscription per product and
-- account, so a person who runs two households cannot hold two «household_monthly». One
-- subscription group per person, with a level per number of households (casas_1, casas_2…, price
-- n × amount). «One licence per household» stays in what the person pays; the household rows keep
-- their status, and the event that binds a subscription will name how many it covers. Nothing of
-- that is built yet: billing stays off.

-- 1 · A cap on households per person -------------------------------------------------------------

-- With billing on, every new household would start a trial; without a cap, a script could create
-- them without end. Ten covers anyone who runs a few homes.
create or replace function public.create_household(p_name text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := (select auth.uid());
  v_name text := btrim(p_name);
  v_id uuid;
begin
  if v_user is null then
    raise exception 'NOT_AUTHENTICATED' using errcode = 'P0001';
  end if;

  if v_name is null or char_length(v_name) not between 1 and 60 then
    raise exception 'INVALID_NAME' using errcode = 'P0001';
  end if;

  if (
    select count(*)
    from public.household_members m
    where m.user_id = v_user and m.left_at is null
  ) >= 10 then
    raise exception 'TOO_MANY_HOUSEHOLDS' using errcode = 'P0001';
  end if;

  insert into public.households (name, created_by)
  values (v_name, v_user)
  returning id into v_id;

  insert into public.household_members (household_id, user_id, role)
  values (v_id, v_user, 'owner');

  return v_id;
end;
$$;

-- 2 · One trial per person, not per household -----------------------------------------------------

-- Who has had a trial: it outlives the household (deleting one and creating another gives no
-- second trial). Only the server reads or writes it.
create table private.trial_grants (
  user_id uuid primary key references auth.users (id) on delete cascade,
  granted_at timestamptz not null default now()
);

-- Every new household gets its licence: complimentary while billing is off; with it on, a trial
-- for whoever creates it the first time, and a trial already over for anyone who had one (the
-- household is there to read; writing waits for its licence).
create or replace function private.create_household_license()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_settings private.app_settings;
  v_first boolean;
begin
  select * into v_settings from private.app_settings;
  if not coalesce(v_settings.billing_enabled, false) then
    insert into public.household_licenses (household_id, status, paid_by)
    values (new.id, 'complimentary', new.created_by);
    return new;
  end if;

  insert into private.trial_grants (user_id)
  values (new.created_by)
  on conflict (user_id) do nothing;
  v_first := found;

  insert into public.household_licenses (household_id, status, paid_by, trial_ends_at)
  values (
    new.id,
    'trial',
    new.created_by,
    case when v_first then now() + make_interval(days => v_settings.trial_days) else now() end
  );
  return new;
end;
$$;

revoke execute on function private.create_household_license() from public, anon, authenticated;

-- 3 · What happens to the complimentary licences when billing is switched on -----------------------

-- Decided in writing (13.7): the households that had everything for free get a 14-day trial from
-- the moment billing is switched on, and their payer has had their trial. Whoever runs the project
-- switches billing on with this, never by flipping the column alone.
create function private.enable_billing()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_days int;
begin
  update private.app_settings set billing_enabled = true returning trial_days into v_days;

  insert into private.trial_grants (user_id)
  select distinct l.paid_by
  from public.household_licenses l
  where l.status = 'complimentary' and l.paid_by is not null
  on conflict (user_id) do nothing;

  update public.household_licenses
  set status = 'trial', trial_ends_at = now() + make_interval(days => v_days)
  where status = 'complimentary';
end;
$$;

revoke execute on function private.enable_billing() from public, anon, authenticated;

-- 4 · A push token is not taken from its owner ------------------------------------------------------

-- Registering a token another person holds moves it only when that person has not refreshed it in
-- 30 days (a phone that changed hands long ago); otherwise it stays theirs. Knowing someone's Expo
-- token was enough to cut their notices (Aud P3-8). A sign-out unregisters first, and an unasked
-- one gives the token up on the phone, so the next person gets a new one.
create or replace function public.register_push_token(p_token text, p_platform text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := (select auth.uid());
begin
  if v_user is null then
    raise exception 'NOT_AUTHENTICATED' using errcode = 'P0001';
  end if;

  -- Only Expo push tokens: ExponentPushToken[...] or ExpoPushToken[...].
  if p_token is null or char_length(p_token) not between 10 and 200
     or p_token !~ '^Expo(nent)?PushToken\[[^\]]+\]$'
     or p_platform is null or p_platform not in ('android', 'ios') then
    raise exception 'INVALID_PUSH_TOKEN' using errcode = 'P0001';
  end if;

  insert into public.push_tokens (token, user_id, platform, updated_at)
  values (p_token, v_user, p_platform, now())
  on conflict (token) do update
    set user_id = excluded.user_id,
        platform = excluded.platform,
        updated_at = now()
    where public.push_tokens.user_id = excluded.user_id
       or public.push_tokens.updated_at < now() - interval '30 days';

  -- Ten devices per user at most: the newest ten stay (the one just registered always does).
  delete from public.push_tokens t
  where t.user_id = v_user
    and t.token not in (
      select k.token
      from public.push_tokens k
      where k.user_id = v_user
      order by (k.token = p_token) desc, k.updated_at desc, k.token
      limit 10
    );
end;
$$;

-- 5 · The functions builds before bloque 12 still call ----------------------------------------------

comment on function public.set_household_rooms(text[]) is
  'Obsoleta desde el bloque 12 (picks «the most recent household»). Retirar cuando no queden builds anteriores al bloque 12 en los móviles, como tarde el 31 de enero de 2027. Usar set_household_rooms(uuid, text[]).';
comment on function public.accept_invite(text) is
  'Obsoleta desde el bloque 12. Retirar cuando no queden builds anteriores al bloque 12, como tarde el 31 de enero de 2027. Usar accept_invite(text, boolean).';
