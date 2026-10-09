-- Realtime evaluates this policy with realtime.topic set to the channel being joined.
-- Binding it to each row's own topic as well keeps any direct read of
-- realtime.messages scoped to the households the caller belongs to.
drop policy household_members_receive on realtime.messages;

create policy household_members_receive on realtime.messages
  for select to authenticated
  using (
    topic = realtime.topic()
    and extension = 'broadcast'
    and coalesce(private.is_member(private.household_topic_id(topic)), false)
  );
