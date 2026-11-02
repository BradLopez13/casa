-- Bloque 14.4: the offline queue, hardened (auditoría técnica del 1 de noviembre).

-- T2: a quantity changed offline sent the name as it was when tapped, and put it back over a name
-- another member changed meanwhile. A null name now means «leave the name as it is».
create or replace function public.update_shopping_item(p_id uuid, p_name text, p_quantity text)
 returns void
 language plpgsql
 security definer
 set search_path to ''
as $function$
declare
  v_user uuid := (select auth.uid());
  v_name text;
  v_quantity text := nullif(private.trim_item_text(p_quantity), '');
  v_hid uuid;
  v_bought_at timestamptz;
  v_current text;
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

  select s.bought_at, s.name into v_bought_at, v_current
  from public.shopping_items s
  where s.id = p_id
  for update;

  if not found or v_bought_at is not null then
    raise exception 'ITEM_NOT_FOUND' using errcode = 'P0001';
  end if;

  v_name := case
    when p_name is null then v_current
    else private.trim_item_text(p_name)
  end;

  if char_length(v_name) not between 1 and 60 then
    raise exception 'INVALID_ITEM_NAME' using errcode = 'P0001';
  end if;

  if char_length(v_quantity) > 20 then
    raise exception 'INVALID_QUANTITY' using errcode = 'P0001';
  end if;

  if p_name is not null and exists (
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

-- T8: creating a household with a weak signal could arrive without its answer coming back; the
-- person tapped again and got a second household (up to the cap). The app now sends the id it
-- gave the household: the same id twice is the same household. T9, on the way: two creates at
-- once could both pass the cap of 10; the count now runs under a lock per person.
drop function public.create_household(text);

create function public.create_household(p_name text, p_id uuid default null)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := (select auth.uid());
  v_name text := btrim(p_name);
  v_id uuid := coalesce(p_id, gen_random_uuid());
begin
  if v_user is null then
    raise exception 'NOT_AUTHENTICATED' using errcode = 'P0001';
  end if;

  if v_name is null or char_length(v_name) not between 1 and 60 then
    raise exception 'INVALID_NAME' using errcode = 'P0001';
  end if;

  perform pg_advisory_xact_lock(hashtext('create_household:' || v_user::text));

  -- Already created by this same request: the same household, not a second one.
  if p_id is not null and exists (
    select 1 from public.households h
    where h.id = p_id
  ) then
    if exists (
      select 1
      from public.households h
      join public.household_members m on m.household_id = h.id
      where h.id = p_id
        and h.created_by = v_user
        and h.deleted_at is null
        and m.user_id = v_user
        and m.left_at is null
    ) then
      return p_id;
    end if;
    raise exception 'NOT_A_MEMBER' using errcode = 'P0001';
  end if;

  if (
    select count(*)
    from public.household_members m
    where m.user_id = v_user and m.left_at is null
  ) >= 10 then
    raise exception 'TOO_MANY_HOUSEHOLDS' using errcode = 'P0001';
  end if;

  begin
    insert into public.households (id, name, created_by)
    values (v_id, v_name, v_user);
  exception when unique_violation then
    -- Someone else's request took the same id at the same moment: not this person's household.
    raise exception 'NOT_A_MEMBER' using errcode = 'P0001';
  end;

  insert into public.household_members (household_id, user_id, role)
  values (v_id, v_user, 'owner');

  return v_id;
end;
$$;

revoke execute on function public.create_household(text, uuid) from public, anon;
grant execute on function public.create_household(text, uuid) to authenticated;
