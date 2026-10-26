-- A task marked done without a connection keeps the time it was marked: the queue sends it
-- when the connection is back, and the note no longer jumps to the time it arrived. The day a
-- repeat starts from is that time's day too.
--
-- complete_task takes an optional p_at, the moment of the tap. It is trusted only within the
-- last seven days and never in the future (a clock a few minutes ahead is clamped to now);
-- anything else, or no p_at (an older build), is now() as before. Without a time zone in the
-- profile, p_today is checked within one day of p_at's UTC date instead of now's, so a tap
-- queued last night still passes when it arrives this morning; a tap too old to trust closes
-- on the server's day rather than being refused.

drop function public.complete_task(uuid, date);
drop function private.close_occurrence(uuid, date, boolean);

create function private.close_occurrence(
  p_id uuid,
  p_today date,
  p_skip boolean,
  p_at timestamptz default null
)
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
  v_at timestamptz := now();
  v_trusted boolean := p_at is not null
    and p_at >= now() - interval '7 days'
    and p_at <= now() + interval '5 minutes';
begin
  if v_user is null then
    raise exception 'NOT_AUTHENTICATED' using errcode = 'P0001';
  end if;

  if v_trusted then
    v_at := least(p_at, now());
  end if;

  select p.time_zone into v_tz from public.profiles p where p.user_id = v_user;

  if v_tz is not null then
    v_today := private.today_for(v_user, v_at);
  elsif p_at is not null and not v_trusted then
    v_today := (now() at time zone 'utc')::date;
  else
    if p_today is null or abs(p_today - (v_at at time zone 'utc')::date) > 1 then
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
    set skipped_at = v_at, skipped_by = v_user
    where id = p_id;
  else
    update public.task_occurrences
    set completed_at = v_at, completed_by = v_user
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

revoke execute on function private.close_occurrence(uuid, date, boolean, timestamptz) from public, anon, authenticated;

create function public.complete_task(p_id uuid, p_today date, p_at timestamptz default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.close_occurrence(p_id, p_today, false, p_at);
end;
$$;

revoke execute on function public.complete_task(uuid, date, timestamptz) from public, anon;
grant execute on function public.complete_task(uuid, date, timestamptz) to authenticated;

-- skip_task keeps its signature: skipping is online only, so it is always now.
create or replace function public.skip_task(p_id uuid, p_today date)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.close_occurrence(p_id, p_today, true);
end;
$$;
