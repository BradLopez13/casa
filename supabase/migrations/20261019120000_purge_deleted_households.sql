-- A deleted household (its last person left, its owner deleted it, or deleted their account)
-- only gets deleted_at. Thirty days later it is erased for good: members, invites, tasks and
-- shopping go with it through their on delete cascade. The privacy policy promises this delay.
create function private.purge_deleted_households()
returns int
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_purged int;
begin
  delete from public.households
  where deleted_at is not null
    and deleted_at < now() - interval '30 days';
  get diagnostics v_purged = row_count;
  return v_purged;
end;
$$;

revoke execute on function private.purge_deleted_households() from public, anon, authenticated;

-- Every night. pg_cron may be missing in some environments; the migration must still apply.
do $$
begin
  if exists (select 1 from pg_namespace where nspname = 'cron') then
    perform cron.unschedule(j.jobid) from cron.job j where j.jobname = 'purge-deleted-households';
    perform cron.schedule(
      'purge-deleted-households',
      '30 3 * * *',
      'select private.purge_deleted_households()'
    );
  end if;
end;
$$;
