create table public.household_invites (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  token_hash text not null unique,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  revoked_at timestamptz,
  accepted_by uuid references auth.users (id) on delete set null,
  accepted_at timestamptz
);

alter table public.household_invites enable row level security;

revoke all on public.household_invites from anon;
revoke all on public.household_invites from authenticated;
-- Every column except token_hash: the hash must never leave the database.
grant select (id, household_id, created_by, created_at, expires_at, revoked_at, accepted_by, accepted_at)
  on public.household_invites to authenticated;

create policy household_invites_select_member on public.household_invites
  for select to authenticated
  using (private.is_member(household_id));
