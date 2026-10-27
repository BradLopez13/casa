-- Push notices say which household they come from (bloque 12): with several households, tapping
-- one switches the app to that household before opening its screen. Same bodies as
-- 20261018120000_locale.sql (taken from pg_get_functiondef), with household_id in the data.

create or replace function private.enqueue_task_assigned()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_actor uuid := (select auth.uid());
  v_title text;
  v_body text;
  v_locale text;
begin
  if new.assignee_id is null
     or (tg_op = 'UPDATE' and new.assignee_id is not distinct from old.assignee_id)
     or (tg_op = 'INSERT' and new.generated_from is not null)
     or v_actor is null
     or new.assignee_id = v_actor
     or new.completed_at is not null
     or new.skipped_at is not null
     or not private.push_enabled(new.assignee_id, 'task_assigned') then
    return new;
  end if;

  v_locale := private.locale_for(new.assignee_id);

  select s.title into v_title from public.task_series s where s.id = new.series_id;

  v_body := case
    when new.due_on is null then v_title
    else v_title || ' · '
         || private.format_due_label(new.due_on, private.today_for(new.assignee_id), v_locale)
  end;

  insert into private.push_outbox (recipient_id, kind, title, body, data)
  values (new.assignee_id, 'task_assigned',
          case when v_locale = 'en' then 'You have a new task' else 'Tienes una tarea nueva' end,
          v_body, jsonb_build_object('route', '/tasks', 'household_id', new.household_id));

  return new;
end;
$function$;

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
         case when l.locale = 'en' then 'Someone new in the household' else 'Alguien nuevo en el hogar' end,
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
