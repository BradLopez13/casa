-- Copy change: the household is called "hogar", not "casa". Redefines only the
-- member_joined trigger function (same body as 20261011201000_push_enqueue.sql)
-- with the new push title.

create or replace function private.enqueue_member_joined()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_name text;
  v_household text;
begin
  if new.role <> 'member' or new.left_at is not null then
    return new;
  end if;

  select p.display_name into v_name from public.profiles p where p.user_id = new.user_id;
  select h.name into v_household from public.households h where h.id = new.household_id;

  insert into private.push_outbox (recipient_id, kind, title, body, data)
  select m.user_id, 'member_joined', 'Alguien nuevo en el hogar',
         v_name || ' se ha unido a ' || v_household,
         jsonb_build_object('route', '/household/members')
  from public.household_members m
  where m.household_id = new.household_id
    and m.left_at is null
    and m.user_id <> new.user_id
    and private.push_enabled(m.user_id, 'member_joined');

  return new;
end;
$$;
