-- One word for the home everywhere (decisión 5 de Brad, 27 de octubre): the notice of someone
-- joining says «casa» like the rest of the app. Same body as 20261026200200_push_household.sql
-- otherwise.
create or replace function private.enqueue_member_joined()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
  select m.user_id, 'member_joined',
         case when l.locale = 'en' then 'Someone new at home' else 'Alguien nuevo en la casa' end,
         case when l.locale = 'en' then v_name || ' joined ' || v_household
              else v_name || ' se ha unido a ' || v_household end,
         jsonb_build_object('route', '/household/members', 'household_id', new.household_id)
  from public.household_members m
  cross join lateral (select private.locale_for(m.user_id) as locale) l
  where m.household_id = new.household_id
    and m.left_at is null
    and m.user_id <> new.user_id
    and private.push_enabled(m.user_id, 'member_joined');

  return new;
end;
$function$;
