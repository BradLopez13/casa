-- Shopping categories: every item can carry a category, and a member's correction is
-- remembered for the whole household by normalized name. The household also keeps its own
-- aisle order. The category ids are the ones in domain/shopping/categories.ts; the client
-- still categorises an item without one through its local dictionary.
--
-- Everything is written through the RPCs below; members read the corrections directly.

-- The ten category ids, in the default aisle order.
create function private.is_shopping_category(p_category text)
returns boolean
language sql
immutable
parallel safe
set search_path = ''
as $$
  select p_category in (
    'produce', 'meat_fish', 'dairy_eggs', 'bakery', 'pantry',
    'frozen', 'drinks', 'cleaning', 'hygiene', 'other'
  );
$$;

-- A valid aisle order: categories only, none twice, no nulls. A subset is fine: the
-- client appends the missing ones in their default order.
create function private.is_category_order(p_order text[])
returns boolean
language sql
immutable
parallel safe
set search_path = ''
as $$
  select p_order is null or (
    array_position(p_order, null) is null
    and cardinality(p_order) = (select count(distinct e) from unnest(p_order) as e)
    and not exists (
      select 1 from unnest(p_order) as e where not private.is_shopping_category(e)
    )
  );
$$;

revoke execute on function private.is_shopping_category(text) from public, anon, authenticated;
revoke execute on function private.is_category_order(text[]) from public, anon, authenticated;

alter table public.shopping_items
  add column category text check (category is null or private.is_shopping_category(category));

alter table public.households
  add column category_order text[] check (private.is_category_order(category_order));

create table public.household_item_categories (
  household_id uuid not null references public.households on delete cascade,
  normalized_name text not null,
  category text not null check (private.is_shopping_category(category)),
  primary key (household_id, normalized_name)
);

alter table public.household_item_categories enable row level security;

revoke all on public.household_item_categories from anon, authenticated;
grant select on public.household_item_categories to authenticated;

create policy household_item_categories_select_member on public.household_item_categories
  for select to authenticated
  using (private.is_member(household_id));

create trigger household_item_categories_broadcast
  after insert or update or delete on public.household_item_categories
  for each row execute function private.broadcast_household_change();

-- set_item_category: sets the item's category and remembers it for the household under the
-- item's normalized name. Idempotent (an absolute value). Same lookup and lock order as the
-- other item RPCs: a missing item, a deleted household or a caller who is not an active
-- member are all ITEM_NOT_FOUND.
create function public.set_item_category(p_id uuid, p_category text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := (select auth.uid());
  v_hid uuid;
  v_normalized text;
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

  select s.normalized_name into v_normalized
  from public.shopping_items s
  where s.id = p_id
  for update;

  if not found then
    raise exception 'ITEM_NOT_FOUND' using errcode = 'P0001';
  end if;

  if not coalesce(private.is_shopping_category(p_category), false) then
    raise exception 'INVALID_CATEGORY' using errcode = 'P0001';
  end if;

  update public.shopping_items
  set category = p_category
  where id = p_id and category is distinct from p_category;

  insert into public.household_item_categories (household_id, normalized_name, category)
  values (v_hid, v_normalized, p_category)
  on conflict (household_id, normalized_name)
  do update set category = excluded.category
  where public.household_item_categories.category is distinct from excluded.category;
end;
$$;

revoke execute on function public.set_item_category(uuid, text) from public, anon;
grant execute on function public.set_item_category(uuid, text) to authenticated;

-- set_category_order: the caller's household aisle order. An empty or null order goes back
-- to the default one.
create function public.set_category_order(p_order text[])
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := (select auth.uid());
  v_hid uuid;
  v_order text[] := case when cardinality(p_order) > 0 then p_order end;
begin
  if v_user is null then
    raise exception 'NOT_AUTHENTICATED' using errcode = 'P0001';
  end if;

  select m.household_id into v_hid
  from public.household_members m
  join public.households h on h.id = m.household_id
  where m.user_id = v_user and m.left_at is null and h.deleted_at is null;

  if not found then
    raise exception 'NOT_A_MEMBER' using errcode = 'P0001';
  end if;

  if not private.is_category_order(v_order) then
    raise exception 'INVALID_CATEGORY' using errcode = 'P0001';
  end if;

  update public.households
  set category_order = v_order
  where id = v_hid and deleted_at is null
    and category_order is distinct from v_order;

  -- households has no broadcast trigger (its key is id, not household_id): tell the
  -- members here. realtime.send turns its own failures into a WARNING.
  if found then
    perform realtime.send(
      jsonb_build_object('table', 'households'),
      'changed',
      'household:' || v_hid,
      true
    );
  end if;
end;
$$;

revoke execute on function public.set_category_order(text[]) from public, anon;
grant execute on function public.set_category_order(text[]) to authenticated;

-- add_shopping_item: as in 20261009202903_shopping_add_retry, and a new item takes the
-- household's correction for its name, if there is one.
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
  v_category text;
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

  select c.category into v_category
  from public.household_item_categories c
  where c.household_id = p_household_id
    and c.normalized_name = private.normalize_item_name(v_name);

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
      insert into public.shopping_items (id, household_id, name, quantity, created_by, category)
      values (p_id, p_household_id, v_name, v_quantity, v_user, v_category);
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

-- update_shopping_item: as before; a rename to another name takes that name's correction
-- (or none), so a renamed item is not left in the old name's category.
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
    update public.shopping_items s
    set name = v_name,
        quantity = v_quantity,
        category = case
          when s.normalized_name = private.normalize_item_name(v_name) then s.category
          else (
            select c.category from public.household_item_categories c
            where c.household_id = v_hid
              and c.normalized_name = private.normalize_item_name(v_name)
          )
        end
    where s.id = p_id;
  exception when unique_violation then
    raise exception 'ITEM_ALREADY_LISTED' using errcode = 'P0001';
  end;
end;
$$;

-- shopping_history: as before, plus the name's category: the household's correction, or else
-- the one its latest item carried (null when it never had one).
drop function public.shopping_history(uuid);

create function public.shopping_history(p_household_id uuid)
returns table (
  name text,
  normalized_name text,
  uses bigint,
  last_used_at timestamptz,
  category text
)
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
    max(s.created_at),
    coalesce(
      (
        select c.category from public.household_item_categories c
        where c.household_id = p_household_id and c.normalized_name = s.normalized_name
      ),
      (array_agg(s.category order by s.created_at desc, s.id desc))[1]
    )
  from public.shopping_items s
  where s.household_id = p_household_id
  group by s.normalized_name
  order by 3 desc, 4 desc, 2
  limit 300;
end;
$$;

revoke execute on function public.shopping_history(uuid) from public, anon;
grant execute on function public.shopping_history(uuid) to authenticated;
