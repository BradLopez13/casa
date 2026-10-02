import { supabase } from '@/data/supabase/client';
import { AppError, toAppError } from '@/data/supabase/errors';

export type Role = 'owner' | 'member';

export type Membership = { householdId: string; householdName: string; role: Role };
export type Member = { userId: string; displayName: string; role: Role; joinedAt: string };
export type ActiveInvite = { id: string; expiresAt: string; createdBy: string | null };

type Result<D> = PromiseLike<{ data: D; error: unknown }>;

/** Resolves with the data (possibly null), or throws an AppError. */
async function unwrapMaybe<D>(promise: Result<D>): Promise<D> {
  let result;
  try {
    result = await promise;
  } catch (e) {
    throw toAppError(e);
  }
  if (result.error) throw toAppError(result.error);
  return result.data;
}

/** Like unwrapMaybe, but a null result is an error. */
async function unwrap<D>(promise: Result<D>): Promise<NonNullable<D>> {
  const data = await unwrapMaybe(promise);
  if (data === null || data === undefined) throw new AppError('UNKNOWN');
  return data;
}

export async function getMyMembership(): Promise<Membership | null> {
  let sessionResult;
  try {
    sessionResult = await supabase.auth.getSession();
  } catch (e) {
    throw toAppError(e);
  }
  if (sessionResult.error) throw toAppError(sessionResult.error);
  const userId = sessionResult.data.session?.user.id;
  if (!userId) return null;

  const data = await unwrapMaybe(
    supabase
      .from('household_members')
      .select('household_id, role, households(name)')
      .eq('user_id', userId)
      .is('left_at', null)
      .maybeSingle(),
  );
  if (!data) return null;
  return {
    householdId: data.household_id,
    householdName: data.households?.name ?? '',
    role: data.role as Role,
  };
}

export async function listMembers(householdId: string): Promise<Member[]> {
  const data = await unwrap(
    supabase
      .from('household_members')
      .select('user_id, role, joined_at, profiles(display_name)')
      .eq('household_id', householdId)
      .is('left_at', null)
      .order('joined_at', { ascending: true }),
  );
  return data.map((row) => ({
    userId: row.user_id,
    displayName: row.profiles?.display_name ?? '',
    role: row.role as Role,
    joinedAt: row.joined_at,
  }));
}

export async function listActiveInvites(householdId: string): Promise<ActiveInvite[]> {
  const data = await unwrap(
    supabase
      .from('household_invites')
      .select('id, expires_at, created_by')
      .eq('household_id', householdId)
      .is('revoked_at', null)
      .is('accepted_at', null)
      .gt('expires_at', new Date().toISOString())
      .order('expires_at', { ascending: true }),
  );
  return data.map((row) => ({
    id: row.id,
    expiresAt: row.expires_at,
    createdBy: row.created_by,
  }));
}

export async function createHousehold(name: string): Promise<string> {
  return unwrap(supabase.rpc('create_household', { p_name: name }));
}

export async function createInvite(
  householdId: string,
): Promise<{ token: string; expiresAt: string }> {
  const rows = await unwrap(supabase.rpc('create_invite', { p_household_id: householdId }));
  const row = rows[0];
  if (!row) throw new AppError('UNKNOWN');
  return { token: row.token, expiresAt: row.expires_at };
}

export async function revokeInvite(inviteId: string): Promise<void> {
  await unwrapMaybe(supabase.rpc('revoke_invite', { p_invite_id: inviteId }));
}

export async function acceptInvite(token: string): Promise<string> {
  return unwrap(supabase.rpc('accept_invite', { p_token: token }));
}

export async function leaveHousehold(householdId: string): Promise<void> {
  await unwrapMaybe(supabase.rpc('leave_household', { p_household_id: householdId }));
}

export async function removeMember(householdId: string, userId: string): Promise<void> {
  await unwrapMaybe(
    supabase.rpc('remove_member', { p_household_id: householdId, p_user_id: userId }),
  );
}

export async function transferOwnership(householdId: string, userId: string): Promise<void> {
  await unwrapMaybe(
    supabase.rpc('transfer_ownership', { p_household_id: householdId, p_new_owner_id: userId }),
  );
}

export async function deleteHousehold(householdId: string): Promise<void> {
  await unwrapMaybe(supabase.rpc('delete_household', { p_household_id: householdId }));
}
