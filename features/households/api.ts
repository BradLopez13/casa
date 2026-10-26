import { supabase } from '@/data/supabase/client';
import { AppError, isMissingOnServer, toAppError } from '@/data/supabase/errors';
import { ROOMS, type Room } from '@/domain/tasks/rooms';
import type { InvitePreview } from './inviteText';
import type { Locale } from '@/i18n';

export type Role = 'owner' | 'member';

export type LicenseStatus = 'complimentary' | 'trial' | 'active' | 'past_due' | 'canceled';

/** A household's licence as the household list knows it (bloque 12). */
export type LicenseSummary = {
  status: LicenseStatus;
  /** When a trial ends, or the paid period ended or ends; null when there is none. */
  endsAt: string | null;
  /** What the server's write guard says: always true while billing is off. */
  licensed: boolean;
};

export type Membership = {
  householdId: string;
  householdName: string;
  role: Role;
  /** The rooms the home has, in the usual order. A membership persisted before rooms existed lacks it. */
  rooms: Room[];
  /** How many people live there; unknown on a database without my_households (bloque 12). */
  memberCount?: number;
  /** Its licence; unknown on a database without licences. */
  license?: LicenseSummary;
};

/** The licence screen's row: who pays and until when (bloque 12). */
export type HouseholdLicense = {
  status: LicenseStatus;
  paidBy: string | null;
  currentPeriodEnd: string | null;
  trialEndsAt: string | null;
};

/** What the billing provider needs to start paying for a household's licence. */
export type Checkout = { provider: string; offering: string; householdId: string };
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

async function sessionUserId(): Promise<string | null> {
  let sessionResult;
  try {
    sessionResult = await supabase.auth.getSession();
  } catch (e) {
    throw toAppError(e);
  }
  if (sessionResult.error) throw toAppError(sessionResult.error);
  return sessionResult.data.session?.user.id ?? null;
}

const LICENSE_STATUSES: readonly string[] = [
  'complimentary',
  'trial',
  'active',
  'past_due',
  'canceled',
];

function toLicense(
  status: string | null,
  endsAt: string | null,
  licensed: boolean | null,
): LicenseSummary | undefined {
  if (status === null || !LICENSE_STATUSES.includes(status)) return undefined;
  return { status: status as LicenseStatus, endsAt, licensed: licensed ?? true };
}

/**
 * Every household the signed-in person is in, the oldest membership first (bloque 12). A
 * database without my_households (PGRST202) is read as before, from the memberships, without
 * sizes or licences.
 */
export async function listMyHouseholds(): Promise<Membership[]> {
  const userId = await sessionUserId();
  if (!userId) return [];

  let result;
  try {
    result = await supabase.rpc('my_households');
  } catch (e) {
    throw toAppError(e);
  }
  if (!isMissingOnServer(result.error)) {
    if (result.error) throw toAppError(result.error);
    return (result.data ?? []).map((row) => ({
      householdId: row.household_id,
      householdName: row.name,
      role: row.role as Role,
      rooms: toRooms(row.rooms),
      memberCount: row.member_count,
      license: toLicense(row.license_status, row.license_ends_at, row.licensed),
    }));
  }

  const data = await unwrap(
    supabase
      .from('household_members')
      .select('household_id, role, joined_at, households(name, rooms)')
      .eq('user_id', userId)
      .is('left_at', null)
      .order('joined_at', { ascending: true }),
  );
  return data.map((row) => ({
    householdId: row.household_id,
    householdName: row.households?.name ?? '',
    role: row.role as Role,
    rooms: toRooms(row.households?.rooms),
  }));
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

/**
 * Replaces a household's rooms (at least one, known rooms only). A database without the
 * per-household version (PGRST202) gets the old one, which picks the caller's newest household:
 * the one just created.
 */
export async function setHouseholdRooms(
  householdId: string,
  rooms: readonly Room[],
): Promise<void> {
  let result;
  try {
    result = await supabase.rpc('set_household_rooms', {
      p_household_id: householdId,
      p_rooms: [...rooms],
    });
  } catch (e) {
    throw toAppError(e);
  }
  if (!isMissingOnServer(result.error)) {
    if (result.error) throw toAppError(result.error);
    return;
  }
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
    // A database before bloque 12 does not say; accepting then answers ALREADY_IN_HOUSEHOLD.
    alreadyMember: row.already_member ?? false,
    householdId: row.household_id ?? null,
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

/** A household's licence for its screen; null on a database without licences. */
export async function getHouseholdLicense(householdId: string): Promise<HouseholdLicense | null> {
  let result;
  try {
    result = await supabase
      .from('household_licenses')
      .select('status, paid_by, current_period_end, trial_ends_at')
      .eq('household_id', householdId)
      .maybeSingle();
  } catch (e) {
    throw toAppError(e);
  }
  if (isMissingOnServer(result.error)) return null;
  if (result.error) throw toAppError(result.error);
  const row = result.data;
  if (!row || !LICENSE_STATUSES.includes(row.status)) return null;
  return {
    status: row.status as LicenseStatus,
    paidBy: row.paid_by,
    currentPeriodEnd: row.current_period_end,
    trialEndsAt: row.trial_ends_at,
  };
}

/** Starts paying for a household's licence; BILLING_DISABLED while billing is off. */
export async function startHouseholdCheckout(householdId: string): Promise<Checkout> {
  const data = await unwrap(
    supabase.rpc('start_household_checkout', { p_household_id: householdId }),
  );
  const row = data as { provider?: unknown; offering?: unknown };
  if (typeof row.provider !== 'string' || typeof row.offering !== 'string') {
    throw new AppError('UNKNOWN');
  }
  return { provider: row.provider, offering: row.offering, householdId };
}
