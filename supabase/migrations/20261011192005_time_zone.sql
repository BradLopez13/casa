-- Each person's time zone lives in their profile, and "today" for closing a task is
-- computed on the server from it. Without a zone the client's p_today is still used,
-- checked within one day of UTC. The column is covered by the table-level select grant;
-- it is only written through set_time_zone (no column-level update grant).
alter table public.profiles add column time_zone text;

create function public.set_time_zone(p_tz text)
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

  if p_tz is null or not exists (select 1 from pg_catalog.pg_timezone_names n where n.name = p_tz) then
    raise exception 'INVALID_TIME_ZONE' using errcode = 'P0001';
  end if;

  update public.profiles set time_zone = p_tz where user_id = v_user;
end;
$$;

revoke execute on function public.set_time_zone(text) from public, anon;
grant execute on function public.set_time_zone(text) to authenticated;

create function private.today_for(p_user uuid, p_at timestamptz default now())
returns date
language sql
stable
security definer
set search_path = ''
as $$
  select (p_at at time zone coalesce(
    (select p.time_zone from public.profiles p where p.user_id = p_user), 'UTC'))::date;
$$;

revoke execute on function private.today_for(uuid, timestamptz) from public, anon, authenticated;

create or replace function private.close_occurrence(p_id uuid, p_today date, p_skip boolean)
returns void
language plpgsql
set search_path = ''
as $$
declare
  v_user uuid := (select auth.uid());
  v_hid uuid;
  v_occurrence public.task_occurrences%rowtype;
  v_rule jsonb;
  v_tz text;
  v_today date;
begin
  if v_user is null then
    raise exception 'NOT_AUTHENTICATED' using errcode = 'P0001';
  end if;

  select p.time_zone into v_tz from public.profiles p where p.user_id = v_user;

  if v_tz is not null then
    v_today := private.today_for(v_user);
  else
    if p_today is null or abs(p_today - (now() at time zone 'utc')::date) > 1 then
      raise exception 'INVALID_TODAY' using errcode = 'P0001';
    end if;
    v_today := p_today;
  end if;

  select o.household_id into v_hid
  from public.task_occurrences o
  where o.id = p_id;

  if not found then
    raise exception 'TASK_NOT_FOUND' using errcode = 'P0001';
  end if;

  perform 1 from public.households
  where id = v_hid and deleted_at is null
  for share;

  if not found or not private.is_member(v_hid) then
    raise exception 'TASK_NOT_FOUND' using errcode = 'P0001';
  end if;

  select * into v_occurrence
  from public.task_occurrences o
  where o.id = p_id
  for update;

  if not found then
    raise exception 'TASK_NOT_FOUND' using errcode = 'P0001';
  end if;

  select s.recurrence_rule into v_rule
  from public.task_series s
  where s.id = v_occurrence.series_id and s.household_id = v_hid;

  if v_occurrence.completed_at is not null or v_occurrence.skipped_at is not null then
    return;
  end if;

  if p_skip and v_rule is null then
    raise exception 'NOT_RECURRING' using errcode = 'P0001';
  end if;

  if p_skip then
    update public.task_occurrences
    set skipped_at = now(), skipped_by = v_user
    where id = p_id;
  else
    update public.task_occurrences
    set completed_at = now(), completed_by = v_user
    where id = p_id;
  end if;

  if v_rule is not null then
    insert into public.task_occurrences (id, series_id, household_id, due_on, assignee_id, generated_from)
    values (
      gen_random_uuid(),
      v_occurrence.series_id,
      v_hid,
      private.next_due_on(v_rule, coalesce(v_occurrence.due_on, v_today), v_today),
      case
        when v_occurrence.assignee_id is not null and exists (
          select 1
          from public.household_members m
          where m.household_id = v_hid
            and m.user_id = v_occurrence.assignee_id
            and m.left_at is null
        ) then v_occurrence.assignee_id
      end,
      p_id
    );
  end if;
end;
$$;
