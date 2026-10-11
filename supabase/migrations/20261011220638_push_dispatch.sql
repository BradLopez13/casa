-- Push notifications, part 3: the send-push Edge Function claims pending outbox rows and
-- reports what happened; inserts into the outbox wake it through pg_net, and a pg_cron job
-- retries every ten minutes. The function URL and its shared secret live in Supabase Vault.

-- Pending rows, oldest first, with every token of the recipient. Rows are locked with
-- skip locked first and only then joined to their tokens (no aggregates next to the lock).
create function public.claim_push_batch(p_limit int default 100)
returns table (id bigint, recipient_id uuid, title text, body text, data jsonb, tokens text[])
language sql
volatile
security definer
set search_path = ''
as $$
  with batch as (
    select o.id, o.recipient_id, o.title, o.body, o.data
    from private.push_outbox o
    where o.sent_at is null and o.attempts < 5
    order by o.id
    limit greatest(coalesce(p_limit, 100), 0)
    for update skip locked
  )
  select b.id, b.recipient_id, b.title, b.body, b.data,
         coalesce(
           (select array_agg(t.token order by t.token)
            from public.push_tokens t
            where t.user_id = b.recipient_id),
           '{}'::text[])
  from batch b
  order by b.id;
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
      last_error = left(p_error, 1000)
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
    headers => jsonb_build_object('x-push-secret', v_secret, 'content-type', 'application/json')
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
