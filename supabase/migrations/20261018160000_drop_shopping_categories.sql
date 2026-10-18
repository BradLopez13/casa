-- Drop shopping categories: the list is flat again. Reverses 20261018090000_shopping_categories.sql
-- in dependency order, and puts back the functions that migration rewrote.

drop function public.set_item_category(uuid, text);
drop function public.set_category_order(text[]);

drop trigger household_item_categories_broadcast on public.household_item_categories;
drop table public.household_item_categories;

alter table public.shopping_items drop column category;
alter table public.households drop column category_order;

drop function private.is_category_order(text[]);
drop function private.is_shopping_category(text);

-- add_shopping_item: back to the version in 20261009202903_shopping_add_retry.
create or replace function public.add_shopping_item(
  p_id uuid,
  p_household_id uuid,
  p_name text,
  p_quantity text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
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
$$;

-- update_shopping_item: back to the version in 20261009202425_shopping.
create or replace function public.update_shopping_item(p_id uuid, p_name text, p_quantity text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
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
$$;

-- shopping_history: four columns again.
drop function public.shopping_history(uuid);

create function public.shopping_history(p_household_id uuid)
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
  group by s.normalized_name
  order by 3 desc, 4 desc, 2
  limit 300;
end;
$$;

revoke execute on function public.shopping_history(uuid) from public, anon;
grant execute on function public.shopping_history(uuid) to authenticated;
