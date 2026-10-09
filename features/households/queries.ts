import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toAppError, type AppError } from '@/data/supabase/errors';
import { useSession } from '@/features/auth/SessionProvider';
import { getMyMembership, listActiveInvites, listMembers } from './api';
import { invitesKey, membersKey, membershipKey } from './keys';

export { invitesKey, membersKey, membershipKey };

export function useMembership() {
  const { status } = useSession();
  return useQuery({
    queryKey: membershipKey,
    queryFn: getMyMembership,
    enabled: status === 'signed-in',
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
