import { supabase } from '@/data/supabase/client';
import { AppError, toAppError } from '@/data/supabase/errors';
import { ROOMS, type Room } from '@/domain/tasks/rooms';
import type { InvitePreview } from './inviteText';
import type { Locale } from '@/i18n';

export type Role = 'owner' | 'member';

export type Membership = {
  householdId: string;
  householdName: string;
  role: Role;
  /** The rooms the home has, in the usual order. A membership persisted before rooms existed lacks it. */
  rooms: Room[];
};
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
      .select('household_id, role, households(name, rooms)')
      .eq('user_id', userId)
      .is('left_at', null)
      .maybeSingle(),
  );
  if (!data) return null;
  return {
    householdId: data.household_id,
    householdName: data.households?.name ?? '',
    role: data.role as Role,
    rooms: toRooms(data.households?.rooms),
  };
}

/** Known rooms only, in the usual order; none known falls back to every room. */
function toRooms(rooms: readonly string[] | undefined): Room[] {
  const known = ROOMS.filter((room) => rooms?.includes(room));
  return known.length > 0 ? known : [...ROOMS];
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

/** Replaces the rooms of the caller's household (at least one, known rooms only). */
export async function setHouseholdRooms(rooms: readonly Room[]): Promise<void> {
  await unwrapMaybe(supabase.rpc('set_household_rooms', { p_rooms: [...rooms] }));
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

/** What the invite leads to, before accepting. Errors like accept_invite (INVITE_INVALID…). */
export async function previewInvite(token: string): Promise<InvitePreview> {
  const rows = await unwrap(supabase.rpc('preview_invite', { p_token: token }));
  const row = rows[0];
  if (!row) throw new Error('preview_invite returned no row');
  return {
    householdName: row.household_name,
    inviterName: row.inviter_name,
    memberCount: row.member_count,
  };
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

/** Replaces the signed-in person's visible name (1 to 40 characters once trimmed). */
export async function setDisplayName(name: string): Promise<void> {
  await unwrapMaybe(supabase.rpc('set_display_name', { p_name: name }));
}

/** Stores the phone's language in the signed-in person's profile, so pushes reach them in it. */
export async function setLocale(locale: Locale): Promise<void> {
  await unwrapMaybe(supabase.rpc('set_locale', { p_locale: locale }));
}
