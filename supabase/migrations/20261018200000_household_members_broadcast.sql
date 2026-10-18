-- Membership changes broadcast on the household topic, like the shared lists: whoever joins,
-- leaves, is removed or changes role shows up in the other members' apps without a reload.
-- broadcast_household_change reads household_id from old on a delete, so leaving reaches the
-- household that was left. The member who left no longer passes the receive policy and finds
-- out on their next read.
create trigger household_members_broadcast
  after insert or update or delete on public.household_members
  for each row execute function private.broadcast_household_change();
