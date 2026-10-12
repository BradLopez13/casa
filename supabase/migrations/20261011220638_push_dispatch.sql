-- Push notifications, part 3: the send-push Edge Function claims pending outbox rows and
-- reports what happened; inserts into the outbox wake it through pg_net, and a pg_cron job
-- retries every ten minutes. The function URL and its shared secret live in Supabase Vault.

-- Senders hold a two-minute lease on the rows they claim. PostgREST runs each RPC in its own
-- transaction, so row locks alone end when the claim returns; the lease is what keeps two
-- overlapping senders (insert wake + cron retry) from sending the same notice.
alter table private.push_outbox add column claimed_at timestamptz;

-- Pending, unleased rows from the last day (an older notice is stale and never sent), oldest
-- first, with every token of the recipient. One statement: lock with skip locked, stamp the
-- lease, then join the updated rows to their tokens.
create function public.claim_push_batch(p_limit int default 100)
returns table (id bigint, recipient_id uuid, title text, body text, data jsonb, tokens text[])
language sql
volatile
security definer
set search_path = ''
as $$
  with claimed as (
    update private.push_outbox o
    set claimed_at = now()
    where o.id in (
      select p.id
      from private.push_outbox p
      where p.sent_at is null
        and p.attempts < 5
        and p.created_at > now() - interval '1 day'
        and (p.claimed_at is null or p.claimed_at < now() - interval '2 minutes')
      order by p.id
      limit greatest(coalesce(p_limit, 100), 0)
      for update skip locked
    )
    returning o.id, o.recipient_id, o.title, o.body, o.data
  )
  select c.id, c.recipient_id, c.title, c.body, c.data,
         coalesce(
           (select array_agg(t.token order by t.token)
            from public.push_tokens t
            where t.user_id = c.recipient_id),
           '{}'::text[])
  from claimed c
  order by c.id;
$$;

create function public.mark_push_result(
  p_sent bigint[],
  p_failed bigint[],
  p_error text,
  p_dead_tokens text[]
)
returns void
language sql
volatile
security definer
set search_path = ''
as $$
  update private.push_outbox
  set sent_at = now()
  where id = any (p_sent) and sent_at is null;

  update private.push_outbox
  set attempts = attempts + 1,
      last_error = left(p_error, 1000),
      claimed_at = null
  where id = any (p_failed) and sent_at is null;

  delete from public.push_tokens where token = any (p_dead_tokens);
$$;

revoke execute on function public.claim_push_batch(int) from public, anon, authenticated;
revoke execute on function public.mark_push_result(bigint[], bigint[], text, text[])
  from public, anon, authenticated;
grant execute on function public.claim_push_batch(int) to service_role;
grant execute on function public.mark_push_result(bigint[], bigint[], text, text[]) to service_role;

-- Asks the Edge Function to drain the outbox. Without the Vault secrets (local tests, CI) it
-- does nothing, and it never raises: a failed wake must not undo the insert that caused it
-- (the cron job retries). Only the SQLSTATE is reported, never the URL or the secret.
create function private.wake_push_sender_now()
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_url text;
  v_secret text;
begin
  select ds.decrypted_secret into v_url
  from vault.decrypted_secrets ds
  where ds.name = 'push_function_url'
  limit 1;

  select ds.decrypted_secret into v_secret
  from vault.decrypted_secrets ds
  where ds.name = 'push_webhook_secret'
  limit 1;

  if coalesce(v_url, '') = '' or coalesce(v_secret, '') = '' then
    return;
  end if;

  perform net.http_post(
    url => v_url,
    body => '{}'::jsonb,
    headers => jsonb_build_object('x-push-secret', v_secret, 'content-type', 'application/json'),
    timeout_milliseconds => 30000
  );
exception
  when others then
    raise warning 'wake_push_sender_now failed (SQLSTATE %)', sqlstate;
end;
$$;

create function private.wake_push_sender()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.wake_push_sender_now();
  return null;
end;
$$;

revoke execute on function private.wake_push_sender_now() from public, anon, authenticated;
revoke execute on function private.wake_push_sender() from public, anon, authenticated;

create trigger push_outbox_wake_sender
  after insert on private.push_outbox
  for each statement
  execute function private.wake_push_sender();

-- Retry job. pg_cron may be missing in some environments; the migration must still apply.
do $$
begin
  if exists (select 1 from pg_namespace where nspname = 'cron') then
    perform cron.unschedule(j.jobid) from cron.job j where j.jobname = 'send-push-retry';
    perform cron.schedule(
      'send-push-retry',
      '*/10 * * * *',
      'select private.wake_push_sender_now()'
    );
  end if;
end;
$$;
