create table public.task_series (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households on delete cascade,
  title text not null check (char_length(title) between 1 and 100 and title = btrim(title)),
  room text check (room in ('kitchen','bathroom','living_room','bedroom','laundry','outdoor','other')),
  recurrence_rule jsonb,
  created_by uuid references auth.users on delete set null,
  created_at timestamptz not null default now(),
  unique (id, household_id)
);

create table public.task_occurrences (
  id uuid primary key default gen_random_uuid(),
  series_id uuid not null,
  household_id uuid not null references public.households on delete cascade,
  due_on date,
  assignee_id uuid references public.profiles (user_id) on delete set null,
  completed_at timestamptz,
  completed_by uuid references auth.users on delete set null,
  created_at timestamptz not null default now(),
  check (completed_by is null or completed_at is not null),
  foreign key (series_id, household_id)
    references public.task_series (id, household_id) on delete cascade
);

create index task_series_household on public.task_series (household_id);
create index task_occurrences_open on public.task_occurrences (household_id, due_on)
  where completed_at is null;
create index task_occurrences_assignee_open on public.task_occurrences (assignee_id, due_on)
  where completed_at is null;
create index task_occurrences_done on public.task_occurrences (household_id, completed_at)
  where completed_at is not null;

alter table public.task_series enable row level security;
alter table public.task_occurrences enable row level security;

revoke all on public.task_series from anon, authenticated;
revoke all on public.task_occurrences from anon, authenticated;
grant select on public.task_series to authenticated;
grant select on public.task_occurrences to authenticated;

create policy task_series_select_member on public.task_series
  for select to authenticated
  using (private.is_member(household_id));

create policy task_occurrences_select_member on public.task_occurrences
  for select to authenticated
  using (private.is_member(household_id));

-- Open tasks of someone who leaves (or is removed, or whose household is
-- deleted) become unassigned. Completed ones keep the assignee for history.
-- Runs inside leave/remove/delete, which already hold the household row lock.
create function private.unassign_open_tasks()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.task_occurrences
  set assignee_id = null
  where household_id = new.household_id
    and assignee_id = new.user_id
    and completed_at is null;
  return new;
end;
$$;

revoke execute on function private.unassign_open_tasks() from public, anon, authenticated;

create trigger on_member_left
  after update of left_at on public.household_members
  for each row
  when (old.left_at is null and new.left_at is not null)
  execute function private.unassign_open_tasks();
