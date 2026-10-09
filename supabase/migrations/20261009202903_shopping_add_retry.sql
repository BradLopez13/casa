-- add_shopping_item: retry the pending lookup and the insert instead of giving up.
--
-- The race: the insert hits shopping_items_one_pending because another transaction
-- just listed the same name, but before the handler re-reads, a third transaction buys
-- or deletes that winning row. Both lookups then missed and the add raised
-- ITEM_NOT_FOUND, so the offline queue would drop the item. Now a unique_violation
-- that is not about p_id loops back to the pending lookup and tries the insert again,
-- at most 3 attempts. ITEM_NOT_FOUND is left for the genuine case: p_id exists in
-- another household. If every attempt loses a race (practically impossible), the call
-- fails with serialization_failure (40001), a transient error the caller can retry.
-- pgTAP cannot stage this race; shopping.test.sql covers the non-racing paths.
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
