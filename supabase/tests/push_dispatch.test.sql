begin;
select plan(34);

select tests.create_user('ana@test.dev', 'Ana') as ana \gset
select tests.create_user('bob@test.dev', 'Bob') as bob \gset
select tests.create_user('carla@test.dev', 'Carla') as carla \gset

-- Start with no sender configured and an empty outbox.
delete from vault.secrets where name in ('push_function_url', 'push_webhook_secret');
delete from private.push_outbox;

insert into public.push_tokens (token, user_id, platform) values
  ('ExponentPushToken[ana-phone]', :'ana', 'android'),
  ('ExponentPushToken[ana-tablet]', :'ana', 'ios'),
  ('ExponentPushToken[bob-phone]', :'bob', 'android');

-- Grants ------------------------------------------------------------------------

select ok(
  not has_function_privilege('authenticated', 'public.claim_push_batch(int)', 'execute')
    and not has_function_privilege('anon', 'public.claim_push_batch(int)', 'execute')
    and has_function_privilege('service_role', 'public.claim_push_batch(int)', 'execute'),
  'only service_role can execute claim_push_batch'
);
select ok(
  not has_function_privilege('authenticated', 'public.mark_push_result(bigint[], bigint[], text, text[])', 'execute')
    and not has_function_privilege('anon', 'public.mark_push_result(bigint[], bigint[], text, text[])', 'execute')
    and has_function_privilege('service_role', 'public.mark_push_result(bigint[], bigint[], text, text[])', 'execute'),
  'only service_role can execute mark_push_result'
);
select ok(
  not has_function_privilege('authenticated', 'private.wake_push_sender_now()', 'execute')
    and not has_function_privilege('anon', 'private.wake_push_sender_now()', 'execute')
    and not has_function_privilege('service_role', 'private.wake_push_sender_now()', 'execute'),
  'nobody but the owner can execute wake_push_sender_now'
);

select tests.authenticate_as(:'ana');
select throws_ok('select * from public.claim_push_batch(10)', '42501', null,
                 'authenticated cannot claim a batch');
select throws_ok($$select public.mark_push_result('{}', '{}', null, '{}')$$, '42501', null,
                 'authenticated cannot mark results');
select tests.clear_auth();

set local role anon;
select throws_ok('select * from public.claim_push_batch(10)', '42501', null,
                 'anon cannot claim a batch');
select throws_ok($$select public.mark_push_result('{}', '{}', null, '{}')$$, '42501', null,
                 'anon cannot mark results');
reset role;

-- Waking without Vault secrets does nothing ---------------------------------------

select count(*) as queue_before from net.http_request_queue \gset

select lives_ok(
  $$insert into private.push_outbox (recipient_id, kind, title, body, data) values
      ('$$ || :'ana' || $$', 'task_assigned', 'Tienes una tarea nueva', 'Fregar', '{"url":"/tasks"}'),
      ('$$ || :'bob' || $$', 'task_assigned', 'Tienes una tarea nueva', 'Barrer', '{"url":"/tasks"}'),
      ('$$ || :'carla' || $$', 'member_joined', 'Alguien nuevo en la casa', 'Bob se ha unido a Piso', '{}')$$,
  'inserting into the outbox works without Vault secrets'
);
select is((select count(*) from net.http_request_queue), :queue_before::bigint,
          'no HTTP request is queued without Vault secrets');
select lives_ok('select private.wake_push_sender_now()', 'waking directly without secrets does not raise');
select is((select count(*) from net.http_request_queue), :queue_before::bigint,
          'still no HTTP request after a direct wake');

-- One row exhausted its attempts and one was already sent.
insert into private.push_outbox (recipient_id, kind, title, body, attempts)
values (:'bob', 'task_assigned', 'Tienes una tarea nueva', 'Agotada', 5);
insert into private.push_outbox (recipient_id, kind, title, body, sent_at)
values (:'bob', 'task_assigned', 'Tienes una tarea nueva', 'Enviada', now());
-- And one is pending but older than a day.
insert into private.push_outbox (recipient_id, kind, title, body, created_at)
values (:'bob', 'task_assigned', 'Tienes una tarea nueva', 'Rancia', now() - interval '25 hours');

select id as ana_row from private.push_outbox where body = 'Fregar' \gset
select id as bob_row from private.push_outbox where body = 'Barrer' \gset
select id as carla_row from private.push_outbox where body like 'Bob se ha unido%' \gset
select id as dead_row from private.push_outbox where body = 'Agotada' \gset
select id as stale_row from private.push_outbox where body = 'Rancia' \gset

-- claim_push_batch ----------------------------------------------------------------

-- Each claim takes a lease, so keep the first batch to inspect it.
create temp table first_claim (
  id bigint, recipient_id uuid, title text, body text, data jsonb, tokens text[]
);
grant all on first_claim to service_role;

set local role service_role;
insert into first_claim select * from public.claim_push_batch(10);
reset role;

select is((select array_agg(id order by id) from first_claim),
          array[:ana_row, :bob_row, :carla_row]::bigint[],
          'three pending rows are claimed; exhausted and sent rows are not');
select is((select tokens from first_claim where id = :ana_row),
          array['ExponentPushToken[ana-phone]', 'ExponentPushToken[ana-tablet]'],
          'every token of the recipient comes with the row');
select is((select tokens from first_claim where id = :carla_row),
          '{}'::text[], 'a recipient without tokens gets an empty array');
select is((select row(recipient_id, title, body, data)::text from first_claim where id = :ana_row),
          row(:'ana'::uuid, 'Tienes una tarea nueva', 'Fregar', '{"url":"/tasks"}'::jsonb)::text,
          'recipient, title, body and data come with the row');
select ok((select count(*) = 0 from first_claim where id = :dead_row),
          'a row with five attempts is not claimed');
select ok((select count(*) = 0 from first_claim where id = :stale_row),
          'a pending row older than a day is stale and not claimed');
select is((select count(*) from private.push_outbox where claimed_at is not null), 3::bigint,
          'claimed rows carry a lease');

set local role service_role;
select is((select count(*) from public.claim_push_batch(10)), 0::bigint,
          'a second claim right away gets none of the leased rows');
reset role;

-- The lease lasts two minutes.
update private.push_outbox set claimed_at = now() - interval '3 minutes' where claimed_at is not null;

set local role service_role;
select is((select array_agg(id) from public.claim_push_batch(2)),
          array[:ana_row, :bob_row]::bigint[],
          'expired leases are claimable again; the limit is honoured, oldest first');
select is((select array_agg(id) from public.claim_push_batch(10)),
          array[:carla_row]::bigint[], 'the next claim only gets what is left');

-- mark_push_result ----------------------------------------------------------------

select lives_ok(
  format($$select public.mark_push_result(array[%s]::bigint[], array[%s, %s]::bigint[], 'DeviceNotRegistered', array['ExponentPushToken[bob-phone]'])$$,
         :ana_row, :bob_row, :carla_row),
  'service_role marks a batch'
);

reset role;

select isnt((select sent_at from private.push_outbox where id = :ana_row), null,
            'sent rows get sent_at');
select is((select array_agg(attempts order by id) from private.push_outbox where id in (:bob_row, :carla_row)),
          array[1, 1], 'failed rows add an attempt');
select is((select last_error from private.push_outbox where id = :bob_row), 'DeviceNotRegistered',
          'failed rows keep the error');
select is((select count(*) from private.push_outbox where id in (:bob_row, :carla_row) and claimed_at is not null),
          0::bigint, 'failed rows drop their lease');
select is((select count(*) from public.push_tokens where token = 'ExponentPushToken[bob-phone]'), 0::bigint,
          'dead tokens are deleted');
select is((select count(*) from public.push_tokens where user_id = :'ana'), 2::bigint,
          'other tokens stay');

set local role service_role;
select is((select array_agg(id order by id) from public.claim_push_batch(10)),
          array[:bob_row, :carla_row]::bigint[],
          'failed rows are claimable again at once; the sent row is not');
reset role;

update private.push_outbox set claimed_at = now() - interval '3 minutes';
set local role service_role;
select ok((select count(*) = 0 from public.claim_push_batch(10) where id = :ana_row),
          'a sent row never comes back, lease or not');
reset role;

-- Locking: pgTAP cannot open two sessions, so check the definition.
select ok(pg_get_functiondef('public.claim_push_batch'::regproc) ilike '%for update skip locked%',
          'claim_push_batch locks rows with skip locked');

-- Waking with Vault secrets queues one request ------------------------------------

select vault.create_secret('http://example.test/functions/v1/send-push', 'push_function_url');
select vault.create_secret('s3cret-for-tests', 'push_webhook_secret');

insert into private.push_outbox (recipient_id, kind, title, body)
values (:'ana', 'task_assigned', 'Tienes una tarea nueva', 'Regar'),
       (:'bob', 'task_assigned', 'Tienes una tarea nueva', 'Tender');

select is(
  (select count(*) from net.http_request_queue
    where url = 'http://example.test/functions/v1/send-push'
      and method = 'POST'
      and headers ->> 'x-push-secret' = 's3cret-for-tests'),
  1::bigint,
  'one insert statement queues exactly one POST with the secret header'
);
select is(
  (select timeout_milliseconds from net.http_request_queue
    where url = 'http://example.test/functions/v1/send-push'),
  30000,
  'the wake request waits up to 30 seconds'
);

-- Retry job -------------------------------------------------------------------------

select ok(
  not exists (select 1 from pg_namespace where nspname = 'cron')
    or exists (
      select 1 from cron.job
      where jobname = 'send-push-retry'
        and schedule = '*/10 * * * *'
        and command = 'select private.wake_push_sender_now()'
    ),
  'the send-push-retry job runs every ten minutes when pg_cron exists'
);

select * from finish();
rollback;
