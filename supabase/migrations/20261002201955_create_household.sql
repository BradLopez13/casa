create function public.create_household(p_name text)
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

  if exists (
    select 1
    from public.household_members
    where user_id = v_user and left_at is null
  ) then
    raise exception 'ALREADY_IN_HOUSEHOLD' using errcode = 'P0001';
  end if;

  insert into public.households (name, created_by)
  values (v_name, v_user)
  returning id into v_id;

  -- Two concurrent calls by the same user can both pass the exists check above;
  -- the loser then hits household_members_one_active. Map it to the contract
  -- error instead of leaking a raw 23505. The subtransaction rolls back the
  -- household insert too.
  begin
    insert into public.household_members (household_id, user_id, role)
    values (v_id, v_user, 'owner');
  exception when unique_violation then
    raise exception 'ALREADY_IN_HOUSEHOLD' using errcode = 'P0001';
  end;

  return v_id;
end;
$$;

revoke execute on function public.create_household(text) from public, anon;
grant execute on function public.create_household(text) to authenticated;
