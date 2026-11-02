-- Bloque 15.3 (P3-9): «lo de siempre» had no way to drop a suggestion, so a test product or a
-- typo stayed offered for ever. A member hides a name for the household; adding it again shows
-- it again. Hidden names are kept by normalized name, as the history groups them.

create table public.shopping_hidden_suggestions (
  household_id uuid not null references public.households (id) on delete cascade,
  normalized_name text not null,
  hidden_by uuid references auth.users (id) on delete set null,
  hidden_at timestamptz not null default now(),
  primary key (household_id, normalized_name)
);

alter table public.shopping_hidden_suggestions enable row level security;
revoke all on table public.shopping_hidden_suggestions from public, anon, authenticated;

-- hide_shopping_suggestion: drop a name from the household's usual suggestions.
create function public.hide_shopping_suggestion(p_household_id uuid, p_name text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := (select auth.uid());
  v_name text := private.normalize_item_name(private.trim_item_text(coalesce(p_name, '')));
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

  if char_length(v_name) not between 1 and 60 then
    raise exception 'INVALID_ITEM_NAME' using errcode = 'P0001';
  end if;

  insert into public.shopping_hidden_suggestions (household_id, normalized_name, hidden_by)
  values (p_household_id, v_name, v_user)
  on conflict (household_id, normalized_name) do nothing;
end;
$$;

revoke execute on function public.hide_shopping_suggestion(uuid, text) from public, anon;
grant execute on function public.hide_shopping_suggestion(uuid, text) to authenticated;

-- unhide_shopping_suggestion: «Deshacer» of the above.
create function public.unhide_shopping_suggestion(p_household_id uuid, p_name text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := (select auth.uid());
  v_name text := private.normalize_item_name(private.trim_item_text(coalesce(p_name, '')));
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

  delete from public.shopping_hidden_suggestions
  where household_id = p_household_id and normalized_name = v_name;
end;
$$;

revoke execute on function public.unhide_shopping_suggestion(uuid, text) from public, anon;
grant execute on function public.unhide_shopping_suggestion(uuid, text) to authenticated;

-- shopping_history: without the hidden names.
create or replace function public.shopping_history(p_household_id uuid)
returns table (name text, normalized_name text, uses bigint, last_used_at timestamptz)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if (select auth.uid()) is null then
    raise exception 'NOT_AUTHENTICATED' using errcode = 'P0001';
  end if;

  if not private.is_member(p_household_id) then
    raise exception 'NOT_A_MEMBER' using errcode = 'P0001';
  end if;

  return query
  select
    (array_agg(s.name order by s.created_at desc, s.id desc))[1],
    s.normalized_name,
    count(*),
    max(s.created_at)
  from public.shopping_items s
  where s.household_id = p_household_id
    and not exists (
      select 1 from public.shopping_hidden_suggestions h
      where h.household_id = s.household_id and h.normalized_name = s.normalized_name
    )
  group by s.normalized_name
  order by 3 desc, 4 desc, 2
  limit 300;
end;
$$;

-- add_shopping_item: adding a hidden name shows it again in «lo de siempre».
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

  -- A name that was hidden from «lo de siempre» comes back when it is listed again.
  delete from public.shopping_hidden_suggestions
  where household_id = p_household_id and normalized_name = private.normalize_item_name(v_name);

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
