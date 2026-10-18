-- Household change broadcast, once per statement instead of once per row: clearing N bought
-- items or deleting a task with its occurrences sends one message per household and table, not
-- N. The transition tables keep each row's household_id, so every household a statement touched
-- hears about it (an update reads the old and the new rows: a row moved between households tells
-- both). A statement that changed no row sends nothing.
--
-- Postgres does not allow transition tables on a trigger with more than one event, so each table
-- gets three triggers on the same function.

create or replace function private.broadcast_household_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_household_id uuid;
begin
  -- Each branch reads only the transition tables its trigger declares.
  if tg_op = 'INSERT' then
    for v_household_id in select distinct household_id from new_rows loop
      perform private.send_household_change(tg_table_name, v_household_id);
    end loop;
  elsif tg_op = 'UPDATE' then
    for v_household_id in
      select household_id from old_rows union select household_id from new_rows
    loop
      perform private.send_household_change(tg_table_name, v_household_id);
    end loop;
  else
    for v_household_id in select distinct household_id from old_rows loop
      perform private.send_household_change(tg_table_name, v_household_id);
    end loop;
  end if;

  return null;
end;
$$;

-- send_household_change: the broadcast itself. realtime.send catches its own errors and turns
-- them into a WARNING, so a broadcast failure never aborts the business transaction.
create function private.send_household_change(p_table text, p_household_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform realtime.send(
    jsonb_build_object('table', p_table),
    'changed',
    'household:' || p_household_id,
    true
  );
end;
$$;

revoke execute on function private.send_household_change(text, uuid) from public, anon, authenticated;

drop trigger shopping_items_broadcast on public.shopping_items;
create trigger shopping_items_broadcast_insert
  after insert on public.shopping_items referencing new table as new_rows
  for each statement execute function private.broadcast_household_change();
create trigger shopping_items_broadcast_update
  after update on public.shopping_items referencing old table as old_rows new table as new_rows
  for each statement execute function private.broadcast_household_change();
create trigger shopping_items_broadcast_delete
  after delete on public.shopping_items referencing old table as old_rows
  for each statement execute function private.broadcast_household_change();

drop trigger task_occurrences_broadcast on public.task_occurrences;
create trigger task_occurrences_broadcast_insert
  after insert on public.task_occurrences referencing new table as new_rows
  for each statement execute function private.broadcast_household_change();
create trigger task_occurrences_broadcast_update
  after update on public.task_occurrences referencing old table as old_rows new table as new_rows
  for each statement execute function private.broadcast_household_change();
create trigger task_occurrences_broadcast_delete
  after delete on public.task_occurrences referencing old table as old_rows
  for each statement execute function private.broadcast_household_change();

drop trigger task_series_broadcast on public.task_series;
create trigger task_series_broadcast_insert
  after insert on public.task_series referencing new table as new_rows
  for each statement execute function private.broadcast_household_change();
create trigger task_series_broadcast_update
  after update on public.task_series referencing old table as old_rows new table as new_rows
  for each statement execute function private.broadcast_household_change();
create trigger task_series_broadcast_delete
  after delete on public.task_series referencing old table as old_rows
  for each statement execute function private.broadcast_household_change();

drop trigger household_members_broadcast on public.household_members;
create trigger household_members_broadcast_insert
  after insert on public.household_members referencing new table as new_rows
  for each statement execute function private.broadcast_household_change();
create trigger household_members_broadcast_update
  after update on public.household_members referencing old table as old_rows new table as new_rows
  for each statement execute function private.broadcast_household_change();
create trigger household_members_broadcast_delete
  after delete on public.household_members referencing old table as old_rows
  for each statement execute function private.broadcast_household_change();
