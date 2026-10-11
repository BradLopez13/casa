-- Push notifications, part 2: triggers that fill private.push_outbox.

-- Spanish due-date label, independent of the database locale.
create function private.format_due_label(p_due date, p_today date)
returns text
language sql
immutable
set search_path = ''
as $$
  select case
    when p_due = p_today then 'hoy'
    when p_due = p_today + 1 then 'mañana'
    else (array['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'])
           [extract(dow from p_due)::int + 1]
         || ' ' || extract(day from p_due)::int::text
  end;
$$;

revoke execute on function private.format_due_label(date, date) from public, anon, authenticated;

create function private.enqueue_task_assigned()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := (select auth.uid());
  v_title text;
  v_body text;
begin
  if new.assignee_id is null
     or (tg_op = 'UPDATE' and new.assignee_id is not distinct from old.assignee_id)
     or new.generated_from is not null
     or v_actor is null
     or new.assignee_id = v_actor
     or new.completed_at is not null
     or new.skipped_at is not null
     or not private.push_enabled(new.assignee_id, 'task_assigned') then
    return new;
  end if;

  select s.title into v_title from public.task_series s where s.id = new.series_id;

  v_body := case
    when new.due_on is null then v_title
    else v_title || ' · ' || private.format_due_label(new.due_on, private.today_for(new.assignee_id))
  end;

  insert into private.push_outbox (recipient_id, kind, title, body, data)
  values (new.assignee_id, 'task_assigned', 'Tienes una tarea nueva', v_body,
          jsonb_build_object('route', '/tasks'));

  return new;
end;
$$;

create function private.enqueue_member_joined()
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
  select m.user_id, 'member_joined', 'Alguien nuevo en casa',
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

revoke execute on function private.enqueue_task_assigned() from public, anon, authenticated;
revoke execute on function private.enqueue_member_joined() from public, anon, authenticated;

create trigger push_enqueue_task_assigned
  after insert or update of assignee_id on public.task_occurrences
  for each row execute function private.enqueue_task_assigned();

create trigger push_enqueue_member_joined
  after insert on public.household_members
  for each row execute function private.enqueue_member_joined();
