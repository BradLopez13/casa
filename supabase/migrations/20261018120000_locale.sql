-- Each person's language (spec §10). The app reads it from the phone and stores it through
-- set_locale; the push triggers pick their text by the recipient's profiles.locale. The
-- column-level update grant from the profiles migration stays; set_locale is the one
-- validated path with a named error, like set_time_zone.

create function public.set_locale(p_locale text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := (select auth.uid());
begin
  if v_user is null then
    raise exception 'NOT_AUTHENTICATED' using errcode = 'P0001';
  end if;

  if p_locale is null or p_locale not in ('es', 'en') then
    raise exception 'INVALID_LOCALE' using errcode = 'P0001';
  end if;

  update public.profiles set locale = p_locale where user_id = v_user;
end;
$$;

revoke all on function public.set_locale(text) from public, anon;
grant execute on function public.set_locale(text) to authenticated;

-- The recipient's language, 'es' for anything other than 'en'.
create function private.locale_for(p_user uuid)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select case
    when (select p.locale from public.profiles p where p.user_id = p_user) = 'en' then 'en'
    else 'es'
  end;
$$;

revoke execute on function private.locale_for(uuid) from public, anon, authenticated;

-- Due-date label in either language, independent of the database lc_time.
create function private.format_due_label(p_due date, p_today date, p_locale text)
returns text
language sql
immutable
set search_path = ''
as $$
  select case
    when p_locale = 'en' then
      case
        when p_due = p_today then 'today'
        when p_due = p_today + 1 then 'tomorrow'
        else (array['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'])
               [extract(dow from p_due)::int + 1]
             || ' ' || extract(day from p_due)::int::text
      end
    else
      case
        when p_due = p_today then 'hoy'
        when p_due = p_today + 1 then 'mañana'
        else (array['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'])
               [extract(dow from p_due)::int + 1]
             || ' ' || extract(day from p_due)::int::text
      end
  end;
$$;

revoke execute on function private.format_due_label(date, date, text) from public, anon, authenticated;

-- The two-argument form stays as the Spanish label.
create or replace function private.format_due_label(p_due date, p_today date)
returns text
language sql
immutable
set search_path = ''
as $$
  select private.format_due_label(p_due, p_today, 'es');
$$;

-- Same body as 20261011201000_push_enqueue.sql, with the text in the assignee's language.
create or replace function private.enqueue_task_assigned()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
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
          v_body, jsonb_build_object('route', '/tasks'));

  return new;
end;
$$;

-- Same body as 20261012150000_member_joined_title_hogar.sql, with the text in each
-- housemate's language.
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
  select m.user_id, 'member_joined',
         case when l.locale = 'en' then 'Someone new in the household' else 'Alguien nuevo en el hogar' end,
         case when l.locale = 'en' then v_name || ' joined ' || v_household
              else v_name || ' se ha unido a ' || v_household end,
         jsonb_build_object('route', '/household/members')
  from public.household_members m
  cross join lateral (select private.locale_for(m.user_id) as locale) l
  where m.household_id = new.household_id
    and m.left_at is null
    and m.user_id <> new.user_id
    and private.push_enabled(m.user_id, 'member_joined');

  return new;
end;
$$;
