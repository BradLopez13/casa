import { useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query';
import { useCallback } from 'react';
import { toAppError, type AppError } from '@/data/supabase/errors';
import { useSession } from '@/features/auth/SessionProvider';
import { pickActive, readActiveHousehold, writeActiveHousehold } from './active';
import {
  getHouseholdLicense,
  listActiveInvites,
  listMembers,
  listMyHouseholds,
  previewInvite,
  setDisplayName,
  type Membership,
} from './api';
import { householdsKey, invitesKey, licenseKey, membersKey, membershipKey } from './keys';

export { householdsKey, invitesKey, licenseKey, membersKey, membershipKey };

/**
 * Lists the person's households and keeps the active membership in line with it: the same
 * household with its fresh name, role and licence, or, once it is gone, the next one.
 */
async function fetchHouseholds(queryClient: QueryClient): Promise<Membership[]> {
  const list = await listMyHouseholds();
  const current = queryClient.getQueryData<Membership | null>(membershipKey);
  if (current !== undefined) {
    queryClient.setQueryData(membershipKey, pickActive(list, current?.householdId ?? null));
  }
  return list;
}

/**
 * The household the app shows (bloque 12): the list, fresh, and the one this phone chose for
 * this person (`active.ts`), or the first. Null without households.
 */
export async function loadActiveMembership(
  queryClient: QueryClient,
  userId: string | null,
): Promise<Membership | null> {
  const list = await queryClient.fetchQuery({
    queryKey: householdsKey,
    queryFn: () => fetchHouseholds(queryClient),
    staleTime: 0,
  });
  return pickActive(list, userId === null ? null : await readActiveHousehold(userId));
}

/** The active membership's query, also for a screen that needs it fresh (invite, onboarding). */
export function membershipQuery(queryClient: QueryClient, userId: string | null) {
  return {
    queryKey: membershipKey,
    queryFn: () => loadActiveMembership(queryClient, userId),
  };
}

/** The active household's membership: what every screen shows. */
export function useMembership() {
  const { status, userId } = useSession();
  const queryClient = useQueryClient();
  return useQuery({ ...membershipQuery(queryClient, userId), enabled: status === 'signed-in' });
}

/** Every household the person is in, the oldest membership first. */
export function useHouseholds() {
  const { status } = useSession();
  const queryClient = useQueryClient();
  return useQuery({
    queryKey: householdsKey,
    queryFn: () => fetchHouseholds(queryClient),
    enabled: status === 'signed-in',
  });
}

/** Whether the person is in more than one household: the words then say «esta casa». */
export function useSeveralHouseholds(): boolean {
  return (useHouseholds().data?.length ?? 0) > 1;
}

/**
 * Makes `householdId` the household this phone shows, at once: every screen follows the
 * membership. The choice is kept on the phone for the next start.
 */
export async function setActiveHousehold(
  queryClient: QueryClient,
  userId: string | null,
  householdId: string,
): Promise<void> {
  // A membership fetch already on its way would land on top of the switch.
  await queryClient.cancelQueries({ queryKey: membershipKey });
  if (userId !== null) await writeActiveHousehold(userId, householdId);
  const list = queryClient.getQueryData<Membership[]>(householdsKey) ?? [];
  const next = list.find((h) => h.householdId === householdId);
  if (next) {
    queryClient.setQueryData(membershipKey, next);
    return;
  }
  // Not in the list this phone has (joined elsewhere a moment ago): fetch it fresh, which picks
  // the household just chosen once it is there.
  await queryClient.invalidateQueries({ queryKey: membershipKey });
}

/** Switching household from a screen: «Tus casas», Ajustes or a tapped notice. */
export function useSwitchHousehold() {
  const { userId } = useSession();
  const queryClient = useQueryClient();
  return useCallback(
    (householdId: string) => setActiveHousehold(queryClient, userId, householdId),
    [queryClient, userId],
  );
}

/** A household's licence, for its screen. */
export function useHouseholdLicense(householdId: string | undefined) {
  return useQuery({
    queryKey: licenseKey(householdId),
    queryFn: () => getHouseholdLicense(householdId as string),
    enabled: householdId !== undefined,
  });
}

const TERMINAL_INVITE = new Set(['INVITE_INVALID', 'INVITE_EXPIRED', 'NOT_AUTHENTICATED']);

/** The invite's household, inviter and size; a dead invite is not retried. */
export function useInvitePreview(token: string | null) {
  const { status } = useSession();
  return useQuery({
    queryKey: ['invitePreview', token],
    queryFn: () => previewInvite(token as string),
    enabled: status === 'signed-in' && token !== null,
    retry: (failures, error) => !TERMINAL_INVITE.has(toAppError(error).code) && failures < 2,
    staleTime: 0,
    gcTime: 0,
  });
}

export function useMembers(householdId: string | undefined) {
  return useQuery({
    queryKey: membersKey(householdId),
    queryFn: () => listMembers(householdId as string),
    enabled: householdId !== undefined,
  });
}

export function useInvites(householdId: string | undefined) {
  return useQuery({
    queryKey: invitesKey(householdId),
    queryFn: () => listActiveInvites(householdId as string),
    enabled: householdId !== undefined,
  });
}

/** Runs a household RPC and refreshes membership, members and invites on success. */
export function useHouseholdMutation<TArgs, TResult>(fn: (args: TArgs) => Promise<TResult>) {
  const queryClient = useQueryClient();
  const refresh = () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: membershipKey }),
      queryClient.invalidateQueries({ queryKey: householdsKey }),
      queryClient.invalidateQueries({ queryKey: ['members'] }),
      queryClient.invalidateQueries({ queryKey: ['invites'] }),
    ]);
  return useMutation<TResult, AppError, TArgs>({
    mutationFn: fn,
    onSuccess: async () => {
      await refresh();
    },
    // The server says our view of the household is stale (we were removed, or the owner
    // changed): refetch so the UI and the route guard catch up.
    onError: async (error) => {
      const code = toAppError(error).code;
      if (code === 'NOT_A_MEMBER' || code === 'NOT_OWNER') await refresh();
    },
  });
}

/** Saves your visible name; refreshes membership and members so every list shows it. */
export function useSetDisplayName() {
  return useHouseholdMutation(setDisplayName);
}
