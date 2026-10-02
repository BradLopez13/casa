create table public.households (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 60 and name = btrim(name)),
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table public.household_members (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  user_id uuid not null references public.profiles (user_id) on delete cascade,
  role text not null check (role in ('owner', 'member')),
  joined_at timestamptz not null default now(),
  left_at timestamptz
);

create unique index household_members_one_owner
  on public.household_members (household_id)
  where role = 'owner' and left_at is null;

create unique index household_members_one_active
  on public.household_members (user_id)
  where left_at is null;

alter table public.households enable row level security;
alter table public.household_members enable row level security;

revoke all on public.households from anon;
revoke all on public.households from authenticated;
grant select on public.households to authenticated;

revoke all on public.household_members from anon;
revoke all on public.household_members from authenticated;
grant select on public.household_members to authenticated;

-- Membership helpers. Security definer so policies on the same tables do not
-- recurse; they are called by the querying role, so authenticated needs execute.
create function private.is_member(p_household uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.household_members m
    join public.households h on h.id = m.household_id
    where m.household_id = p_household
      and m.user_id = (select auth.uid())
      and m.left_at is null
      and h.deleted_at is null
  );
$$;

create function private.is_owner(p_household uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.household_members m
    join public.households h on h.id = m.household_id
    where m.household_id = p_household
      and m.user_id = (select auth.uid())
      and m.role = 'owner'
      and m.left_at is null
      and h.deleted_at is null
  );
$$;

create function private.shares_household(p_user uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.household_members mine
    join public.household_members theirs on theirs.household_id = mine.household_id
    join public.households h on h.id = mine.household_id
    where mine.user_id = (select auth.uid())
      and mine.left_at is null
      and theirs.user_id = p_user
      and theirs.left_at is null
      and h.deleted_at is null
  );
$$;

revoke execute on function private.is_member(uuid) from public, anon;
revoke execute on function private.is_owner(uuid) from public, anon;
revoke execute on function private.shares_household(uuid) from public, anon;
grant execute on function private.is_member(uuid) to authenticated;
grant execute on function private.is_owner(uuid) to authenticated;
grant execute on function private.shares_household(uuid) to authenticated;

create policy households_select_member on public.households
  for select to authenticated
  using (private.is_member(id));

create policy household_members_select_member on public.household_members
  for select to authenticated
  using (left_at is null and private.is_member(household_id));

drop policy profiles_select_own on public.profiles;
create policy profiles_select_self_or_household on public.profiles
  for select to authenticated
  using (user_id = (select auth.uid()) or private.shares_household(user_id));
