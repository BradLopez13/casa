-- One licence per household (bloque 12). Each household has a monthly licence, paid by whoever
-- leads it; two households, two licences. Billing is not switched on yet: everything is ready
-- behind private.app_settings.billing_enabled (false). While it is off, every household is
-- licensed, create_household records the licence as `complimentary` and nothing is asked.
-- Reading is never blocked; the write RPCs check the licence and answer LICENSE_REQUIRED.

-- The switch and its numbers. A single row, in the private schema: nothing from the API reads
-- or writes it; whoever runs the project flips it with SQL.
create table private.app_settings (
  id boolean primary key default true check (id),
  billing_enabled boolean not null default false,
  trial_days int not null default 14 check (trial_days between 0 and 90),
  grace_days int not null default 7 check (grace_days between 0 and 30),
  billing_provider text not null default 'revenuecat'
    check (billing_provider in ('revenuecat', 'stripe')),
  checkout_offering text not null default 'household_monthly'
);

insert into private.app_settings default values;

create function private.billing_enabled()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((select s.billing_enabled from private.app_settings s), false);
$$;

revoke execute on function private.billing_enabled() from public, anon, authenticated;

-- What the app and the billing webhook may know: whether billing is on.
create function public.billing_enabled()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.billing_enabled();
$$;

revoke execute on function public.billing_enabled() from public, anon;
grant execute on function public.billing_enabled() to authenticated, service_role;

create table public.household_licenses (
  household_id uuid primary key references public.households (id) on delete cascade,
  status text not null
    check (status in ('complimentary', 'trial', 'active', 'past_due', 'canceled')),
  plan text not null default 'monthly' check (plan in ('monthly')),
  provider text not null default 'none' check (provider in ('none', 'revenuecat', 'stripe')),
  provider_subscription_id text,
  -- Whoever pays: the person who created the household. Passing the household on does not
  -- change it (decisión de Brad, 26 oct): it stays until the payer cancels or the new lead takes
  -- it over.
  paid_by uuid references public.profiles (user_id) on delete set null,
  current_period_end timestamptz,
  trial_ends_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.household_licenses enable row level security;

revoke all on public.household_licenses from anon;
revoke all on public.household_licenses from authenticated;
grant select on public.household_licenses to authenticated;

-- Members read their households' licences; nobody writes them from the client.
create policy household_licenses_select_member on public.household_licenses
  for select to authenticated
  using (private.is_member(household_id));

-- Every new household gets its licence: complimentary while billing is off, a trial when on.
create function private.create_household_license()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_settings private.app_settings;
begin
  select * into v_settings from private.app_settings;
  insert into public.household_licenses (household_id, status, paid_by, trial_ends_at)
  values (
    new.id,
    case when coalesce(v_settings.billing_enabled, false) then 'trial' else 'complimentary' end,
    new.created_by,
    case when coalesce(v_settings.billing_enabled, false)
      then now() + make_interval(days => v_settings.trial_days) end
  );
  return new;
end;
$$;

revoke execute on function private.create_household_license() from public, anon, authenticated;

create trigger households_create_license
  after insert on public.households
  for each row execute function private.create_household_license();

-- The households that already exist are covered while billing is off.
insert into public.household_licenses (household_id, status, paid_by)
select h.id, 'complimentary', h.created_by
from public.households h
on conflict (household_id) do nothing;

-- A licence change reaches the household's phones like any other change.
create trigger household_licenses_broadcast_update
  after update on public.household_licenses referencing old table as old_rows new table as new_rows
  for each statement execute function private.broadcast_household_change();

-- Whether the household may be written to: always while billing is off; with billing on, a
-- complimentary or active licence, a trial still running, or a past_due one within the grace.
create function private.household_is_licensed(p_household_id uuid)
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
        l.status in ('complimentary', 'active')
        or (l.status = 'trial' and l.trial_ends_at > now())
        or (l.status = 'past_due'
            and coalesce(l.current_period_end, l.updated_at)
                + make_interval(days => s.grace_days) > now())
      )
  );
$$;

revoke execute on function private.household_is_licensed(uuid) from public, anon, authenticated;

create function private.assert_household_licensed(p_household_id uuid)
returns void
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not private.household_is_licensed(p_household_id) then
    raise exception 'LICENSE_REQUIRED' using errcode = 'P0001';
  end if;
end;
$$;

revoke execute on function private.assert_household_licensed(uuid) from public, anon, authenticated;

-- The write RPCs with the guard, right after their membership check. Bodies as they stood
-- (create_task, update_task and reopen_task from 20261009190324_recurrence_rpcs.sql,
-- delete_task from 20261005150102, close_occurrence, behind complete_task and skip_task, from
-- 20261026120000_complete_at_touch.sql, the shopping RPCs from 20261009202425_shopping.sql and
-- 20261018160000_drop_shopping_categories.sql, create_invite from 20261012135958), taken from
-- pg_get_functiondef. Leaving, removing, passing or deleting a household are not guarded: you
-- can always get out.

create or replace function public.delete_shopping_item(p_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_user uuid := (select auth.uid());
  v_hid uuid;
begin
  if v_user is null then
    raise exception 'NOT_AUTHENTICATED' using errcode = 'P0001';
  end if;

  select s.household_id into v_hid
  from public.shopping_items s
  where s.id = p_id;

  if not found then
    raise exception 'ITEM_NOT_FOUND' using errcode = 'P0001';
  end if;

  perform 1 from public.households
  where id = v_hid and deleted_at is null
  for share;

  if not found or not private.is_member(v_hid) then
    raise exception 'ITEM_NOT_FOUND' using errcode = 'P0001';
  end if;

  -- Bloque 12: writing needs the household's licence (always true while billing is off).
  perform private.assert_household_licensed(v_hid);

  delete from public.shopping_items where id = p_id;

  if not found then
    raise exception 'ITEM_NOT_FOUND' using errcode = 'P0001';
  end if;
end;
$function$;

create or replace function public.clear_bought_items(p_household_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_user uuid := (select auth.uid());
begin
  if v_user is null then
    raise exception 'NOT_AUTHENTICATED' using errcode = 'P0001';
  end if;

  perform 1 from public.households
  where id = p_household_id and deleted_at is null
  for share;

  if not found or not private.is_member(p_household_id) then
    raise exception 'NOT_A_MEMBER' using errcode = 'P0001';
  end if;

  -- Bloque 12: writing needs the household's licence (always true while billing is off).
  perform private.assert_household_licensed(p_household_id);

  update public.shopping_items
  set cleared_at = now()
  where household_id = p_household_id
    and bought_at is not null
    and cleared_at is null;
end;
$function$;

create or replace function public.delete_task(p_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_user uuid := (select auth.uid());
  v_hid uuid;
  v_series uuid;
  v_creator uuid;
begin
  if v_user is null then
    raise exception 'NOT_AUTHENTICATED' using errcode = 'P0001';
  end if;

  select o.household_id into v_hid
  from public.task_occurrences o
  where o.id = p_id;

  if not found then
    raise exception 'TASK_NOT_FOUND' using errcode = 'P0001';
  end if;

  perform 1 from public.households
  where id = v_hid and deleted_at is null
  for share;

  if not found or not private.is_member(v_hid) then
    raise exception 'TASK_NOT_FOUND' using errcode = 'P0001';
  end if;

  -- Bloque 12: writing needs the household's licence (always true while billing is off).
  perform private.assert_household_licensed(v_hid);

  select o.series_id into v_series
  from public.task_occurrences o
  where o.id = p_id
  for update;

  if not found then
    raise exception 'TASK_NOT_FOUND' using errcode = 'P0001';
  end if;

  select s.created_by into v_creator
  from public.task_series s
  where s.id = v_series and s.household_id = v_hid;

  if v_creator is distinct from v_user and not private.is_owner(v_hid) then
    raise exception 'CANNOT_DELETE_TASK' using errcode = 'P0001';
  end if;

  -- The occurrence goes with it (on delete cascade).
  delete from public.task_series where id = v_series and household_id = v_hid;
end;
$function$;

create or replace function public.reopen_task(p_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_user uuid := (select auth.uid());
  v_hid uuid;
  v_next public.task_occurrences%rowtype;
begin
  if v_user is null then
    raise exception 'NOT_AUTHENTICATED' using errcode = 'P0001';
  end if;

  select o.household_id into v_hid
  from public.task_occurrences o
  where o.id = p_id;

  if not found then
    raise exception 'TASK_NOT_FOUND' using errcode = 'P0001';
  end if;

  perform 1 from public.households
  where id = v_hid and deleted_at is null
  for share;

  if not found or not private.is_member(v_hid) then
    raise exception 'TASK_NOT_FOUND' using errcode = 'P0001';
  end if;

  -- Bloque 12: writing needs the household's licence (always true while billing is off).
  perform private.assert_household_licensed(v_hid);

  perform 1 from public.task_occurrences o
  where o.id = p_id
  for update;

  if not found then
    raise exception 'TASK_NOT_FOUND' using errcode = 'P0001';
  end if;

  select * into v_next
  from public.task_occurrences o
  where o.generated_from = p_id
  for update;

  if found then
    if v_next.completed_at is not null or v_next.skipped_at is not null then
      raise exception 'ALREADY_ADVANCED' using errcode = 'P0001';
    end if;
    delete from public.task_occurrences where id = v_next.id;
  end if;

  update public.task_occurrences o
  set completed_at = null,
      completed_by = null,
      skipped_at = null,
      skipped_by = null,
      assignee_id = case
        when o.assignee_id is not null and not exists (
          select 1
          from public.household_members m
          where m.household_id = v_hid
            and m.user_id = o.assignee_id
            and m.left_at is null
        ) then null
        else o.assignee_id
      end
  where o.id = p_id and (o.completed_at is not null or o.skipped_at is not null);
end;
$function$;

create or replace function public.create_task(p_id uuid, p_household_id uuid, p_title text, p_room text, p_assignee_id uuid, p_due_on date, p_recurrence jsonb)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_user uuid := (select auth.uid());
  v_title text := btrim(coalesce(p_title, ''));
  v_series uuid;
begin
  if v_user is null then
    raise exception 'NOT_AUTHENTICATED' using errcode = 'P0001';
  end if;

  perform 1 from public.households
  where id = p_household_id and deleted_at is null
  for share;

  if not found or not private.is_member(p_household_id) then
    raise exception 'NOT_A_MEMBER' using errcode = 'P0001';
  end if;

  -- Bloque 12: writing needs the household's licence (always true while billing is off).
  perform private.assert_household_licensed(p_household_id);

  -- Idempotent retry: same household and same author returns the task untouched.
  -- Any other existing id looks like a missing task.
  if exists (select 1 from public.task_occurrences where id = p_id) then
    if exists (
      select 1
      from public.task_occurrences o
      join public.task_series s on s.id = o.series_id and s.household_id = o.household_id
      where o.id = p_id
        and o.household_id = p_household_id
        and s.created_by = v_user
    ) then
      return p_id;
    end if;
    raise exception 'TASK_NOT_FOUND' using errcode = 'P0001';
  end if;

  if char_length(v_title) not between 1 and 100 then
    raise exception 'INVALID_TITLE' using errcode = 'P0001';
  end if;

  if p_room is not null
     and p_room not in ('kitchen', 'bathroom', 'living_room', 'bedroom', 'laundry', 'outdoor', 'other') then
    raise exception 'INVALID_ROOM' using errcode = 'P0001';
  end if;

  if p_assignee_id is not null and not exists (
    select 1
    from public.household_members m
    where m.household_id = p_household_id
      and m.user_id = p_assignee_id
      and m.left_at is null
  ) then
    raise exception 'INVALID_ASSIGNEE' using errcode = 'P0001';
  end if;

  if p_recurrence is not null and not private.valid_recurrence(p_recurrence) then
    raise exception 'INVALID_RECURRENCE' using errcode = 'P0001';
  end if;

  if p_recurrence is not null and p_due_on is null then
    raise exception 'RECURRENCE_NEEDS_DATE' using errcode = 'P0001';
  end if;

  -- Two concurrent calls with the same p_id both pass the exists check above (the
  -- household lock is shared), so the loser hits the primary key of task_occurrences.
  -- Its sub-transaction rolls back the series insert too (no orphan series); the handler
  -- repeats the idempotency check instead of leaking a raw 23505. pgTAP cannot stage
  -- this race.
  begin
    insert into public.task_series (household_id, title, room, recurrence_rule, created_by)
    values (p_household_id, v_title, p_room, p_recurrence, v_user)
    returning id into v_series;

    insert into public.task_occurrences (id, series_id, household_id, due_on, assignee_id)
    values (p_id, v_series, p_household_id, p_due_on, p_assignee_id);
  exception when unique_violation then
    if exists (
      select 1
      from public.task_occurrences o
      join public.task_series s on s.id = o.series_id and s.household_id = o.household_id
      where o.id = p_id
        and o.household_id = p_household_id
        and s.created_by = v_user
    ) then
      return p_id;
    end if;
    raise exception 'TASK_NOT_FOUND' using errcode = 'P0001';
  end;

  return p_id;
end;
$function$;

create or replace function public.update_task(p_id uuid, p_title text, p_room text, p_assignee_id uuid, p_due_on date, p_recurrence jsonb)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_user uuid := (select auth.uid());
  v_title text := btrim(coalesce(p_title, ''));
  v_hid uuid;
  v_series uuid;
  v_current uuid;
begin
  if v_user is null then
    raise exception 'NOT_AUTHENTICATED' using errcode = 'P0001';
  end if;

  select o.household_id into v_hid
  from public.task_occurrences o
  where o.id = p_id;

  if not found then
    raise exception 'TASK_NOT_FOUND' using errcode = 'P0001';
  end if;

  perform 1 from public.households
  where id = v_hid and deleted_at is null
  for share;

  if not found or not private.is_member(v_hid) then
    raise exception 'TASK_NOT_FOUND' using errcode = 'P0001';
  end if;

  -- Bloque 12: writing needs the household's licence (always true while billing is off).
  perform private.assert_household_licensed(v_hid);

  select o.series_id, o.assignee_id into v_series, v_current
  from public.task_occurrences o
  where o.id = p_id
  for update;

  if not found then
    raise exception 'TASK_NOT_FOUND' using errcode = 'P0001';
  end if;

  if char_length(v_title) not between 1 and 100 then
    raise exception 'INVALID_TITLE' using errcode = 'P0001';
  end if;

  if p_room is not null
     and p_room not in ('kitchen', 'bathroom', 'living_room', 'bedroom', 'laundry', 'outdoor', 'other') then
    raise exception 'INVALID_ROOM' using errcode = 'P0001';
  end if;

  -- Re-sending the current assignee is always fine, even if they have left since:
  -- a completed task keeps its assignee for history. Anyone else must be active.
  if p_assignee_id is not null
     and p_assignee_id is distinct from v_current
     and not exists (
    select 1
    from public.household_members m
    where m.household_id = v_hid
      and m.user_id = p_assignee_id
      and m.left_at is null
  ) then
    raise exception 'INVALID_ASSIGNEE' using errcode = 'P0001';
  end if;

  if p_recurrence is not null and not private.valid_recurrence(p_recurrence) then
    raise exception 'INVALID_RECURRENCE' using errcode = 'P0001';
  end if;

  if p_recurrence is not null and p_due_on is null then
    raise exception 'RECURRENCE_NEEDS_DATE' using errcode = 'P0001';
  end if;

  update public.task_series
  set title = v_title, room = p_room, recurrence_rule = p_recurrence
  where id = v_series and household_id = v_hid;

  update public.task_occurrences
  set assignee_id = p_assignee_id, due_on = p_due_on
  where id = p_id;
end;
$function$;

create or replace function public.add_shopping_item(p_id uuid, p_household_id uuid, p_name text, p_quantity text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_user uuid := (select auth.uid());
  v_name text := private.trim_item_text(coalesce(p_name, ''));
  v_quantity text := nullif(private.trim_item_text(p_quantity), '');
  v_pending uuid;
begin
  if v_user is null then
    raise exception 'NOT_AUTHENTICATED' using errcode = 'P0001';
  end if;

  perform 1 from public.households
  where id = p_household_id and deleted_at is null
  for share;

  if not found or not private.is_member(p_household_id) then
    raise exception 'NOT_A_MEMBER' using errcode = 'P0001';
  end if;

  -- Bloque 12: writing needs the household's licence (always true while billing is off).
  perform private.assert_household_licensed(p_household_id);

  -- Retry of a call whose response was lost; an id from another household looks missing.
  if exists (select 1 from public.shopping_items where id = p_id) then
    if exists (
      select 1 from public.shopping_items
      where id = p_id and household_id = p_household_id
    ) then
      return p_id;
    end if;
    raise exception 'ITEM_NOT_FOUND' using errcode = 'P0001';
  end if;

  if char_length(v_name) not between 1 and 60 then
    raise exception 'INVALID_ITEM_NAME' using errcode = 'P0001';
  end if;

  if char_length(v_quantity) > 20 then
    raise exception 'INVALID_QUANTITY' using errcode = 'P0001';
  end if;

  for v_attempt in 1..3 loop
    select s.id into v_pending
    from public.shopping_items s
    where s.household_id = p_household_id
      and s.normalized_name = private.normalize_item_name(v_name)
      and s.bought_at is null;

    if found then
      return v_pending;
    end if;

    -- Concurrent calls (same p_id, or same name) both get here because the household
    -- lock is shared; the loser hits the primary key or shopping_items_one_pending.
    begin
      insert into public.shopping_items (id, household_id, name, quantity, created_by)
      values (p_id, p_household_id, v_name, v_quantity, v_user);
      return p_id;
    exception when unique_violation then
      if exists (
        select 1 from public.shopping_items
        where id = p_id and household_id = p_household_id
      ) then
        return p_id;
      end if;
      if exists (select 1 from public.shopping_items where id = p_id) then
        raise exception 'ITEM_NOT_FOUND' using errcode = 'P0001';
      end if;
      -- Lost on the pending name: loop back and look for the winner again (it may
      -- have been bought or deleted meanwhile, then the insert is retried).
    end;
  end loop;

  raise exception 'could not add the item after concurrent changes'
    using errcode = '40001';
end;
$function$;

create or replace function public.set_item_bought(p_id uuid, p_bought boolean)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_user uuid := (select auth.uid());
  v_hid uuid;
begin
  if v_user is null then
    raise exception 'NOT_AUTHENTICATED' using errcode = 'P0001';
  end if;

  select s.household_id into v_hid
  from public.shopping_items s
  where s.id = p_id;

  if not found then
    raise exception 'ITEM_NOT_FOUND' using errcode = 'P0001';
  end if;

  perform 1 from public.households
  where id = v_hid and deleted_at is null
  for share;

  if not found or not private.is_member(v_hid) then
    raise exception 'ITEM_NOT_FOUND' using errcode = 'P0001';
  end if;

  -- Bloque 12: writing needs the household's licence (always true while billing is off).
  perform private.assert_household_licensed(v_hid);

  perform 1 from public.shopping_items s
  where s.id = p_id
  for update;

  if not found then
    raise exception 'ITEM_NOT_FOUND' using errcode = 'P0001';
  end if;

  if p_bought then
    update public.shopping_items
    set bought_at = now(), bought_by = v_user
    where id = p_id and bought_at is null;
  elsif not p_bought then
    -- A concurrent add of the same name can still win the pending slot between the
    -- not exists and the update; the unique index then rejects it and it is a no-op.
    begin
      update public.shopping_items s
      set bought_at = null, bought_by = null
      where s.id = p_id
        and s.bought_at is not null
        and s.cleared_at is null
        and not exists (
          select 1 from public.shopping_items o
          where o.household_id = s.household_id
            and o.normalized_name = s.normalized_name
            and o.bought_at is null
        );
    exception when unique_violation then
      null;
    end;
  end if;
end;
$function$;

create or replace function public.update_shopping_item(p_id uuid, p_name text, p_quantity text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_user uuid := (select auth.uid());
  v_name text := private.trim_item_text(coalesce(p_name, ''));
  v_quantity text := nullif(private.trim_item_text(p_quantity), '');
  v_hid uuid;
  v_bought_at timestamptz;
begin
  if v_user is null then
    raise exception 'NOT_AUTHENTICATED' using errcode = 'P0001';
  end if;

  select s.household_id into v_hid
  from public.shopping_items s
  where s.id = p_id;

  if not found then
    raise exception 'ITEM_NOT_FOUND' using errcode = 'P0001';
  end if;

  perform 1 from public.households
  where id = v_hid and deleted_at is null
  for share;

  if not found or not private.is_member(v_hid) then
    raise exception 'ITEM_NOT_FOUND' using errcode = 'P0001';
  end if;

  -- Bloque 12: writing needs the household's licence (always true while billing is off).
  perform private.assert_household_licensed(v_hid);

  select s.bought_at into v_bought_at
  from public.shopping_items s
  where s.id = p_id
  for update;

  if not found or v_bought_at is not null then
    raise exception 'ITEM_NOT_FOUND' using errcode = 'P0001';
  end if;

  if char_length(v_name) not between 1 and 60 then
    raise exception 'INVALID_ITEM_NAME' using errcode = 'P0001';
  end if;

  if char_length(v_quantity) > 20 then
    raise exception 'INVALID_QUANTITY' using errcode = 'P0001';
  end if;

  if exists (
    select 1 from public.shopping_items o
    where o.household_id = v_hid
      and o.normalized_name = private.normalize_item_name(v_name)
      and o.bought_at is null
      and o.id <> p_id
  ) then
    raise exception 'ITEM_ALREADY_LISTED' using errcode = 'P0001';
  end if;

  begin
    update public.shopping_items
    set name = v_name, quantity = v_quantity
    where id = p_id;
  exception when unique_violation then
    raise exception 'ITEM_ALREADY_LISTED' using errcode = 'P0001';
  end;
end;
$function$;

create or replace function public.create_invite(p_household_id uuid)
 RETURNS TABLE(invite_id uuid, token text, expires_at timestamp with time zone)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
#variable_conflict use_column
declare
  v_user uuid := (select auth.uid());
  v_token text;
  v_expires timestamptz := now() + interval '7 days';
  v_id uuid;
begin
  if v_user is null then
    raise exception 'NOT_AUTHENTICATED' using errcode = 'P0001';
  end if;

  if not private.is_member(p_household_id) then
    raise exception 'NOT_A_MEMBER' using errcode = 'P0001';
  end if;

  -- Bloque 12: writing needs the household's licence (always true while billing is off).
  perform private.assert_household_licensed(p_household_id);

  -- 1) household row (exclusive), 2) invite rows.
  perform 1
  from public.households h
  where h.id = p_household_id and h.deleted_at is null
  for update;

  if not found then
    raise exception 'NOT_A_MEMBER' using errcode = 'P0001';
  end if;

  update public.household_invites i
  set revoked_at = now()
  where i.household_id = p_household_id
    and i.accepted_at is null
    and i.revoked_at is null;

  v_token := encode(extensions.gen_random_bytes(24), 'hex');

  insert into public.household_invites (household_id, token_hash, created_by, expires_at)
  values (
    p_household_id,
    encode(extensions.digest(v_token, 'sha256'), 'hex'),
    v_user,
    v_expires
  )
  returning id into v_id;

  -- The plain token only ever exists in this response.
  return query select v_id, v_token, v_expires;
end;
$function$;

create or replace function private.close_occurrence(p_id uuid, p_today date, p_skip boolean, p_at timestamp with time zone DEFAULT NULL::timestamp with time zone)
 RETURNS void
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
declare
  v_user uuid := (select auth.uid());
  v_hid uuid;
  v_occurrence public.task_occurrences%rowtype;
  v_rule jsonb;
  v_tz text;
  v_today date;
  v_at timestamptz := now();
  v_trusted boolean := p_at is not null
    and p_at >= now() - interval '7 days'
    and p_at <= now() + interval '5 minutes';
begin
  if v_user is null then
    raise exception 'NOT_AUTHENTICATED' using errcode = 'P0001';
  end if;

  if v_trusted then
    v_at := least(p_at, now());
  end if;

  select p.time_zone into v_tz from public.profiles p where p.user_id = v_user;

  if v_tz is not null then
    v_today := private.today_for(v_user, v_at);
  elsif p_at is not null and not v_trusted then
    v_today := (now() at time zone 'utc')::date;
  else
    if p_today is null or abs(p_today - (v_at at time zone 'utc')::date) > 1 then
      raise exception 'INVALID_TODAY' using errcode = 'P0001';
    end if;
    v_today := p_today;
  end if;

  select o.household_id into v_hid
  from public.task_occurrences o
  where o.id = p_id;

  if not found then
    raise exception 'TASK_NOT_FOUND' using errcode = 'P0001';
  end if;

  perform 1 from public.households
  where id = v_hid and deleted_at is null
  for share;

  if not found or not private.is_member(v_hid) then
    raise exception 'TASK_NOT_FOUND' using errcode = 'P0001';
  end if;

  -- Bloque 12: writing needs the household's licence (always true while billing is off).
  perform private.assert_household_licensed(v_hid);

  select * into v_occurrence
  from public.task_occurrences o
  where o.id = p_id
  for update;

  if not found then
    raise exception 'TASK_NOT_FOUND' using errcode = 'P0001';
  end if;

  select s.recurrence_rule into v_rule
  from public.task_series s
  where s.id = v_occurrence.series_id and s.household_id = v_hid;

  if v_occurrence.completed_at is not null or v_occurrence.skipped_at is not null then
    return;
  end if;

  if p_skip and v_rule is null then
    raise exception 'NOT_RECURRING' using errcode = 'P0001';
  end if;

  if p_skip then
    update public.task_occurrences
    set skipped_at = v_at, skipped_by = v_user
    where id = p_id;
  else
    update public.task_occurrences
    set completed_at = v_at, completed_by = v_user
    where id = p_id;
  end if;

  if v_rule is not null then
    insert into public.task_occurrences (id, series_id, household_id, due_on, assignee_id, generated_from)
    values (
      gen_random_uuid(),
      v_occurrence.series_id,
      v_hid,
      private.next_due_on(v_rule, coalesce(v_occurrence.due_on, v_today), v_today),
      case
        when v_occurrence.assignee_id is not null and exists (
          select 1
          from public.household_members m
          where m.household_id = v_hid
            and m.user_id = v_occurrence.assignee_id
            and m.left_at is null
        ) then v_occurrence.assignee_id
      end,
      p_id
    );
  end if;
end;
$function$;

-- my_households: what the app lists. One row per household the caller is in, the oldest
-- membership first, with the licence's state; `licensed` is what the write guard would say.
create function public.my_households()
returns table (
  household_id uuid,
  name text,
  role text,
  rooms text[],
  member_count int,
  joined_at timestamptz,
  license_status text,
  license_ends_at timestamptz,
  licensed boolean
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    h.id,
    h.name,
    m.role,
    h.rooms,
    (select count(*)::int from public.household_members o
      where o.household_id = h.id and o.left_at is null),
    m.joined_at,
    l.status,
    case when l.status = 'trial' then l.trial_ends_at else l.current_period_end end,
    private.household_is_licensed(h.id)
  from public.household_members m
  join public.households h on h.id = m.household_id and h.deleted_at is null
  left join public.household_licenses l on l.household_id = h.id
  where m.user_id = (select auth.uid()) and m.left_at is null
  order by m.joined_at, h.id;
$$;

revoke execute on function public.my_households() from public, anon;
grant execute on function public.my_households() to authenticated;

-- start_household_checkout: what the app needs to start paying for a household's licence.
-- Only whoever leads it. With billing off: BILLING_DISABLED. With billing on: the provider and
-- its offering; the purchase itself happens in the provider's SDK, and its webhook updates
-- the licence (billing-webhook).
create function public.start_household_checkout(p_household_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_settings private.app_settings;
begin
  if (select auth.uid()) is null then
    raise exception 'NOT_AUTHENTICATED' using errcode = 'P0001';
  end if;

  if not private.is_owner(p_household_id) then
    raise exception 'NOT_OWNER' using errcode = 'P0001';
  end if;

  select * into v_settings from private.app_settings;
  if not coalesce(v_settings.billing_enabled, false) then
    raise exception 'BILLING_DISABLED' using errcode = 'P0001';
  end if;

  return jsonb_build_object(
    'provider', v_settings.billing_provider,
    'offering', v_settings.checkout_offering,
    'household_id', p_household_id
  );
end;
$$;

revoke execute on function public.start_household_checkout(uuid) from public, anon;
grant execute on function public.start_household_checkout(uuid) to authenticated;

-- apply_billing_event: the billing webhook's only door into the licences (service role only).
-- With billing off it changes nothing and says so (false). Paying takes the licence over: the
-- payer becomes paid_by.
create function public.apply_billing_event(
  p_household_id uuid,
  p_status text,
  p_period_end timestamptz,
  p_provider text,
  p_subscription_id text,
  p_paid_by uuid
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not private.billing_enabled() then
    return false;
  end if;

  if p_status not in ('active', 'past_due', 'canceled') then
    raise exception 'INVALID_LICENSE_STATUS' using errcode = 'P0001';
  end if;

  update public.household_licenses
  set status = p_status,
      current_period_end = coalesce(p_period_end, current_period_end),
      provider = coalesce(p_provider, provider),
      provider_subscription_id = coalesce(p_subscription_id, provider_subscription_id),
      paid_by = coalesce(p_paid_by, paid_by),
      updated_at = now()
  where household_id = p_household_id;

  return found;
end;
$$;

revoke execute on function public.apply_billing_event(uuid, text, timestamptz, text, text, uuid)
  from public, anon, authenticated;
grant execute on function public.apply_billing_event(uuid, text, timestamptz, text, text, uuid)
  to service_role;
