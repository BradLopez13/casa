-- Push notifications, part 1: extensions, device tokens, per-type preferences and the
-- private outbox. Triggers, the sender and the cron job come in later migrations.
create extension if not exists pg_net with schema extensions;
create extension if not exists pg_cron;

create table public.push_tokens (
  token text primary key check (char_length(token) between 10 and 200),
  user_id uuid not null references public.profiles (user_id) on delete cascade,
  platform text not null check (platform in ('android', 'ios')),
  updated_at timestamptz not null default now()
);

create index push_tokens_user_id_idx on public.push_tokens (user_id);

create table public.notification_prefs (
  user_id uuid primary key references public.profiles (user_id) on delete cascade,
  task_assigned boolean not null default true,
  member_joined boolean not null default true
);

create table private.push_outbox (
  id bigint generated always as identity primary key,
  recipient_id uuid not null references public.profiles (user_id) on delete cascade,
  kind text not null check (kind in ('task_assigned', 'member_joined')),
  title text not null,
  body text not null,
  data jsonb not null default '{}',
  created_at timestamptz not null default now(),
  sent_at timestamptz,
  attempts int not null default 0,
  last_error text
);

create index push_outbox_recipient_id_idx on private.push_outbox (recipient_id);
create index push_outbox_pending_idx on private.push_outbox (id) where sent_at is null;

alter table public.push_tokens enable row level security;
alter table public.notification_prefs enable row level security;
alter table private.push_outbox enable row level security;

revoke all on public.push_tokens from anon, authenticated;
revoke all on public.notification_prefs from anon, authenticated;
revoke all on private.push_outbox from anon, authenticated;
grant select on public.push_tokens to authenticated;
grant select on public.notification_prefs to authenticated;

create policy push_tokens_select_own on public.push_tokens
  for select to authenticated
  using (user_id = (select auth.uid()));

create policy notification_prefs_select_own on public.notification_prefs
  for select to authenticated
  using (user_id = (select auth.uid()));

create function public.register_push_token(p_token text, p_platform text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := (select auth.uid());
begin
  if v_user is null then
    raise exception 'NOT_AUTHENTICATED' using errcode = 'P0001';
  end if;

  -- Only Expo push tokens: ExponentPushToken[...] or ExpoPushToken[...].
  if p_token is null or char_length(p_token) not between 10 and 200
     or p_token !~ '^Expo(nent)?PushToken\[[^\]]+\]$'
     or p_platform is null or p_platform not in ('android', 'ios') then
    raise exception 'INVALID_PUSH_TOKEN' using errcode = 'P0001';
  end if;

  insert into public.push_tokens (token, user_id, platform, updated_at)
  values (p_token, v_user, p_platform, now())
  on conflict (token) do update
    set user_id = excluded.user_id,
        platform = excluded.platform,
        updated_at = now();

  -- Ten devices per user at most: the newest ten stay (the one just registered always does).
  delete from public.push_tokens t
  where t.user_id = v_user
    and t.token not in (
      select k.token
      from public.push_tokens k
      where k.user_id = v_user
      order by (k.token = p_token) desc, k.updated_at desc, k.token
      limit 10
    );
end;
$$;

create function public.unregister_push_token(p_token text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := (select auth.uid());
begin
  if v_user is null then
    raise exception 'NOT_AUTHENTICATED' using errcode = 'P0001';
  end if;

  delete from public.push_tokens where token = p_token and user_id = v_user;
end;
$$;

create function public.set_notification_prefs(p_task_assigned boolean, p_member_joined boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := (select auth.uid());
begin
  if v_user is null then
    raise exception 'NOT_AUTHENTICATED' using errcode = 'P0001';
  end if;

  if p_task_assigned is null or p_member_joined is null then
    raise exception 'INVALID_PREFS' using errcode = 'P0001';
  end if;

  insert into public.notification_prefs (user_id, task_assigned, member_joined)
  values (v_user, p_task_assigned, p_member_joined)
  on conflict (user_id) do update
    set task_assigned = excluded.task_assigned,
        member_joined = excluded.member_joined;
end;
$$;

revoke execute on function public.register_push_token(text, text) from public, anon;
revoke execute on function public.unregister_push_token(text) from public, anon;
revoke execute on function public.set_notification_prefs(boolean, boolean) from public, anon;
grant execute on function public.register_push_token(text, text) to authenticated;
grant execute on function public.unregister_push_token(text) to authenticated;
grant execute on function public.set_notification_prefs(boolean, boolean) to authenticated;

-- A missing preferences row means everything is on.
create function private.push_enabled(p_user uuid, p_kind text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    (select case p_kind
              when 'task_assigned' then np.task_assigned
              when 'member_joined' then np.member_joined
            end
     from public.notification_prefs np
     where np.user_id = p_user),
    true);
$$;

revoke execute on function private.push_enabled(uuid, text) from public, anon, authenticated;
