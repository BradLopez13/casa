-- Household change broadcast: every write to the shared lists sends a private
-- Realtime broadcast on 'household:<id>' so clients know to refetch. The payload
-- only names the table; clients read the data through RLS as usual.

-- broadcast_household_change: row trigger on the household tables. realtime.send
-- catches its own errors and turns them into a WARNING, so a broadcast failure never
-- aborts the business transaction.
create function private.broadcast_household_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_household_id uuid;
begin
  if tg_op = 'DELETE' then
    v_household_id := old.household_id;
  else
    v_household_id := new.household_id;
  end if;

  perform realtime.send(
    jsonb_build_object('table', tg_table_name),
    'changed',
    'household:' || v_household_id,
    true
  );

  return null;
end;
$$;

revoke execute on function private.broadcast_household_change() from public, anon, authenticated;

create trigger shopping_items_broadcast
  after insert or update or delete on public.shopping_items
  for each row execute function private.broadcast_household_change();

create trigger task_occurrences_broadcast
  after insert or update or delete on public.task_occurrences
  for each row execute function private.broadcast_household_change();

create trigger task_series_broadcast
  after insert or update or delete on public.task_series
  for each row execute function private.broadcast_household_change();

-- household_topic_id: the household of a 'household:<uuid>' topic, or null for any
-- other topic. The regex runs before the cast, so it never raises.
create function private.household_topic_id(p_topic text)
returns uuid
language plpgsql
immutable
set search_path = ''
as $$
begin
  if p_topic ~* '^household:[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
    return substr(p_topic, length('household:') + 1)::uuid;
  end if;
  return null;
end;
$$;

-- The policy below evaluates it as the subscribing user.
revoke execute on function private.household_topic_id(text) from public, anon;
grant execute on function private.household_topic_id(text) to authenticated;

-- Only active members of a live household can join its private channel.
-- private.is_member is security definer and already executable by authenticated.
create policy household_members_receive on realtime.messages
  for select to authenticated
  using (
    coalesce(
      realtime.topic() like 'household:%'
        and private.is_member(private.household_topic_id(realtime.topic())),
      false
    )
  );
